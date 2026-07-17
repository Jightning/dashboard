import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { chatSessionSchema, type ChatSession } from "@/lib/schemas";

export async function createSession(opts: {
    title?: string;
    presetId?: string | null;
    permissionLevelId?: string | null;
    projectId?: string | null;
    categoryId?: string | null;
}): Promise<ChatSession> {
    const id = newId("ses");
    const t = now();
    await getDb().execute(
        `INSERT INTO chat_sessions (id, title, preset_id, permission_level_id, project_id, category_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            opts.title ?? "New chat",
            opts.presetId ?? null,
            opts.permissionLevelId ?? null,
            opts.projectId ?? null,
            opts.categoryId ?? null,
            t,
            t,
        ],
    );
    return getSession(id);
}

export async function getSession(id: string): Promise<ChatSession> {
    const rows = await getDb().select(
        "SELECT * FROM chat_sessions WHERE id = ?",
        [id],
    );
    if (!rows[0]) throw new Error(`chat session not found: ${id}`);
    return chatSessionSchema.parse(rows[0]);
}

export async function listSessions(filter?: {
    projectId?: string;
    categoryId?: string;
}): Promise<ChatSession[]> {
    let rows;
    if (filter?.projectId) {
        rows = await getDb().select(
            "SELECT * FROM chat_sessions WHERE project_id = ? ORDER BY updated_at DESC",
            [filter.projectId],
        );
    } else if (filter?.categoryId) {
        rows = await getDb().select(
            `SELECT * FROM chat_sessions
             WHERE category_id = ?
                OR (category_id IS NULL
                    AND project_id IN (SELECT id FROM projects WHERE category_id = ?))
             ORDER BY updated_at DESC`,
            [filter.categoryId, filter.categoryId],
        );
    } else {
        rows = await getDb().select(
            "SELECT * FROM chat_sessions ORDER BY updated_at DESC",
        );
    }
    return rows.map((r) => chatSessionSchema.parse(r));
}

export async function touchSession(id: string): Promise<void> {
    await getDb().execute(
        "UPDATE chat_sessions SET updated_at = ? WHERE id = ?",
        [now(), id],
    );
}

export async function renameSession(id: string, title: string): Promise<void> {
    await getDb().execute(
        "UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?",
        [title, now(), id],
    );
}

export async function setSessionPermissionLevel(
    id: string,
    permissionLevelId: string | null,
): Promise<void> {
    await getDb().execute(
        "UPDATE chat_sessions SET permission_level_id = ?, updated_at = ? WHERE id = ?",
        [permissionLevelId, now(), id],
    );
}

export async function setCompactionSummary(
    id: string,
    summary: string,
): Promise<void> {
    await getDb().execute(
        "UPDATE chat_sessions SET compaction_summary = ?, updated_at = ? WHERE id = ?",
        [summary, now(), id],
    );
}

export async function deleteSession(id: string): Promise<void> {
    await getDb().execute("DELETE FROM messages_fts WHERE session_id = ?", [id]);
    await getDb().execute("DELETE FROM chat_messages WHERE session_id = ?", [id]);
    await getDb().execute("DELETE FROM chat_sessions WHERE id = ?", [id]);
}

export async function setSessionCategory(
    id: string,
    categoryId: string | null,
): Promise<void> {
    await getDb().execute(
        "UPDATE chat_sessions SET category_id = ?, updated_at = ? WHERE id = ?",
        [categoryId, now(), id],
    );
}

/** Model-generated metadata. Does not touch updated_at — metadata isn't activity. */
export async function setSessionMeta(
    id: string,
    meta: { summary: string | null; tags: string[] },
): Promise<void> {
    await getDb().execute(
        "UPDATE chat_sessions SET auto_summary = ?, auto_tags_json = ? WHERE id = ?",
        [meta.summary, JSON.stringify(meta.tags), id],
    );
}

export async function setSessionColor(
    id: string,
    color: string | null,
): Promise<void> {
    await getDb().execute(
        "UPDATE chat_sessions SET color = ?, updated_at = ? WHERE id = ?",
        [color, now(), id],
    );
}

export async function setSessionProject(
    id: string,
    projectId: string | null,
): Promise<void> {
    await getDb().execute(
        "UPDATE chat_sessions SET project_id = ?, updated_at = ? WHERE id = ?",
        [projectId, now(), id],
    );
}
