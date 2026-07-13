import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import type { LanguageModelV3GenerateResult } from "@ai-sdk/provider";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { createAgent } from "@/db/repo/agents";
import {
    createPipeline,
    listRuns,
    listStepRuns,
    setPipelineSteps,
} from "@/db/repo/pipelines";
import { PermissionContext } from "@/ai/tools/context";
import type { AgentRuntime } from "@/ai/agents/types";
import { runPipeline } from "./runner";

let db: ReturnType<typeof createTestDbClient>;

beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

const usage = {
    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 5, text: 5, reasoning: 0 },
};
const text = (t: string): LanguageModelV3GenerateResult => ({
    content: [{ type: "text" as const, text: t }],
    finishReason: { unified: "stop" as const, raw: undefined },
    usage,
    warnings: [],
});

function runtimeWith(model: MockLanguageModelV3): AgentRuntime {
    return {
        permissions: new PermissionContext(),
        mainModel: model,
        mainModelId: "mock-main",
        routerModel: model,
        routerModelId: "mock-main",
        resolveModel: () => model,
        fetch: async () => new Response("stub"),
    };
}

async function twoStepPipeline() {
    const a = await createAgent({
        name: "Reader",
        description: "reads",
        instructions: "Read.",
        tools: [],
    });
    const b = await createAgent({
        name: "Writer",
        description: "writes",
        instructions: "Write.",
        tools: [],
    });
    const p = await createPipeline({ name: "Digest" });
    await setPipelineSteps(p.id, [
        { agentId: a.id, promptTemplate: "Read {{input}}" },
        { agentId: b.id, promptTemplate: "Summarize: {{prev}}" },
    ]);
    return p;
}

describe("runPipeline", () => {
    it("chains step outputs and persists the run", async () => {
        const p = await twoStepPipeline();
        const model = new MockLanguageModelV3({
            doGenerate: [text("PAGE CONTENT"), text("THE SUMMARY")],
        });

        const result = await runPipeline({
            pipelineId: p.id,
            input: "hn.example",
            runtime: runtimeWith(model),
        });

        expect(result.status).toBe("success");
        expect(result.finalOutput).toBe("THE SUMMARY");
        // Step 2's prompt saw step 1's output via {{prev}}.
        expect(
            JSON.stringify(model.doGenerateCalls[1]?.prompt),
        ).toContain("Summarize: PAGE CONTENT");

        const runs = await listRuns({ pipelineId: p.id });
        expect(runs[0]!.status).toBe("success");
        const steps = await listStepRuns(result.runId);
        expect(steps.map((s) => s.status)).toEqual(["success", "success"]);
        expect(steps[1]!.output).toBe("THE SUMMARY");
    });

    it("marks the run failed when a step throws and stops there", async () => {
        const p = await twoStepPipeline();
        const model = new MockLanguageModelV3({
            doGenerate: () => {
                throw new Error("model exploded");
            },
        });

        const result = await runPipeline({
            pipelineId: p.id,
            input: "x",
            runtime: runtimeWith(model),
        });

        expect(result.status).toBe("error");
        const runs = await listRuns({ pipelineId: p.id });
        expect(runs[0]!.status).toBe("error");
        expect(runs[0]!.error).toContain("step 1");
        const steps = await listStepRuns(result.runId);
        expect(steps).toHaveLength(1);
        expect(steps[0]!.status).toBe("error");
    });

    it("throws before creating a run when the pipeline has no steps", async () => {
        const p = await createPipeline({ name: "Empty" });
        await expect(
            runPipeline({
                pipelineId: p.id,
                input: "",
                runtime: runtimeWith(new MockLanguageModelV3({})),
            }),
        ).rejects.toThrow(/no steps/);
        expect(await listRuns({ pipelineId: p.id })).toHaveLength(0);
    });
});
