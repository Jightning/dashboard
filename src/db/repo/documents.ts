import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { documentSchema, type Document } from "@/lib/schemas";

export async function insertDocument(opts: {
    title: string;
    contentText: string;
    mimeType: string;
    folder?: string;
    sourceName?: string | null;
    byteSize?: number | null;
    pageCount?: number | null;
    projectId?: string | null;
}): Promise<Document> {
    const id = newId("doc");
    await getDb().execute(
        `INSERT INTO documents
       (id, title, source_name, mime_type, folder, content_text, byte_size, page_count, project_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            opts.title,
            opts.sourceName ?? null,
            opts.mimeType,
            normalizeFolder(opts.folder ?? "/"),
            opts.contentText,
            opts.byteSize ?? null,
            opts.pageCount ?? null,
            opts.projectId ?? null,
            now(),
        ],
    );
    return getDocument(id);
}

export async function getDocument(id: string): Promise<Document> {
    const rows = await getDb().select("SELECT * FROM documents WHERE id = ?", [
        id,
    ]);
    if (!rows[0]) throw new Error(`document not found: ${id}`);
    return documentSchema.parse(rows[0]);
}

export async function listDocuments(
    folder?: string,
): Promise<Omit<Document, "content_text">[]> {
    const sql =
        "SELECT id, title, source_name, mime_type, folder, '' AS content_text, byte_size, page_count, project_id, created_at FROM documents";
    const normalized = folder ? normalizeFolder(folder) : null;
    const scoped =
        normalized !== null && normalized !== "/" ? normalized : null;
    const rows = scoped
        ? await getDb().select(
              `${sql} WHERE folder = ? OR folder LIKE ? ORDER BY created_at DESC`,
              [scoped, `${scoped}/%`],
          )
        : await getDb().select(`${sql} ORDER BY created_at DESC`);
    return rows.map((r) => documentSchema.parse(r));
}

/** Metadata-only listing for a project's Files panel. */
export async function listProjectDocuments(projectId: string): Promise<Document[]> {
    const rows = await getDb().select(
        `SELECT id, title, source_name, mime_type, folder, '' AS content_text,
                byte_size, page_count, project_id, created_at
         FROM documents WHERE project_id = ? ORDER BY created_at DESC`,
        [projectId],
    );
    return rows.map((r) => documentSchema.parse(r));
}

export interface DocumentSearchHit {
    id: string;
    title: string;
    folder: string;
    snippet: string;
}

export async function searchDocuments(
    query: string,
    opts: { folder?: string; limit?: number } = {},
): Promise<DocumentSearchHit[]> {
    const fts = toFtsQuery(query);
    if (!fts) return [];
    const normalized = opts.folder ? normalizeFolder(opts.folder) : null;
    const folder = normalized === "/" ? null : normalized;
    const folderClause = folder ? "AND (d.folder = ? OR d.folder LIKE ?)" : "";
    const params: unknown[] = folder
        ? [fts, folder, `${folder}/%`, opts.limit ?? 10]
        : [fts, opts.limit ?? 10];
    const rows = await getDb().select<DocumentSearchHit>(
        `SELECT d.id, d.title, d.folder,
            snippet(documents_fts, 1, '[', ']', ' … ', 16) AS snippet
     FROM documents_fts
     JOIN documents d ON d.rowid = documents_fts.rowid
     WHERE documents_fts MATCH ? ${folderClause}
     ORDER BY rank
     LIMIT ?`,
        params,
    );
    return rows;
}

export async function deleteDocument(id: string): Promise<void> {
    await getDb().execute("DELETE FROM documents WHERE id = ?", [id]);
}

/**
 * User text → safe FTS5 query: each term becomes a quoted prefix token, so
 * characters that are FTS5 syntax (-, *, ") can't break the query.
 */
export function toFtsQuery(input: string): string {
    return input
        .split(/\s+/)
        .map((t) => t.replaceAll('"', "").trim())
        .filter(Boolean)
        .map((t) => `"${t}"*`)
        .join(" ");
}

export function normalizeFolder(folder: string): string {
    let f = folder.trim();
    if (!f.startsWith("/")) f = `/${f}`;
    if (f.length > 1 && f.endsWith("/")) f = f.slice(0, -1);
    return f;
}
