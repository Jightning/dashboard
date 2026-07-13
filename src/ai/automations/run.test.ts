import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { createPipeline, listRuns, setPipelineSteps } from "@/db/repo/pipelines";
import { BUILTIN_AGENT_IDS, seedBuiltinAgents } from "@/db/repo/agents";
import { createAutomation } from "@/db/repo/automations";
import { DEFAULT_SETTINGS } from "@/ai/providers/keys";
import { runAutomation } from "./run";

let db: ReturnType<typeof createTestDbClient>;

beforeEach(async () => {
    db = createTestDbClient();
    setDb(db);
    await seedBuiltinAgents();
});
afterEach(() => {
    db.close();
});

// A google key so buildPipelineRuntime can construct models without a network
// call — the failures under test all throw before any model is invoked.
const deps = {
    settings: { ...DEFAULT_SETTINGS, googleApiKey: "test-key" },
    fetch: (async () => new Response("stub")) as typeof globalThis.fetch,
};

describe("runAutomation failure visibility", () => {
    it("records a failed run when the pipeline has no steps", async () => {
        const p = await createPipeline({ name: "Empty" });
        const a = await createAutomation({
            name: "No steps",
            pipelineId: p.id,
            scheduleKind: "interval",
            intervalMinutes: 60,
            inputTemplate: "hello",
        });

        await expect(runAutomation(a, deps)).rejects.toThrow(/no steps/);

        const runs = await listRuns({ automationId: a.id });
        expect(runs).toHaveLength(1);
        expect(runs[0]?.status).toBe("error");
        expect(runs[0]?.error).toMatch(/no steps/);
    });

    it("records a failed run when input_template references an unknown variable", async () => {
        const p = await createPipeline({ name: "HasStep" });
        await setPipelineSteps(p.id, [
            { agentId: BUILTIN_AGENT_IDS.knowledge, promptTemplate: "{{input}}" },
        ]);
        const a = await createAutomation({
            name: "Bad template",
            pipelineId: p.id,
            scheduleKind: "interval",
            intervalMinutes: 60,
            inputTemplate: "today is {{oops}}",
        });

        await expect(runAutomation(a, deps)).rejects.toThrow(/unknown template variable/);

        const runs = await listRuns({ automationId: a.id });
        expect(runs).toHaveLength(1);
        expect(runs[0]?.status).toBe("error");
        expect(runs[0]?.error).toMatch(/oops/);
    });
});
