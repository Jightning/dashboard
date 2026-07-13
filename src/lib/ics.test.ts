import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { createCourse } from "@/db/repo/courses";
import { listEventsBetween } from "@/db/repo/events";
import { importClassSchedule, parseIcsEvents } from "./ics";

// A weekly MWF lecture, 4 occurrences, as university registrars export them.
const ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:ece437-lec@example.edu
SUMMARY:ECE 437 Lecture
LOCATION:EE 129
DTSTART:20260824T093000
DTEND:20260824T102000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=4
END:VEVENT
BEGIN:VEVENT
UID:onetime@example.edu
SUMMARY:Career Fair
DTSTART:20260901T100000
DTEND:20260901T160000
END:VEVENT
END:VCALENDAR`;

const FROM = new Date(2026, 7, 1).getTime();
const UNTIL = new Date(2026, 11, 20).getTime();

describe("parseIcsEvents", () => {
    it("expands recurring events into concrete occurrences", () => {
        const events = parseIcsEvents(ICS, { from: FROM, until: UNTIL });
        const lectures = events.filter((e) => e.title === "ECE 437 Lecture");
        expect(lectures).toHaveLength(4);
        expect(lectures[0]!.location).toBe("EE 129");
        // 50-minute lecture.
        expect(lectures[0]!.endsAt - lectures[0]!.startsAt).toBe(50 * 60_000);
    });

    it("includes one-off events and respects the range", () => {
        const events = parseIcsEvents(ICS, { from: FROM, until: UNTIL });
        expect(events.some((e) => e.title === "Career Fair")).toBe(true);
        const outOfRange = parseIcsEvents(ICS, {
            from: new Date(2027, 0, 1).getTime(),
            until: new Date(2027, 5, 1).getTime(),
        });
        expect(outOfRange).toHaveLength(0);
    });

    it("throws on garbage input", () => {
        expect(() =>
            parseIcsEvents("not an ics file", { from: 0, until: 1 }),
        ).toThrow();
    });
});

describe("importClassSchedule", () => {
    let db: ReturnType<typeof createTestDbClient>;
    beforeEach(() => {
        db = createTestDbClient();
        setDb(db);
    });
    afterEach(() => db.close());

    it("replaces prior imported events for the course", async () => {
        const course = await createCourse({
            code: "ECE 437",
            name: "Computer Design",
            term: "Fall 2026",
            folder: "/school/ece437",
        });
        const first = await importClassSchedule({
            courseId: course.id,
            icsText: ICS,
            from: FROM,
            until: UNTIL,
        });
        expect(first).toBe(5); // 4 lectures + career fair
        // Re-import must not duplicate.
        await importClassSchedule({
            courseId: course.id,
            icsText: ICS,
            from: FROM,
            until: UNTIL,
        });
        expect(await listEventsBetween(FROM, UNTIL)).toHaveLength(5);
    });
});
