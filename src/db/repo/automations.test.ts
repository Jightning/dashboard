import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { createPipeline } from "./pipelines";
import {
    createAutomation,
    listAutomations,
    listDueAutomations,
    markRun,
    setAutomationEnabled,
} from "./automations";

let db: ReturnType<typeof createTestDbClient>;

beforeEach(async () => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

async function pipeline() {
    return createPipeline({ name: `P${Math.random()}` });
}

describe("automations repo", () => {
    it("creates with a computed next_run_at", async () => {
        const p = await pipeline();
        const before = Date.now();
        const a = await createAutomation({
            name: "Every hour",
            pipelineId: p.id,
            scheduleKind: "interval",
            intervalMinutes: 60,
            inputTemplate: "",
        });
        expect(a.next_run_at).toBeGreaterThanOrEqual(before + 59 * 60_000);
    });

    it("lists only enabled, due automations", async () => {
        const p = await pipeline();
        const a = await createAutomation({
            name: "Soon",
            pipelineId: p.id,
            scheduleKind: "interval",
            intervalMinutes: 1,
            inputTemplate: "",
        });
        expect(await listDueAutomations(Date.now())).toHaveLength(0);
        expect(
            await listDueAutomations(Date.now() + 2 * 60_000),
        ).toHaveLength(1);

        await setAutomationEnabled(a.id, false);
        expect(
            await listDueAutomations(Date.now() + 2 * 60_000),
        ).toHaveLength(0);
    });

    it("markRun advances the clock", async () => {
        const p = await pipeline();
        const a = await createAutomation({
            name: "M",
            pipelineId: p.id,
            scheduleKind: "interval",
            intervalMinutes: 5,
            inputTemplate: "",
        });
        const t = Date.now() + 10 * 60_000;
        await markRun(a.id, { nextRunAt: t + 5 * 60_000, lastRunAt: t });
        const [row] = await listAutomations();
        expect(row!.last_run_at).toBe(t);
        expect(row!.next_run_at).toBe(t + 5 * 60_000);
    });
});
