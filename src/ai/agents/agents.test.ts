import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import type { LanguageModelV3GenerateResult } from "@ai-sdk/provider";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { insertDocument } from "@/db/repo/documents";
import { PermissionContext } from "@/ai/tools/context";
import { createOrchestrator } from "./orchestrator";
import type { AgentRuntime, AgentUsageEvent } from "./types";

let db: ReturnType<typeof createTestDbClient>;

beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});

afterEach(() => {
    db.close();
});

const mockUsage = {
    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 5, text: 5, reasoning: 0 },
};

function textResult(text: string): LanguageModelV3GenerateResult {
    return {
        content: [{ type: "text" as const, text }],
        finishReason: { unified: "stop" as const, raw: undefined },
        usage: mockUsage,
        warnings: [],
    };
}

function toolCallResult(
    toolName: string,
    input: unknown,
): LanguageModelV3GenerateResult {
    return {
        content: [
            {
                type: "tool-call" as const,
                toolCallId: `call_${toolName}`,
                toolName,
                input: JSON.stringify(input),
            },
        ],
        finishReason: { unified: "tool-calls" as const, raw: undefined },
        usage: mockUsage,
        warnings: [],
    };
}

function makeRuntime(overrides: {
    routerModel: MockLanguageModelV3;
    mainModel: MockLanguageModelV3;
    onUsage?: (e: AgentUsageEvent) => void;
}): AgentRuntime {
    return {
        permissions: new PermissionContext(),
        mainModel: overrides.mainModel,
        mainModelId: "mock-main",
        routerModel: overrides.routerModel,
        routerModelId: "mock-router",
        fetch: async () => new Response("stub"),
        onUsage: overrides.onUsage,
    };
}

describe("orchestrator routing", () => {
    it("delegates to the knowledge agent and composes the final answer", async () => {
        const usageEvents: AgentUsageEvent[] = [];
        const routerModel = new MockLanguageModelV3({
            modelId: "mock-router",
            doGenerate: [
                toolCallResult("ask_knowledge_agent", {
                    task: "What do my notes say about Carnot?",
                }),
                textResult(
                    "Your notes say the Carnot cycle bounds efficiency.",
                ),
            ],
        });
        const mainModel = new MockLanguageModelV3({
            modelId: "mock-main",
            doGenerate: [
                textResult(
                    "The notes state the Carnot cycle bounds heat-engine efficiency.",
                ),
            ],
        });
        const runtime = makeRuntime({
            routerModel,
            mainModel,
            onUsage: (e) => usageEvents.push(e),
        });
        runtime.permissions.levelGrants = [
            {
                tool: "search_documents",
                access: "read",
                scopeType: "any",
                scopeValue: null,
            },
        ];

        const orchestrator = createOrchestrator(runtime, {
            systemPrompt: "You are a study assistant.",
            enabledAgents: ["knowledge"],
        });
        const result = await orchestrator.generate({
            prompt: "What do my notes say about Carnot?",
        });

        expect(result.text).toContain("Carnot cycle bounds efficiency");
        // The specialist actually ran on the main model with the delegated task.
        expect(mainModel.doGenerateCalls).toHaveLength(1);
        expect(JSON.stringify(mainModel.doGenerateCalls[0]?.prompt)).toContain(
            "What do my notes say about Carnot?",
        );
        // Both the specialist and the orchestrator report usage for token tracking.
        expect(usageEvents).toEqual([
            expect.objectContaining({ agent: "knowledge", model: "mock-main" }),
            expect.objectContaining({
                agent: "orchestrator",
                model: "mock-router",
            }),
        ]);
    });

    it("exposes no delegation tools when the preset enables no agents", async () => {
        const routerModel = new MockLanguageModelV3({
            doGenerate: [textResult("Direct answer.")],
        });
        const mainModel = new MockLanguageModelV3({ doGenerate: [] });
        const orchestrator = createOrchestrator(
            makeRuntime({ routerModel, mainModel }),
            {
                systemPrompt: "Quick answers.",
                enabledAgents: [],
            },
        );

        expect(Object.keys(orchestrator.tools)).toEqual([]);
        const result = await orchestrator.generate({ prompt: "2+2?" });
        expect(result.text).toBe("Direct answer.");
        // No routing addendum when there is nothing to route to.
        expect(
            JSON.stringify(routerModel.doGenerateCalls[0]?.prompt),
        ).not.toContain("Routing:");
    });

    it("routes research tasks to the research agent", async () => {
        const routerModel = new MockLanguageModelV3({
            doGenerate: [
                toolCallResult("ask_research_agent", {
                    task: "Read https://example.com/post",
                }),
                textResult("Summary of the page."),
            ],
        });
        const mainModel = new MockLanguageModelV3({
            doGenerate: [textResult("The page says hello.")],
        });
        const orchestrator = createOrchestrator(
            makeRuntime({ routerModel, mainModel }),
            {
                systemPrompt: "Research assistant.",
                enabledAgents: ["knowledge", "research"],
            },
        );

        expect(Object.keys(orchestrator.tools).sort()).toEqual([
            "ask_knowledge_agent",
            "ask_research_agent",
        ]);
        const result = await orchestrator.generate({
            prompt: "Summarize example.com/post",
        });
        expect(result.text).toBe("Summary of the page.");
    });

    it("gates specialist tool calls through the broker across nesting", async () => {
        await insertDocument({
            title: "private journal",
            contentText: "secret",
            mimeType: "text/plain",
            folder: "/personal",
        });
        const routerModel = new MockLanguageModelV3({
            doGenerate: [
                toolCallResult("ask_knowledge_agent", {
                    task: "Read the journal",
                }),
                textResult("I could not access that."),
            ],
        });
        // Specialist tries a search; after the denial it answers in text.
        const mainModel = new MockLanguageModelV3({
            doGenerate: [
                toolCallResult("search_documents", { query: "journal" }),
                textResult("Access was denied by the user."),
            ],
        });
        const runtime = makeRuntime({ routerModel, mainModel });
        const asked: string[] = [];
        runtime.permissions.broker.subscribe((pending) => {
            for (const req of pending) {
                asked.push(req.tool);
                runtime.permissions.broker.respond(req.id, "deny");
            }
        });

        const orchestrator = createOrchestrator(runtime, {
            systemPrompt: "Assistant.",
            enabledAgents: ["knowledge"],
        });
        await orchestrator.generate({ prompt: "Read my journal" });

        // The approval request crossed the nesting boundary…
        expect(asked).toEqual(["search_documents"]);
        // …and the specialist's second model call saw the structured denial.
        const secondCall = JSON.stringify(mainModel.doGenerateCalls[1]?.prompt);
        expect(secondCall).toContain("denied");
    });
});
