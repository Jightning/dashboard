import { evalite } from "evalite";
import { MockLanguageModelV3 } from "ai/test";
import { createOrchestrator } from "@/ai/agents/orchestrator";
import type { AgentDef } from "@/lib/schemas";
import { getEvalModels } from "./models";
import { makeEvalRuntime, seedEvalDb } from "./fixtures";
import { exactRoute } from "./scorers";

const evalDef = (
    name: string,
    description: string,
    tools: string[],
): AgentDef => ({
    id: `agt_${name.toLowerCase()}`,
    name,
    description,
    instructions: `You are the ${name} agent.`,
    tools_json: JSON.stringify(tools),
    model: null,
    max_steps: 6,
    color: null,
    is_builtin: 1,
    created_at: 0,
    updated_at: 0,
});

/**
 * Does the (real) router model pick the right first move?
 * Regression gate: ≥ 0.85 before shipping model or prompt changes.
 *
 * Specialists are mocked — we only score the routing decision, so the eval is
 * cheap: one real router call per case.
 */
const models = getEvalModels();
const run = models ? evalite : evalite.skip;

run<string, string, string>("Router picks the right agent", {
    data: () => [
        // → knowledge agent (user's own material)
        {
            input: "What did my thermodynamics notes say about the Carnot limit?",
            expected: "knowledge",
        },
        { input: "When are my ECE lab kits due back?", expected: "knowledge" },
        {
            input: "Search my documents for anything about lab grading policy.",
            expected: "knowledge",
        },
        {
            input: "Summarize the lecture notes I saved last week.",
            expected: "knowledge",
        },
        {
            input: "Do I have any notes mentioning reservoir temperatures?",
            expected: "knowledge",
        },
        // → research agent (specific web pages)
        {
            input: "Read https://arxiv.org/abs/2401.00001 and summarize the abstract.",
            expected: "research",
        },
        {
            input: "What does the page at https://tauri.app/start/ say about prerequisites?",
            expected: "research",
        },
        {
            input: "Fetch https://news.ycombinator.com and tell me the top story.",
            expected: "research",
        },
        // → direct answer (general knowledge, no tools needed)
        { input: "What is the derivative of x^2?", expected: "direct" },
        {
            input: "Explain the difference between TCP and UDP in two sentences.",
            expected: "direct",
        },
        { input: "Write a haiku about finals week.", expected: "direct" },
        { input: "Convert 100 fahrenheit to celsius.", expected: "direct" },
    ],
    task: async (input) => {
        await seedEvalDb();
        if (!models) throw new Error("unreachable");
        // Real router model; specialists stubbed with a canned-reply mock.
        const stubSpecialist = new MockLanguageModelV3({
            doGenerate: async () => ({
                content: [{ type: "text", text: "(stub specialist reply)" }],
                finishReason: { unified: "stop", raw: undefined },
                usage: {
                    inputTokens: {
                        total: 0,
                        noCache: 0,
                        cacheRead: 0,
                        cacheWrite: 0,
                    },
                    outputTokens: { total: 0, text: 0, reasoning: 0 },
                },
                warnings: [],
            }),
        });
        const runtime = makeEvalRuntime({
            main: stubSpecialist,
            router: models.router,
            grants: [
                {
                    tool: "search_documents",
                    access: "read",
                    scopeType: "any",
                    scopeValue: null,
                },
                {
                    tool: "read_document",
                    access: "read",
                    scopeType: "any",
                    scopeValue: null,
                },
                {
                    tool: "list_documents",
                    access: "read",
                    scopeType: "any",
                    scopeValue: null,
                },
                {
                    tool: "fetch_url",
                    access: "read",
                    scopeType: "any",
                    scopeValue: null,
                },
            ],
        });
        const orchestrator = createOrchestrator(runtime, {
            systemPrompt:
                "You are the user's personal dashboard assistant with access to their stored documents (via the knowledge agent) and the web (via the research agent).",
            agents: [
                evalDef(
                    "Knowledge",
                    "Searches and reads the user's stored documents and notes.",
                    ["search_documents", "read_document", "list_documents"],
                ),
                evalDef("Research", "Reads specific web pages.", ["fetch_url"]),
            ],
        });

        const result = await orchestrator.generate({ prompt: input });
        const firstToolCall = result.steps
            .flatMap((s) => s.toolCalls)
            .map((c) => c.toolName)
            .at(0);
        if (firstToolCall === "ask_knowledge_agent") return "knowledge";
        if (firstToolCall === "ask_research_agent") return "research";
        return "direct";
    },
    scorers: [exactRoute],
});
