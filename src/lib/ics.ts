import ICAL from "ical.js";
import { deleteEventsBySource, insertEvent } from "@/db/repo/events";

export interface ParsedEvent {
    title: string;
    location: string | null;
    startsAt: number;
    endsAt: number;
}

/**
 * Flattens an ICS calendar into concrete occurrences inside [from, until].
 * Recurring VEVENTs (the registrar's MWF lectures) are expanded via ical.js's
 * iterator; the until-bound also caps unbounded RRULEs safely.
 */
export function parseIcsEvents(
    icsText: string,
    range: { from: number; until: number },
): ParsedEvent[] {
    const component = new ICAL.Component(ICAL.parse(icsText));
    const out: ParsedEvent[] = [];

    for (const vevent of component.getAllSubcomponents("vevent")) {
        const event = new ICAL.Event(vevent);
        const durationMs = event.duration.toSeconds() * 1000;

        if (event.isRecurring()) {
            const iterator = event.iterator();
            let next: ICAL.Time | null;
            while ((next = iterator.next())) {
                const startsAt = next.toJSDate().getTime();
                if (startsAt > range.until) break;
                if (startsAt < range.from) continue;
                out.push({
                    title: event.summary,
                    location: event.location || null,
                    startsAt,
                    endsAt: startsAt + durationMs,
                });
            }
        } else {
            const startsAt = event.startDate.toJSDate().getTime();
            if (startsAt >= range.from && startsAt <= range.until) {
                out.push({
                    title: event.summary,
                    location: event.location || null,
                    startsAt,
                    endsAt: startsAt + durationMs,
                });
            }
        }
    }
    return out.sort((a, b) => a.startsAt - b.startsAt);
}

/** Re-importable each semester: clears the course's prior ICS rows first. */
export async function importClassSchedule(opts: {
    courseId: string;
    icsText: string;
    from: number;
    until: number;
}): Promise<number> {
    const events = parseIcsEvents(opts.icsText, {
        from: opts.from,
        until: opts.until,
    });
    await deleteEventsBySource(opts.courseId, "ics");
    for (const e of events) {
        await insertEvent({
            courseId: opts.courseId,
            title: e.title,
            location: e.location,
            startsAt: e.startsAt,
            endsAt: e.endsAt,
            source: "ics",
        });
    }
    return events.length;
}
