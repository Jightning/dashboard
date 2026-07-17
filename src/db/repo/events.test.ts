import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { deleteEvent, insertEvent, listEventsBetween } from "./events";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

describe("manual events", () => {
    it("creates with source manual and deletes by id", async () => {
        const t0 = Date.now();
        const e = await insertEvent({
            title: "Dentist",
            startsAt: t0 + 3_600_000,
            endsAt: t0 + 5_400_000,
            location: "Lafayette",
            source: "manual",
        });
        expect(e.source).toBe("manual");
        expect(await listEventsBetween(t0, t0 + 86_400_000)).toHaveLength(1);
        await deleteEvent(e.id);
        expect(await listEventsBetween(t0, t0 + 86_400_000)).toHaveLength(0);
    });
});
