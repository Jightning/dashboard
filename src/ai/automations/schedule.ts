import type { Automation } from "@/lib/schemas";

/** Next fire time strictly after `from`, in local time (schedules are human-local). */
export function computeNextRun(a: Automation, from: number): number {
    switch (a.schedule_kind) {
        case "interval": {
            if (!a.interval_minutes || a.interval_minutes < 1)
                throw new Error(
                    `interval schedule requires interval_minutes >= 1 (automation ${a.name})`,
                );
            return from + a.interval_minutes * 60_000;
        }
        case "daily":
            return nextAtTime(from, a.time_of_day, null);
        case "weekly":
            return nextAtTime(from, a.time_of_day, a.day_of_week);
    }
}

function nextAtTime(
    from: number,
    timeOfDay: string | null,
    dayOfWeek: number | null,
): number {
    const match = /^(\d{2}):(\d{2})$/.exec(timeOfDay ?? "");
    if (!match)
        throw new Error(`schedule requires time_of_day as HH:MM, got: ${timeOfDay}`);
    const d = new Date(from);
    d.setHours(Number(match[1]), Number(match[2]), 0, 0);
    if (dayOfWeek === null) {
        if (d.getTime() <= from) d.setDate(d.getDate() + 1);
        return d.getTime();
    }
    if (dayOfWeek < 0 || dayOfWeek > 6)
        throw new Error(`day_of_week must be 0-6, got: ${dayOfWeek}`);
    while (d.getDay() !== dayOfWeek || d.getTime() <= from)
        d.setDate(d.getDate() + 1);
    return d.getTime();
}
