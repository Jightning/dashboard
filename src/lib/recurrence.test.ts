import { describe, expect, it } from "vitest";
import { nextDueDate } from "./recurrence";

describe("nextDueDate", () => {
    it("daily adds one day", () => {
        const due = new Date(2026, 7, 24, 23, 59).getTime();
        expect(new Date(nextDueDate(due, "daily")).getDate()).toBe(25);
    });

    it("weekly adds seven days preserving time", () => {
        const due = new Date(2026, 7, 24, 9, 0).getTime();
        const next = new Date(nextDueDate(due, "weekly"));
        expect([next.getDate(), next.getHours()]).toEqual([31, 9]);
    });

    it("monthly advances the month", () => {
        const due = new Date(2026, 7, 15).getTime(); // Aug 15
        expect(new Date(nextDueDate(due, "monthly")).getMonth()).toBe(8); // Sep
    });
});
