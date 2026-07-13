import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { eventSchema, type CalendarEvent } from "@/lib/schemas";

export async function insertEvent(input: {
    courseId?: string | null;
    title: string;
    location?: string | null;
    startsAt: number;
    endsAt: number;
    source?: string;
}): Promise<CalendarEvent> {
    const id = newId("evt");
    await getDb().execute(
        `INSERT INTO events (id, course_id, title, location, starts_at, ends_at, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            input.courseId ?? null,
            input.title,
            input.location ?? null,
            input.startsAt,
            input.endsAt,
            input.source ?? "ics",
            now(),
        ],
    );
    const rows = await getDb().select("SELECT * FROM events WHERE id = ?", [id]);
    return eventSchema.parse(rows[0]);
}

export async function listEventsBetween(
    from: number,
    to: number,
): Promise<CalendarEvent[]> {
    const rows = await getDb().select(
        `SELECT * FROM events WHERE starts_at >= ? AND starts_at < ?
         ORDER BY starts_at ASC`,
        [from, to],
    );
    return rows.map((r) => eventSchema.parse(r));
}

/** Clear a course's imported events before re-importing a semester's ICS. */
export async function deleteEventsBySource(
    courseId: string,
    source: string,
): Promise<void> {
    await getDb().execute(
        "DELETE FROM events WHERE course_id = ? AND source = ?",
        [courseId, source],
    );
}
