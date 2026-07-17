import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { courseSchema, type Course } from "@/lib/schemas";
import { normalizeFolder } from "./documents";

export async function createCourse(input: {
    code: string;
    name: string;
    term: string;
    folder: string;
    color?: string | null;
}): Promise<Course> {
    const id = newId("crs");
    const t = now();
    await getDb().execute(
        `INSERT INTO courses (id, code, name, term, folder, color, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            input.code,
            input.name,
            input.term,
            normalizeFolder(input.folder),
            input.color ?? null,
            t,
        ],
    );
    // A course is also a category (migration 0012 did this for existing rows).
    await getDb().execute(
        `INSERT OR IGNORE INTO categories (id, name, color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [newId("cat"), input.code, input.color ?? null, t, t],
    );
    await getDb().execute(
        "UPDATE courses SET category_id = (SELECT id FROM categories WHERE name = ?) WHERE id = ?",
        [input.code, id],
    );
    const rows = await getDb().select("SELECT * FROM courses WHERE id = ?", [id]);
    return courseSchema.parse(rows[0]);
}

export async function listCourses(): Promise<Course[]> {
    const rows = await getDb().select(
        "SELECT * FROM courses ORDER BY term DESC, code ASC",
    );
    return rows.map((r) => courseSchema.parse(r));
}

export async function deleteCourse(id: string): Promise<void> {
    await getDb().execute("DELETE FROM courses WHERE id = ?", [id]);
}
