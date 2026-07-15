/** Astronomy for the ephemeris strip. Approximations good to the display's
 *  precision (JD to 0.1 day; moon phase to ~half a day) — not for navigation. */

const DAY = 86_400_000;
const SYNODIC_DAYS = 29.530588853;
/** A reference new moon: 2000-01-06 18:14 UTC. */
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14);

/** Julian Date from a Unix timestamp (ms). JD 2440587.5 = 1970-01-01T00:00Z. */
export function julianDate(ms: number): number {
    return ms / DAY + 2440587.5;
}

const PHASE_NAMES = [
    "new",
    "waxing crescent",
    "first quarter",
    "waxing gibbous",
    "full",
    "waning gibbous",
    "last quarter",
    "waning crescent",
] as const;

export function moonPhase(ms: number): {
    ageDays: number;
    illumination: number;
    name: (typeof PHASE_NAMES)[number];
} {
    const ageDays =
        (((ms - NEW_MOON_EPOCH) / DAY) % SYNODIC_DAYS + SYNODIC_DAYS) %
        SYNODIC_DAYS;
    const illumination =
        (1 - Math.cos((2 * Math.PI * ageDays) / SYNODIC_DAYS)) / 2;
    // Eight octants centered on the cardinal phases.
    const octant =
        Math.floor(((ageDays / SYNODIC_DAYS) * 8 + 0.5) % 8);
    return { ageDays, illumination, name: PHASE_NAMES[octant]! };
}
