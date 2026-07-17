import { useEffect, useState } from "react";
import { listOpenTasks } from "@/db/repo/tasks";
import { listAutomations } from "@/db/repo/automations";
import { relativeTime } from "@/components/hud/networkData";
import type { NavTarget } from "@/app/Sidebar";

function endOfToday(): number {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
}

/**
 * Live almanac readouts for the status bar: open tasks due today and the
 * next scheduled automation. Refreshes every minute; failures leave the
 * previous values (the status bar must never error).
 */
export function StatusReadouts({
    onNavigate,
}: {
    onNavigate: (t: NavTarget) => void;
}) {
    const [dueToday, setDueToday] = useState<number | null>(null);
    const [nextRun, setNextRun] = useState<number | null>(null);

    useEffect(() => {
        const refresh = async () => {
            try {
                setDueToday((await listOpenTasks({ dueBefore: endOfToday() })).length);
                const autos = await listAutomations();
                const next = autos
                    .filter((a) => a.enabled === 1 && a.next_run_at !== null)
                    .map((a) => a.next_run_at!)
                    .sort((a, b) => a - b)[0];
                setNextRun(next ?? null);
            } catch {
                // keep last values
            }
        };
        void refresh();
        const timer = setInterval(() => void refresh(), 60_000);
        return () => clearInterval(timer);
    }, []);

    return (
        <>
            {dueToday !== null && dueToday > 0 && (
                <button
                    className="cursor-pointer hover:text-foreground"
                    onClick={() => onNavigate({ page: "planner", tab: "tasks" })}
                >
                    {dueToday} due today
                </button>
            )}
            {nextRun !== null && (
                <button
                    className="cursor-pointer hover:text-foreground"
                    onClick={() => onNavigate({ page: "agents", tab: "automations" })}
                >
                    next run {relativeTime(nextRun)}
                </button>
            )}
        </>
    );
}
