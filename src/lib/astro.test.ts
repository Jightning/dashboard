import { describe, expect, it } from "vitest";
import { julianDate, moonPhase } from "./astro";

// Reference new moon: 2000-01-06 18:14 UTC.
const EPOCH = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC_DAYS = 29.530588853;
const DAY = 86_400_000;

describe("julianDate", () => {
    it("matches the Unix-epoch identity", () => {
        // 1970-01-01T00:00Z is JD 2440587.5 by definition.
        expect(julianDate(0)).toBeCloseTo(2440587.5, 6);
    });

    it("advances one unit per day", () => {
        expect(julianDate(DAY) - julianDate(0)).toBeCloseTo(1, 9);
    });
});

describe("moonPhase", () => {
    it("is new at the reference epoch", () => {
        const m = moonPhase(EPOCH);
        expect(m.ageDays).toBeCloseTo(0, 3);
        expect(m.illumination).toBeCloseTo(0, 3);
        expect(m.name).toBe("new");
    });

    it("is full half a synodic month later", () => {
        const m = moonPhase(EPOCH + (SYNODIC_DAYS / 2) * DAY);
        expect(m.illumination).toBeGreaterThan(0.99);
        expect(m.name).toBe("full");
    });

    it("waxes through first quarter at ~50% lit", () => {
        const m = moonPhase(EPOCH + (SYNODIC_DAYS / 4) * DAY);
        expect(m.illumination).toBeCloseTo(0.5, 1);
        expect(m.name).toBe("first quarter");
    });

    it("wanes after full", () => {
        const m = moonPhase(EPOCH + SYNODIC_DAYS * 0.6 * DAY);
        expect(m.name).toContain("waning");
    });
});
