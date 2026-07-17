import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import {
    categoryCounts,
    createCategory,
    deleteCategory,
    getCategory,
    listCategories,
    updateCategory,
} from "./categories";
import { createProject, getProject, listProjects } from "./projects";
import { createSession, getSession, listSessions, setSessionCategory } from "./sessions";
import { createTask, listOpenTasks } from "./tasks";
import { createNote, getNote, listNotes } from "./notes";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

describe("categories repo", () => {
    it("creates, lists, updates", async () => {
        const c = await createCategory({ name: "School", color: "#4ade80" });
        expect(c.name).toBe("School");
        expect((await listCategories()).map((x) => x.id)).toEqual([c.id]);
        const u = await updateCategory(c.id, { color: "#f87171" });
        expect(u.color).toBe("#f87171");
        expect(u.name).toBe("School");
        await expect(createCategory({ name: " " })).rejects.toThrow(/name/);
        await expect(getCategory("cat_missing")).rejects.toThrow(/not found/);
    });

    it("attaches everywhere, counts, and detaches on delete", async () => {
        const c = await createCategory({ name: "Career" });
        const p = await createProject({ name: "Job hunt", categoryId: c.id });
        const s = await createSession({ title: "resume", categoryId: c.id });
        const viaProject = await createSession({ title: "cover", projectId: p.id });
        await createTask({ title: "apply", categoryId: c.id });
        const n = await createNote({ title: "targets", categoryId: c.id });

        // A project-filed chat counts toward the project's category.
        expect(await categoryCounts(c.id)).toEqual({
            projects: 1,
            sessions: 2,
            tasks: 1,
            notes: 1,
        });
        expect((await listSessions({ categoryId: c.id })).map((x) => x.id).sort())
            .toEqual([s.id, viaProject.id].sort());
        expect((await listProjects({ categoryId: c.id })).map((x) => x.id)).toEqual([p.id]);
        expect((await listOpenTasks({ categoryId: c.id }))).toHaveLength(1);
        expect((await listNotes({ categoryId: c.id })).map((x) => x.id)).toEqual([n.id]);

        await deleteCategory(c.id);
        expect(await listCategories()).toEqual([]);
        expect((await getProject(p.id)).category_id).toBeNull();
        expect((await getSession(s.id)).category_id).toBeNull();
        expect((await getNote(n.id)).category_id).toBeNull();
    });

    it("recategorizes a session", async () => {
        const c = await createCategory({ name: "X" });
        const s = await createSession({ title: "a" });
        await setSessionCategory(s.id, c.id);
        expect((await getSession(s.id)).category_id).toBe(c.id);
        await setSessionCategory(s.id, null);
        expect((await getSession(s.id)).category_id).toBeNull();
    });
});
