import { describe, expect, it } from "vitest";
import { reviewCard } from "./sm2";

const DAY = 86_400_000;
const fresh = { ease: 2.5, intervalDays: 0, reps: 0 };

describe("reviewCard (SM-2)", () => {
    it("first Good = 1 day, second = 6 days, then interval * ease", () => {
        const now = 0;
        const r1 = reviewCard(fresh, 4, now);
        expect(r1.intervalDays).toBe(1);
        expect(r1.dueAt).toBe(now + 1 * DAY);

        const r2 = reviewCard(r1, 4, r1.dueAt);
        expect(r2.intervalDays).toBe(6);

        const r3 = reviewCard(r2, 4, r2.dueAt);
        expect(r3.intervalDays).toBe(Math.round(6 * r2.ease));
    });

    it("Again resets reps and requeues in 10 minutes, easing down", () => {
        const seasoned = { ease: 2.5, intervalDays: 20, reps: 5 };
        const r = reviewCard(seasoned, 0, 1_000_000);
        expect(r.reps).toBe(0);
        expect(r.intervalDays).toBe(0);
        expect(r.dueAt).toBe(1_000_000 + 10 * 60_000);
        expect(r.ease).toBeLessThan(2.5);
    });

    it("Easy grows ease, Hard shrinks it, floor at 1.3", () => {
        expect(reviewCard(fresh, 5, 0).ease).toBeGreaterThan(2.5);
        expect(reviewCard(fresh, 3, 0).ease).toBeLessThan(2.5);
        const floor = reviewCard({ ease: 1.3, intervalDays: 1, reps: 2 }, 3, 0);
        expect(floor.ease).toBe(1.3);
    });
});
