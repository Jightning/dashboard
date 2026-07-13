import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { createPipeline } from "@/db/repo/pipelines";
import {
    createAutomation,
    getAutomation,
    listDueAutomations,
} from "@/db/repo/automations";
import { DEFAULT_SETTINGS } from "@/ai/providers/keys";
import { startAutomationScheduler } from "./scheduler";
import type { Automation } from "@/lib/schemas";

let db: ReturnType<typeof createTestDbClient>;

beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => {
    db.close();
    vi.useRealTimers();
});

describe("automation scheduler", () => {
    it("claims due automations exactly once and reschedules", async () => {
        const p = await createPipeline({ name: "P" });
        const a = await createAutomation({
            name: "Every minute",
            pipelineId: p.id,
            scheduleKind: "interval",
            intervalMinutes: 1,
            inputTemplate: "",
        });
        // Force it due now.
        const { markRun } = await import("@/db/repo/automations");
        await markRun(a.id, { nextRunAt: Date.now() - 1000, lastRunAt: 0 });

        const ran: string[] = [];
        const stop = startAutomationScheduler({
            settings: DEFAULT_SETTINGS,
            fetch: async () => new Response("stub"),
            tickMs: 5,
            run: async (auto: Automation) => {
                ran.push(auto.id);
            },
        });
        // The scheduler ticks immediately; give the async tick a beat.
        await vi.waitFor(() => expect(ran).toEqual([a.id]));
        stop();

        const after = await getAutomation(a.id);
        expect(after.next_run_at).toBeGreaterThan(Date.now());
        expect(await listDueAutomations(Date.now())).toHaveLength(0);
    });

    it("keeps ticking when a run throws", async () => {
        const p = await createPipeline({ name: "P2" });
        const a = await createAutomation({
            name: "Flaky",
            pipelineId: p.id,
            scheduleKind: "interval",
            intervalMinutes: 1,
            inputTemplate: "",
        });
        const { markRun } = await import("@/db/repo/automations");
        await markRun(a.id, { nextRunAt: Date.now() - 1000, lastRunAt: 0 });

        const stop = startAutomationScheduler({
            settings: DEFAULT_SETTINGS,
            fetch: async () => new Response("stub"),
            tickMs: 5,
            run: async () => {
                throw new Error("boom");
            },
        });
        await vi.waitFor(async () =>
            expect((await getAutomation(a.id)).next_run_at).toBeGreaterThan(
                Date.now(),
            ),
        );
        stop(); // no unhandled rejection = pass
    });
});
