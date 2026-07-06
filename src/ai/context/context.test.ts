import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { createSession, getSession } from "@/db/repo/sessions";
import { insertMessage, listActiveMessages } from "@/db/repo/messages";
import {
    estimateContextTokens,
    estimateTokens,
    textFromPartsJson,
    UsageCollector,
} from "./tokens";
import { KEEP_RECENT, buildSummaryPrompt, maybeCompact } from "./compaction";

let db: ReturnType<typeof createTestDbClient>;

beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});

afterEach(() => {
    db.close();
});

function parts(text: string): string {
    return JSON.stringify([{ type: "text", text }]);
}

describe("token estimation", () => {
    it("estimates chars/4 and extracts text from parts", () => {
        expect(estimateTokens("abcd")).toBe(1);
        expect(estimateTokens("abcde")).toBe(2);
        expect(textFromPartsJson(parts("hello"))).toBe("hello");
        expect(textFromPartsJson("not json")).toBe("not json");
    });

    it("sums summary and active messages", () => {
        const est = estimateContextTokens({
            summary: "abcdefgh", // 2 tokens
            activeMessages: [
                {
                    id: "m1",
                    session_id: "s",
                    role: "user",
                    parts_json: parts("abcd"), // 1 token
                    agent: null,
                    model: null,
                    input_tokens: null,
                    output_tokens: null,
                    cached_input_tokens: null,
                    compacted: 0,
                    created_at: 0,
                },
            ],
        });
        expect(est).toBe(3);
    });
});

describe("UsageCollector", () => {
    it("sums usage across orchestrator and specialist events", () => {
        const collector = new UsageCollector();
        const usage = (input: number, output: number, cached: number) => ({
            inputTokens: input,
            inputTokenDetails: {
                noCacheTokens: input,
                cacheReadTokens: cached,
                cacheWriteTokens: 0,
            },
            outputTokens: output,
            outputTokenDetails: { textTokens: output, reasoningTokens: 0 },
            totalTokens: input + output,
        });
        collector.collect({
            agent: "orchestrator",
            model: "r",
            usage: usage(100, 20, 10),
        });
        collector.collect({
            agent: "knowledge",
            model: "m",
            usage: usage(200, 50, 0),
        });
        expect(collector.totals()).toEqual({
            inputTokens: 300,
            outputTokens: 70,
            cachedInputTokens: 10,
        });
    });
});

describe("compaction", () => {
    async function seedConversation(turns: number) {
        const session = await createSession({});
        for (let i = 0; i < turns; i++) {
            await insertMessage({
                sessionId: session.id,
                role: i % 2 === 0 ? "user" : "assistant",
                partsJson: parts(
                    `turn ${i}: ${"lorem ipsum dolor sit amet consectetur adipiscing elit ".repeat(5)}`,
                ),
            });
        }
        return session;
    }

    it("does nothing below the threshold", async () => {
        const session = await seedConversation(4);
        const result = await maybeCompact({
            sessionId: session.id,
            thresholdTokens: 1_000_000,
            summarize: async () => {
                throw new Error("must not be called");
            },
        });
        expect(result.compacted).toBe(false);
        expect((await listActiveMessages(session.id)).length).toBe(4);
    });

    it("does nothing when threshold is null (disabled)", async () => {
        const session = await seedConversation(4);
        const result = await maybeCompact({
            sessionId: session.id,
            thresholdTokens: null,
            summarize: async () => "unused",
        });
        expect(result.compacted).toBe(false);
    });

    it("summarizes all but the last KEEP_RECENT messages above threshold", async () => {
        const session = await seedConversation(20);
        let receivedPrompt = "";
        const result = await maybeCompact({
            sessionId: session.id,
            thresholdTokens: 10,
            summarize: async (prompt) => {
                receivedPrompt = prompt;
                return "SUMMARY: the user discussed lorem ipsum across many turns.";
            },
        });

        expect(result.compacted).toBe(true);
        const active = await listActiveMessages(session.id);
        expect(active).toHaveLength(KEEP_RECENT);
        expect(active[0]?.parts_json).toContain(`turn ${20 - KEEP_RECENT}`);

        const updated = await getSession(session.id);
        expect(updated.compaction_summary).toContain("SUMMARY");
        // The summarizer saw the old turns but not the kept ones.
        expect(receivedPrompt).toContain("turn 0");
        expect(receivedPrompt).not.toContain(`turn ${20 - KEEP_RECENT}:`);
    });

    it("folds the previous summary into the next one", async () => {
        const session = await seedConversation(20);
        await maybeCompact({
            sessionId: session.id,
            thresholdTokens: 10,
            summarize: async () => "first summary",
        });
        for (let i = 0; i < 10; i++) {
            await insertMessage({
                sessionId: session.id,
                role: "user",
                partsJson: parts("more text ".repeat(30)),
            });
        }
        let prompt = "";
        await maybeCompact({
            sessionId: session.id,
            thresholdTokens: 10,
            summarize: async (p) => {
                prompt = p;
                return "second summary";
            },
        });
        expect(prompt).toContain("first summary");
        expect((await getSession(session.id)).compaction_summary).toBe(
            "second summary",
        );
    });

    it("fails fast on an empty summarizer result", async () => {
        const session = await seedConversation(20);
        await expect(
            maybeCompact({
                sessionId: session.id,
                thresholdTokens: 10,
                summarize: async () => "  ",
            }),
        ).rejects.toThrow(/empty/);
    });

    it("buildSummaryPrompt includes roles and instructions", () => {
        const prompt = buildSummaryPrompt(null, [
            {
                id: "m",
                session_id: "s",
                role: "user",
                parts_json: parts("remember X=42"),
                agent: null,
                model: null,
                input_tokens: null,
                output_tokens: null,
                cached_input_tokens: null,
                compacted: 0,
                created_at: 0,
            },
        ]);
        expect(prompt).toContain("user: remember X=42");
        expect(prompt).toContain("Preserve every concrete fact");
    });
});
