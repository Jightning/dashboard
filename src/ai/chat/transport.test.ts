import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { MockLanguageModelV3, convertArrayToReadableStream } from "ai/test";
import type { LanguageModelV3StreamPart } from "@ai-sdk/provider";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import {
    createSession,
    getSession,
    setCompactionSummary,
} from "@/db/repo/sessions";
import { insertMessage, listMessages } from "@/db/repo/messages";
import { createOrchestrator } from "@/ai/agents/orchestrator";
import { PermissionContext } from "@/ai/tools/context";
import { UsageCollector } from "@/ai/context/tokens";
import {
    SessionTransport,
    rowToUiMessage,
    type SessionChatContext,
} from "./transport";
import type { AgentRuntime } from "@/ai/agents/types";
import type { Preset } from "@/lib/schemas";
import type { UIMessage } from "ai";

let db: ReturnType<typeof createTestDbClient>;

beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});

afterEach(() => {
    db.close();
});

const mockUsage = {
    inputTokens: { total: 100, noCache: 90, cacheRead: 10, cacheWrite: 0 },
    outputTokens: { total: 25, text: 25, reasoning: 0 },
};

function streamOf(text: string): {
    stream: ReadableStream<LanguageModelV3StreamPart>;
} {
    return {
        stream: convertArrayToReadableStream<LanguageModelV3StreamPart>([
            { type: "stream-start", warnings: [] },
            { type: "text-start", id: "1" },
            { type: "text-delta", id: "1", delta: text },
            { type: "text-end", id: "1" },
            {
                type: "finish",
                finishReason: { unified: "stop", raw: undefined },
                usage: mockUsage,
            },
        ]),
    };
}

function makePreset(overrides: Partial<Preset> = {}): Preset {
    return {
        id: "pre_test",
        name: "Test",
        description: null,
        system_prompt: "You are a test assistant.",
        provider: "google",
        model: "mock-model",
        router_model: null,
        enabled_agents_json: "[]",
        permission_level_id: null,
        token_budget: null,
        compaction_threshold: null,
        is_builtin: 0,
        created_at: 0,
        updated_at: 0,
        ...overrides,
    };
}

function makeContext(opts: {
    sessionId: string;
    preset: Preset;
    model: MockLanguageModelV3;
    summarize?: (prompt: string) => Promise<string>;
}): SessionChatContext {
    const collector = new UsageCollector();
    const runtime: AgentRuntime = {
        permissions: new PermissionContext(),
        mainModel: opts.model,
        mainModelId: opts.preset.model,
        routerModel: opts.model,
        routerModelId: opts.preset.model,
        resolveModel: (modelId) => new MockLanguageModelV3({ modelId }),
        fetch: async () => new Response("stub"),
        onUsage: collector.collect,
    };
    const orchestrator = createOrchestrator(runtime, {
        systemPrompt: opts.preset.system_prompt,
        enabledAgents: [],
    });
    return {
        sessionId: opts.sessionId,
        preset: opts.preset,
        orchestrator,
        summarize: opts.summarize ?? (async () => "summary"),
        collector,
    };
}

function userUiMessage(text: string): UIMessage {
    return { id: "u1", role: "user", parts: [{ type: "text", text }] };
}

async function drain(stream: ReadableStream<unknown>): Promise<unknown[]> {
    const chunks: unknown[] = [];
    const reader = stream.getReader();
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    return chunks;
}

describe("SessionTransport", () => {
    it("persists the user message, streams, and persists the assistant with usage", async () => {
        const session = await createSession({});
        const model = new MockLanguageModelV3({
            modelId: "mock-model",
            doStream: [streamOf("Hello there!")],
        });
        let persisted = false;
        const ctx = makeContext({
            sessionId: session.id,
            preset: makePreset(),
            model,
        });
        const transport = new SessionTransport({
            getContext: () => ctx,
            onPersisted: () => {
                persisted = true;
            },
        });

        const stream = await transport.sendMessages({
            trigger: "submit-message",
            chatId: session.id,
            messageId: undefined,
            messages: [userUiMessage("Hi")],
            abortSignal: undefined,
        });
        const chunks = await drain(stream);
        expect(JSON.stringify(chunks)).toContain("Hello there!");

        // onEnd persistence is async relative to stream close; poll briefly.
        for (let i = 0; i < 50 && !persisted; i++)
            await new Promise((r) => setTimeout(r, 10));
        expect(persisted).toBe(true);

        const rows = await listMessages(session.id);
        expect(rows.map((r) => r.role)).toEqual(["user", "assistant"]);
        expect(rows[1]?.input_tokens).toBe(100);
        expect(rows[1]?.output_tokens).toBe(25);
        expect(rows[1]?.cached_input_tokens).toBe(10);
        expect(rows[1]?.parts_json).toContain("Hello there!");
    });

    it("injects the compaction summary as a system message", async () => {
        const session = await createSession({});
        await setCompactionSummary(session.id, "the user likes thermodynamics");
        const model = new MockLanguageModelV3({
            modelId: "mock-model",
            doStream: [streamOf("ok")],
        });
        const ctx = makeContext({
            sessionId: session.id,
            preset: makePreset(),
            model,
        });
        const transport = new SessionTransport({ getContext: () => ctx });

        const stream = await transport.sendMessages({
            trigger: "submit-message",
            chatId: session.id,
            messageId: undefined,
            messages: [userUiMessage("continue")],
            abortSignal: undefined,
        });
        await drain(stream);

        const sentPrompt = JSON.stringify(model.doStreamCalls[0]?.prompt);
        expect(sentPrompt).toContain("the user likes thermodynamics");
    });

    it("compacts before sending when over the threshold", async () => {
        const session = await createSession({});
        for (let i = 0; i < 12; i++) {
            await insertMessage({
                sessionId: session.id,
                role: i % 2 ? "assistant" : "user",
                partsJson: JSON.stringify([
                    { type: "text", text: `turn ${i} ${"x".repeat(200)}` },
                ]),
            });
        }
        const model = new MockLanguageModelV3({
            modelId: "mock-model",
            doStream: [streamOf("done")],
        });
        const preset = makePreset({ compaction_threshold: 50 });
        let summarized = false;
        const ctx = makeContext({
            sessionId: session.id,
            preset,
            model,
            summarize: async () => {
                summarized = true;
                return "compact summary of turns";
            },
        });
        const transport = new SessionTransport({ getContext: () => ctx });

        const stream = await transport.sendMessages({
            trigger: "submit-message",
            chatId: session.id,
            messageId: undefined,
            messages: [userUiMessage("next")],
            abortSignal: undefined,
        });
        await drain(stream);

        expect(summarized).toBe(true);
        expect((await getSession(session.id)).compaction_summary).toBe(
            "compact summary of turns",
        );
        // The model saw the summary plus only the kept tail, not "turn 0".
        const sentPrompt = JSON.stringify(model.doStreamCalls[0]?.prompt);
        expect(sentPrompt).toContain("compact summary of turns");
        expect(sentPrompt).not.toContain("turn 0 ");
    });

    it("round-trips stored rows to UI messages", async () => {
        const session = await createSession({});
        await insertMessage({
            sessionId: session.id,
            role: "user",
            partsJson: JSON.stringify([{ type: "text", text: "hello" }]),
        });
        const rows = await listMessages(session.id);
        const ui = rowToUiMessage(rows[0]!);
        expect(ui.role).toBe("user");
        expect(ui.parts).toEqual([{ type: "text", text: "hello" }]);
    });
});
