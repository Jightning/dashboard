import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { chatMessageSchema, type ChatMessage } from "@/lib/schemas";

export interface MessageUsage {
    inputTokens?: number;
    outputTokens?: number;
    cachedInputTokens?: number;
}

export async function insertMessage(opts: {
    sessionId: string;
    role: string;
    partsJson: string;
    agent?: string | null;
    model?: string | null;
    usage?: MessageUsage;
}): Promise<string> {
    const id = newId("msg");
    await getDb().execute(
        `INSERT INTO chat_messages
       (id, session_id, role, parts_json, agent, model,
        input_tokens, output_tokens, cached_input_tokens, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            opts.sessionId,
            opts.role,
            opts.partsJson,
            opts.agent ?? null,
            opts.model ?? null,
            opts.usage?.inputTokens ?? null,
            opts.usage?.outputTokens ?? null,
            opts.usage?.cachedInputTokens ?? null,
            now(),
        ],
    );
    return id;
}

export async function listMessages(sessionId: string): Promise<ChatMessage[]> {
    const rows = await getDb().select(
        "SELECT * FROM chat_messages WHERE session_id = ? ORDER BY rowid ASC",
        [sessionId],
    );
    return rows.map((r) => chatMessageSchema.parse(r));
}

/** Messages still in the active context window (not summarized away). */
export async function listActiveMessages(
    sessionId: string,
): Promise<ChatMessage[]> {
    const rows = await getDb().select(
        "SELECT * FROM chat_messages WHERE session_id = ? AND compacted = 0 ORDER BY rowid ASC",
        [sessionId],
    );
    return rows.map((r) => chatMessageSchema.parse(r));
}

export async function markCompacted(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => "?").join(", ");
    await getDb().execute(
        `UPDATE chat_messages SET compacted = 1 WHERE id IN (${placeholders})`,
        ids,
    );
}

export async function sessionMessageCount(sessionId: string): Promise<number> {
    const rows = await getDb().select<{ n: number }>(
        "SELECT COUNT(*) AS n FROM chat_messages WHERE session_id = ?",
        [sessionId],
    );
    return rows[0]?.n ?? 0;
}

export interface SessionUsageTotals {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
}

export async function sessionUsageTotals(
    sessionId: string,
): Promise<SessionUsageTotals> {
    const rows = await getDb().select<{
        input_tokens: number | null;
        output_tokens: number | null;
        cached_input_tokens: number | null;
    }>(
        `SELECT COALESCE(SUM(input_tokens), 0) AS input_tokens,
            COALESCE(SUM(output_tokens), 0) AS output_tokens,
            COALESCE(SUM(cached_input_tokens), 0) AS cached_input_tokens
     FROM chat_messages WHERE session_id = ?`,
        [sessionId],
    );
    const r = rows[0];
    return {
        inputTokens: r?.input_tokens ?? 0,
        outputTokens: r?.output_tokens ?? 0,
        cachedInputTokens: r?.cached_input_tokens ?? 0,
    };
}
