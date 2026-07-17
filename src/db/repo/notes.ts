import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { noteSchema, type Note, type NoteSummary } from "@/lib/schemas";
// Folder normalization and the safe FTS query builder are shared with documents.
import { normalizeFolder, toFtsQuery } from "./documents";

export async function createNote(opts: {
    title?: string;
    folder?: string;
    bodyMd?: string;
    categoryId?: string | null;
}): Promise<Note> {
    const id = newId("note");
    const ts = now();
    await getDb().execute(
        `INSERT INTO notes (id, title, folder, body_md, category_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            opts.title?.trim() || "Untitled",
            normalizeFolder(opts.folder ?? "/"),
            opts.bodyMd ?? "",
            opts.categoryId ?? null,
            ts,
            ts,
        ],
    );
    return getNote(id);
}

export async function getNote(id: string): Promise<Note> {
    const rows = await getDb().select("SELECT * FROM notes WHERE id = ?", [id]);
    if (!rows[0]) throw new Error(`note not found: ${id}`);
    return noteSchema.parse(rows[0]);
}

export async function listNotes(filter?: {
    folder?: string;
    categoryId?: string;
}): Promise<NoteSummary[]> {
    const sql =
        "SELECT id, title, folder, category_id, created_at, updated_at FROM notes";
    const where: string[] = [];
    const params: unknown[] = [];
    const normalized = filter?.folder ? normalizeFolder(filter.folder) : null;
    if (normalized !== null && normalized !== "/") {
        where.push("(folder = ? OR folder LIKE ?)");
        params.push(normalized, `${normalized}/%`);
    }
    if (filter?.categoryId !== undefined) {
        where.push("category_id = ?");
        params.push(filter.categoryId);
    }
    const rows = await getDb().select(
        `${sql}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY updated_at DESC`,
        params,
    );
    return rows.map((r) => noteSchema.omit({ body_md: true }).parse(r));
}

export async function updateNote(
    id: string,
    fields: { title: string; folder: string; bodyMd: string; categoryId?: string | null },
): Promise<void> {
    // categoryId is optional so existing callers that only edit title/folder/body
    // (e.g. NotesPage's autosave) don't silently clear a note's category:
    // undefined preserves the current value, null explicitly clears it.
    const cur = await getNote(id);
    const res = await getDb().execute(
        `UPDATE notes SET title = ?, folder = ?, body_md = ?, category_id = ?, updated_at = ?
         WHERE id = ?`,
        [
            fields.title.trim() || "Untitled",
            normalizeFolder(fields.folder),
            fields.bodyMd,
            fields.categoryId === undefined ? cur.category_id : fields.categoryId,
            now(),
            id,
        ],
    );
    if (res.rowsAffected === 0) throw new Error(`note not found: ${id}`);
}

export async function deleteNote(id: string): Promise<void> {
    await getDb().execute("DELETE FROM notes WHERE id = ?", [id]);
}

export interface NoteSearchHit {
    id: string;
    title: string;
    folder: string;
    snippet: string;
}

export async function searchNotes(
    query: string,
    opts: { folder?: string; limit?: number } = {},
): Promise<NoteSearchHit[]> {
    const fts = toFtsQuery(query);
    if (!fts) return [];
    const normalized = opts.folder ? normalizeFolder(opts.folder) : null;
    const folder = normalized === "/" ? null : normalized;
    const folderClause = folder ? "AND (n.folder = ? OR n.folder LIKE ?)" : "";
    const params: unknown[] = folder
        ? [fts, folder, `${folder}/%`, opts.limit ?? 10]
        : [fts, opts.limit ?? 10];
    return getDb().select<NoteSearchHit>(
        `SELECT n.id, n.title, n.folder,
            snippet(notes_fts, 1, '[', ']', ' … ', 16) AS snippet
         FROM notes_fts
         JOIN notes n ON n.rowid = notes_fts.rowid
         WHERE notes_fts MATCH ? ${folderClause}
         ORDER BY rank
         LIMIT ?`,
        params,
    );
}
