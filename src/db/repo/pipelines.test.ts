import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { seedBuiltinAgents, BUILTIN_AGENT_IDS } from "./agents";
import {
    createPipeline,
    createRun,
    createStepRun,
    deletePipeline,
    finishRun,
    finishStepRun,
    listPipelineSteps,
    listPipelines,
    listRuns,
    listStepRuns,
    setPipelineSteps,
} from "./pipelines";

let db: ReturnType<typeof createTestDbClient>;

beforeEach(async () => {
    db = createTestDbClient();
    setDb(db);
    await seedBuiltinAgents();
});

afterEach(() => db.close());

describe("pipelines repo", () => {
    it("creates a pipeline and replaces its steps atomically-enough", async () => {
        const p = await createPipeline({ name: "Digest" });
        await setPipelineSteps(p.id, [
            {
                agentId: BUILTIN_AGENT_IDS.research,
                promptTemplate: "Read {{input}}",
            },
            {
                agentId: BUILTIN_AGENT_IDS.knowledge,
                promptTemplate: "Relate to my notes: {{prev}}",
            },
        ]);
        let steps = await listPipelineSteps(p.id);
        expect(steps.map((s) => s.position)).toEqual([1, 2]);

        await setPipelineSteps(p.id, [
            {
                agentId: BUILTIN_AGENT_IDS.knowledge,
                promptTemplate: "only step {{input}}",
            },
        ]);
        steps = await listPipelineSteps(p.id);
        expect(steps).toHaveLength(1);
        expect(steps[0]!.position).toBe(1);
    });

    it("persists run and step-run lifecycles", async () => {
        const p = await createPipeline({ name: "R" });
        const run = await createRun({ pipelineId: p.id, input: "go" });
        expect(run.status).toBe("running");

        const sr = await createStepRun({
            runId: run.id,
            position: 1,
            agentId: BUILTIN_AGENT_IDS.research,
            prompt: "Read go",
        });
        await finishStepRun(sr.id, { status: "success", output: "done" });
        await finishRun(run.id, { status: "success" });

        const runs = await listRuns({ pipelineId: p.id });
        expect(runs[0]!.status).toBe("success");
        expect(runs[0]!.finished_at).not.toBeNull();
        const stepRuns = await listStepRuns(run.id);
        expect(stepRuns[0]!.output).toBe("done");
    });

    it("cascades runs and steps on pipeline delete", async () => {
        const p = await createPipeline({ name: "X" });
        const run = await createRun({ pipelineId: p.id, input: "" });
        await deletePipeline(p.id);
        expect(await listPipelines()).toHaveLength(0);
        expect(await listStepRuns(run.id)).toHaveLength(0);
        expect(await listRuns({})).toHaveLength(0);
    });
});
