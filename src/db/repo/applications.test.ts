import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import {
    createApplication,
    getApplication,
    listApplicationEvents,
    listApplications,
    listFollowUpsDue,
    setApplicationStatus,
    updateApplication,
} from "./applications";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

describe("applications repo", () => {
    it("creates as interested and logs status transitions", async () => {
        const app = await createApplication({
            company: "Anthropic",
            role: "SWE Intern",
            url: "https://example.com/job",
        });
        expect(app.status).toBe("interested");
        expect(app.applied_at).toBeNull();

        await setApplicationStatus(app.id, "applied", "via portal");
        const applied = await getApplication(app.id);
        expect(applied.status).toBe("applied");
        expect(applied.applied_at).not.toBeNull();

        await setApplicationStatus(app.id, "oa");
        const events = await listApplicationEvents(app.id);
        expect(events.map((e) => e.status)).toEqual(["oa", "applied"]);
        // applied_at is stamped once, not on later transitions.
        expect((await getApplication(app.id)).applied_at).toBe(
            applied.applied_at,
        );
    });

    it("filters by status", async () => {
        const a = await createApplication({ company: "A", role: "r" });
        await createApplication({ company: "B", role: "r" });
        await setApplicationStatus(a.id, "applied");
        expect(await listApplications("applied")).toHaveLength(1);
        expect(await listApplications()).toHaveLength(2);
    });

    it("surfaces due follow-ups", async () => {
        const app = await createApplication({ company: "C", role: "r" });
        await updateApplication(app.id, {
            company: "C",
            role: "r",
            nextAction: "email recruiter",
            nextActionAt: Date.now() - 1000,
        });
        const due = await listFollowUpsDue(Date.now());
        expect(due).toHaveLength(1);
        expect(due[0]!.next_action).toBe("email recruiter");
    });
});
