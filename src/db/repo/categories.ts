import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { categorySchema, type Category } from "@/lib/schemas";

export async function createCategory(input: {
    name: string;
    color?: string | null;
}): Promise<Category> {
    const name = input.name.trim();
    if (!name) throw new Error("category needs a name");
    const id = newId("cat");
    const t = now();
    await getDb().execute(
        `INSERT INTO categories (id, name, color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, name, input.color ?? null, t, t],
    );
    return getCategory(id);
}

export async function getCategory(id: string): Promise<Category> {
    const rows = await getDb().select("SELECT * FROM categories WHERE id = ?", [id]);
    if (!rows[0]) throw new Error(`category not found: ${id}`);
    return categorySchema.parse(rows[0]);
}

export async function listCategories(): Promise<Category[]> {
    const rows = await getDb().select("SELECT * FROM categories ORDER BY name ASC");
    return rows.map((r) => categorySchema.parse(r));
}

export async function updateCategory(
    id: string,
    input: { name?: string; color?: string | null },
): Promise<Category> {
    const cur = await getCategory(id);
    await getDb().execute(
        "UPDATE categories SET name = ?, color = ?, updated_at = ? WHERE id = ?",
        [
            input.name?.trim() || cur.name,
            input.color === undefined ? cur.color : input.color,
            now(),
            id,
        ],
    );
    return getCategory(id);
}

/**
 * Detaches everything tagged with the category, then removes it. Explicit
 * UPDATEs (not FK cascades) so tauri, wasm, and better-sqlite3 clients
 * behave the same. Content is never deleted.
 */
export async function deleteCategory(id: string): Promise<void> {
    const db = getDb();
    for (const table of ["projects", "tasks", "notes", "chat_sessions", "courses"]) {
        await db.execute(
            `UPDATE ${table} SET category_id = NULL WHERE category_id = ?`,
            [id],
        );
    }
    await db.execute("DELETE FROM categories WHERE id = ?", [id]);
}

export interface CategoryCounts {
    projects: number;
    sessions: number;
    tasks: number;
    notes: number;
}

/** Session count includes chats filed under the category's projects. */
export async function categoryCounts(id: string): Promise<CategoryCounts> {
    const rows = await getDb().select<CategoryCounts>(
        `SELECT
            (SELECT COUNT(*) FROM projects WHERE category_id = ?) AS projects,
            (SELECT COUNT(*) FROM chat_sessions WHERE category_id = ?
                OR (category_id IS NULL
                    AND project_id IN (SELECT id FROM projects WHERE category_id = ?))) AS sessions,
            (SELECT COUNT(*) FROM tasks WHERE category_id = ? AND completed_at IS NULL) AS tasks,
            (SELECT COUNT(*) FROM notes WHERE category_id = ?) AS notes`,
        [id, id, id, id, id],
    );
    if (!rows[0]) throw new Error(`counts query returned no row for ${id}`);
    return rows[0];
}
