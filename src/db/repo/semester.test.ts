import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { createCourse, deleteCourse, listCourses } from "./courses";
import {
    completeTask,
    createTask,
    getTask,
    listOpenTasks,
    updateTask,
} from "./tasks";
import {
    deleteEventsBySource,
    insertEvent,
    listEventsBetween,
} from "./events";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

describe("courses repo", () => {
    it("creates and lists courses", async () => {
        await createCourse({
            code: "ECE 437",
            name: "Computer Design",
            term: "Fall 2026",
            folder: "/school/ece437",
        });
        const all = await listCourses();
        expect(all).toHaveLength(1);
        expect(all[0]!.folder).toBe("/school/ece437");
        await deleteCourse(all[0]!.id);
        expect(await listCourses()).toHaveLength(0);
    });
});

describe("tasks repo", () => {
    it("orders open tasks by due date with undated last", async () => {
        await createTask({ title: "no due" });
        await createTask({ title: "later", dueAt: Date.now() + 2_000_000 });
        await createTask({ title: "sooner", dueAt: Date.now() + 1_000_000 });
        const open = await listOpenTasks();
        expect(open.map((t) => t.title)).toEqual(["sooner", "later", "no due"]);
    });

    it("completing a one-shot task closes it with no follow-up", async () => {
        const t = await createTask({ title: "once", dueAt: Date.now() });
        const next = await completeTask(t.id);
        expect(next).toBeNull();
        expect((await getTask(t.id)).completed_at).not.toBeNull();
        expect(await listOpenTasks()).toHaveLength(0);
    });

    it("completing a recurring task rolls a new one forward", async () => {
        const due = new Date(2026, 7, 24, 9, 0).getTime();
        const t = await createTask({
            title: "gym",
            dueAt: due,
            recurrence: "weekly",
        });
        const next = await completeTask(t.id);
        expect(next).not.toBeNull();
        expect(next!.due_at).toBe(due + 7 * 86_400_000);
        expect(next!.recurrence).toBe("weekly");
        expect(await listOpenTasks()).toHaveLength(1);
    });

    it("updateTask throws when setting recurrence without dueAt", async () => {
        const t = await createTask({ title: "once", dueAt: Date.now() });
        await expect(
            updateTask(t.id, { title: "modified", recurrence: "weekly" }),
        ).rejects.toThrow(/due date/);
    });
});

describe("events repo", () => {
    it("range-queries and clears by source", async () => {
        const course = await createCourse({
            code: "ECE 437",
            name: "x",
            term: "Fall 2026",
            folder: "/school/ece437",
        });
        await insertEvent({
            courseId: course.id,
            title: "Lecture",
            startsAt: 1_000,
            endsAt: 2_000,
        });
        expect(await listEventsBetween(0, 5_000)).toHaveLength(1);
        expect(await listEventsBetween(3_000, 5_000)).toHaveLength(0);
        await deleteEventsBySource(course.id, "ics");
        expect(await listEventsBetween(0, 5_000)).toHaveLength(0);
    });
});
