import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { projectSchema, type Project } from "@/lib/schemas";

export async function createProject(input: {
    name: string;
    description?: string | null;
    color?: string | null;
    categoryId?: string | null;
}): Promise<Project> {
    const name = input.name.trim();
    if (!name) throw new Error("project needs a name");
    const id = newId("prj");
    const t = now();
    await getDb().execute(
        `INSERT INTO projects (id, name, description, color, category_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, name, input.description ?? null, input.color ?? null, input.categoryId ?? null, t, t],
    );
    return getProject(id);
}

export async function getProject(id: string): Promise<Project> {
    const rows = await getDb().select("SELECT * FROM projects WHERE id = ?", [id]);
    if (!rows[0]) throw new Error(`project not found: ${id}`);
    return projectSchema.parse(rows[0]);
}

export async function listProjects(filter?: {
    categoryId?: string;
}): Promise<Project[]> {
    const rows = filter?.categoryId
        ? await getDb().select(
              "SELECT * FROM projects WHERE category_id = ? ORDER BY updated_at DESC",
              [filter.categoryId],
          )
        : await getDb().select(
              "SELECT * FROM projects ORDER BY updated_at DESC",
          );
    return rows.map((r) => projectSchema.parse(r));
}

export async function setProjectCategory(
    id: string,
    categoryId: string | null,
): Promise<void> {
    await getDb().execute(
        "UPDATE projects SET category_id = ?, updated_at = ? WHERE id = ?",
        [categoryId, now(), id],
    );
}

export async function updateProject(
    id: string,
    input: { name?: string; description?: string | null; color?: string | null },
): Promise<Project> {
    const cur = await getProject(id);
    await getDb().execute(
        "UPDATE projects SET name = ?, description = ?, color = ?, updated_at = ? WHERE id = ?",
        [
            input.name?.trim() || cur.name,
            input.description === undefined ? cur.description : input.description,
            input.color === undefined ? cur.color : input.color,
            now(),
            id,
        ],
    );
    return getProject(id);
}

/**
 * Unfiles everything the project grouped, then removes it. Explicit UPDATEs
 * (not FK cascades) so tauri, wasm, and better-sqlite3 clients behave the same.
 */
export async function deleteProject(id: string): Promise<void> {
    const db = getDb();
    for (const table of ["chat_sessions", "documents", "bookmarks", "automations"]) {
        await db.execute(
            `UPDATE ${table} SET project_id = NULL WHERE project_id = ?`,
            [id],
        );
    }
    await db.execute("DELETE FROM projects WHERE id = ?", [id]);
}

export interface ProjectCounts {
    sessions: number;
    documents: number;
    bookmarks: number;
    automations: number;
}

export async function projectCounts(id: string): Promise<ProjectCounts> {
    const rows = await getDb().select<ProjectCounts>(
        `SELECT
            (SELECT COUNT(*) FROM chat_sessions WHERE project_id = ?) AS sessions,
            (SELECT COUNT(*) FROM documents WHERE project_id = ?) AS documents,
            (SELECT COUNT(*) FROM bookmarks WHERE project_id = ?) AS bookmarks,
            (SELECT COUNT(*) FROM automations WHERE project_id = ?) AS automations`,
        [id, id, id, id],
    );
    if (!rows[0]) throw new Error(`counts query returned no row for ${id}`);
    return rows[0];
}
