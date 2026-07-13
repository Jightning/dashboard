import {
    listDueAutomations,
    markRun,
} from "@/db/repo/automations";
import { computeNextRun } from "./schedule";
import { runAutomation } from "./run";
import type { Settings } from "@/ai/providers/keys";
import type { Automation } from "@/lib/schemas";

/**
 * Fires due automations while the app is open. Claims (advances next_run_at)
 * BEFORE running so a slow run can never double-fire; failures log and the
 * loop keeps going. Returns a stop function.
 */
export function startAutomationScheduler(deps: {
    settings: Settings;
    fetch: typeof globalThis.fetch;
    tickMs?: number;
    /** Injectable for tests; defaults to the real headless run. */
    run?: (a: Automation) => Promise<void>;
}): () => void {
    const run =
        deps.run ??
        ((a: Automation) =>
            runAutomation(a, { settings: deps.settings, fetch: deps.fetch }));
    let ticking = false;

    const tick = async () => {
        if (ticking) return; // a long run outlasted the interval — skip
        ticking = true;
        try {
            const due = await listDueAutomations(Date.now());
            for (const a of due) {
                try {
                    const t = Date.now();
                    await markRun(a.id, {
                        nextRunAt: computeNextRun(a, t),
                        lastRunAt: t,
                    });
                    await run(a);
                } catch (e) {
                    console.error(`automation "${a.name}" failed:`, e);
                }
            }
        } finally {
            ticking = false;
        }
    };

    const id = setInterval(() => void tick(), deps.tickMs ?? 30_000);
    void tick(); // catch up on launch (overdue automations fire once)
    return () => clearInterval(id);
}
