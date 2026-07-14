import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import {
    bookmarkSchema,
    snippetSchema,
    type Bookmark,
    type Snippet,
} from "@/lib/schemas";

export async function createBookmark(input: {
    title: string;
    url: string;
    groupName?: string;
}): Promise<Bookmark> {
    const id = newId("bmk");
    await getDb().execute(
        `INSERT INTO bookmarks (id, title, url, group_name, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, input.title, input.url, input.groupName ?? "General", now()],
    );
    const rows = await getDb().select("SELECT * FROM bookmarks WHERE id = ?", [id]);
    return bookmarkSchema.parse(rows[0]);
}

export async function listBookmarks(): Promise<Bookmark[]> {
    const rows = await getDb().select(
        "SELECT * FROM bookmarks ORDER BY group_name ASC, title ASC",
    );
    return rows.map((r) => bookmarkSchema.parse(r));
}

export async function deleteBookmark(id: string): Promise<void> {
    await getDb().execute("DELETE FROM bookmarks WHERE id = ?", [id]);
}

export async function createSnippet(input: {
    title: string;
    body: string;
}): Promise<Snippet> {
    const id = newId("snp");
    const t = now();
    await getDb().execute(
        `INSERT INTO snippets (id, title, body, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, input.title, input.body, t, t],
    );
    const rows = await getDb().select("SELECT * FROM snippets WHERE id = ?", [id]);
    return snippetSchema.parse(rows[0]);
}

export async function updateSnippet(
    id: string,
    input: { title: string; body: string },
): Promise<void> {
    const res = await getDb().execute(
        "UPDATE snippets SET title = ?, body = ?, updated_at = ? WHERE id = ?",
        [input.title, input.body, now(), id],
    );
    if (res.rowsAffected === 0) throw new Error(`snippet not found: ${id}`);
}

export async function listSnippets(): Promise<Snippet[]> {
    const rows = await getDb().select(
        "SELECT * FROM snippets ORDER BY title ASC",
    );
    return rows.map((r) => snippetSchema.parse(r));
}

export async function deleteSnippet(id: string): Promise<void> {
    await getDb().execute("DELETE FROM snippets WHERE id = ?", [id]);
}

export interface LibraryHit {
    kind: "bookmark" | "snippet";
    id: string;
    title: string;
    detail: string;
}

/** Cheap LIKE search for the palette (tables are tiny; FTS is overkill). */
export async function searchLibrary(query: string): Promise<LibraryHit[]> {
    const like = `%${query.replaceAll("%", "").replaceAll("_", "")}%`;
    const bookmarks = await getDb().select<{ id: string; title: string; url: string }>(
        "SELECT id, title, url FROM bookmarks WHERE title LIKE ? OR url LIKE ? LIMIT 8",
        [like, like],
    );
    const snippets = await getDb().select<{ id: string; title: string; body: string }>(
        "SELECT id, title, body FROM snippets WHERE title LIKE ? OR body LIKE ? LIMIT 8",
        [like, like],
    );
    return [
        ...bookmarks.map((b) => ({
            kind: "bookmark" as const,
            id: b.id,
            title: b.title,
            detail: b.url,
        })),
        ...snippets.map((s) => ({
            kind: "snippet" as const,
            id: s.id,
            title: s.title,
            detail: s.body,
        })),
    ];
}
