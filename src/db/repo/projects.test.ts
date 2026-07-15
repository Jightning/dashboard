import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb, getDb } from "@/db/client";
import {
    createProject,
    deleteProject,
    getProject,
    listProjects,
    projectCounts,
    updateProject,
} from "./projects";
import {
    createSession,
    getSession,
    listSessions,
    setSessionColor,
    setSessionProject,
} from "./sessions";
import { createBookmark, listBookmarks } from "./library";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

describe("projects repo", () => {
    it("creates, lists, and updates projects", async () => {
        const p = await createProject({ name: "Thesis", color: "#22d3ee" });
        expect(p.name).toBe("Thesis");
        expect(p.color).toBe("#22d3ee");
        expect((await listProjects()).map((x) => x.id)).toEqual([p.id]);

        const updated = await updateProject(p.id, { description: "senior design" });
        expect(updated.description).toBe("senior design");
        expect(updated.name).toBe("Thesis");
    });

    it("rejects empty names and missing ids", async () => {
        await expect(createProject({ name: "  " })).rejects.toThrow(/name/);
        await expect(getProject("prj_missing")).rejects.toThrow(/not found/);
    });

    it("counts grouped rows and unfiles them on delete", async () => {
        const p = await createProject({ name: "Job hunt" });
        const s = await createSession({ title: "resume chat", projectId: p.id });
        await createBookmark({
            title: "Greenhouse",
            url: "https://greenhouse.io",
            projectId: p.id,
        });
        await getDb().execute(
            "INSERT INTO documents (id, title, mime_type, folder, content_text, created_at, project_id) VALUES ('doc_1', 'Resume', 'application/pdf', '/projects/job-hunt', 'text', 0, ?)",
            [p.id],
        );

        expect(await projectCounts(p.id)).toEqual({
            sessions: 1,
            documents: 1,
            bookmarks: 1,
            automations: 0,
        });

        await deleteProject(p.id);
        expect(await listProjects()).toEqual([]);
        // Grouped rows survive, unfiled.
        expect((await getSession(s.id)).project_id).toBeNull();
        expect((await listBookmarks())[0]!.project_id).toBeNull();
        expect(await listSessions()).toHaveLength(1);
    });

    it("filters sessions by project and recolors them", async () => {
        const p = await createProject({ name: "P" });
        const inProj = await createSession({ title: "a", projectId: p.id });
        await createSession({ title: "b" });

        expect((await listSessions({ projectId: p.id })).map((s) => s.id)).toEqual([
            inProj.id,
        ]);
        expect(await listSessions()).toHaveLength(2);

        await setSessionColor(inProj.id, "#f472b6");
        expect((await getSession(inProj.id)).color).toBe("#f472b6");
        await setSessionProject(inProj.id, null);
        expect(await listSessions({ projectId: p.id })).toEqual([]);
    });
});
