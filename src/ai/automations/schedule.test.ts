import { describe, expect, it } from "vitest";
import type { Automation } from "@/lib/schemas";
import { computeNextRun } from "./schedule";

function auto(overrides: Partial<Automation>): Automation {
    return {
        id: "aut_1",
        name: "A",
        pipeline_id: "pip_1",
        schedule_kind: "interval",
        interval_minutes: null,
        time_of_day: null,
        day_of_week: null,
        input_template: "",
        permission_level_id: null,
        output_note_folder: null,
        enabled: 1,
        next_run_at: null,
        last_run_at: null,
        created_at: 0,
        updated_at: 0,
        ...overrides,
    };
}

describe("computeNextRun", () => {
    it("interval: now + N minutes", () => {
        const from = Date.UTC(2026, 6, 11, 12, 0, 0);
        expect(
            computeNextRun(
                auto({ schedule_kind: "interval", interval_minutes: 30 }),
                from,
            ),
        ).toBe(from + 30 * 60_000);
    });

    it("interval: rejects missing/zero minutes", () => {
        expect(() =>
            computeNextRun(auto({ schedule_kind: "interval" }), 0),
        ).toThrow(/interval_minutes/);
    });

    it("daily: later today if the time is still ahead", () => {
        const from = new Date(2026, 6, 11, 8, 0, 0).getTime(); // local 08:00
        const next = computeNextRun(
            auto({ schedule_kind: "daily", time_of_day: "09:30" }),
            from,
        );
        const d = new Date(next);
        expect([d.getHours(), d.getMinutes(), d.getDate()]).toEqual([9, 30, 11]);
    });

    it("daily: tomorrow if the time already passed", () => {
        const from = new Date(2026, 6, 11, 10, 0, 0).getTime();
        const d = new Date(
            computeNextRun(
                auto({ schedule_kind: "daily", time_of_day: "09:30" }),
                from,
            ),
        );
        expect(d.getDate()).toBe(12);
    });

    it("weekly: next matching weekday at the given time", () => {
        // 2026-07-11 is a Saturday (getDay() === 6).
        const from = new Date(2026, 6, 11, 10, 0, 0).getTime();
        const d = new Date(
            computeNextRun(
                auto({
                    schedule_kind: "weekly",
                    time_of_day: "07:00",
                    day_of_week: 1, // Monday
                }),
                from,
            ),
        );
        expect([d.getDay(), d.getHours(), d.getDate()]).toEqual([1, 7, 13]);
    });

    it("daily: rejects malformed time_of_day", () => {
        expect(() =>
            computeNextRun(
                auto({ schedule_kind: "daily", time_of_day: "9am" }),
                0,
            ),
        ).toThrow(/time_of_day/);
    });
});
