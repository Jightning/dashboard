import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { insertEvent } from "@/db/repo/events";
import { createTask } from "@/db/repo/tasks";
import { createCategory } from "@/db/repo/categories";
import { createApplication, updateApplication } from "@/db/repo/applications";
import { collectCalendarItems } from "./calendarItems";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

const DAY = 86_400_000;

describe("collectCalendarItems", () => {
    it("merges events, due tasks, and follow-ups, sorted by time", async () => {
        const t0 = Date.now();
        const cat = await createCategory({ name: "School", color: "#4ade80" });
        await insertEvent({ title: "Lecture", startsAt: t0 + 2 * DAY, endsAt: t0 + 2 * DAY + 3_600_000 });
        await createTask({ title: "PSet", dueAt: t0 + DAY, categoryId: cat.id });
        const app = await createApplication({ company: "ACME", role: "SWE" });
        await updateApplication(app.id, {
            company: "ACME",
            role: "SWE",
            nextAction: "follow up",
            nextActionAt: t0 + 3 * DAY,
        });

        const items = await collectCalendarItems(t0, t0 + 7 * DAY);
        expect(items.map((i) => i.kind)).toEqual(["task", "event", "application"]);
        expect(items[0]!.categoryId).toBe(cat.id);
        expect(items[0]!.color).toBe("#4ade80");
    });

    it("excludes completed tasks and out-of-range items", async () => {
        const t0 = Date.now();
        await createTask({ title: "far away", dueAt: t0 + 40 * DAY });
        const items = await collectCalendarItems(t0, t0 + 7 * DAY);
        expect(items).toEqual([]);
    });
});
