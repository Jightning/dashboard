import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { flashcardSchema, type Flashcard } from "@/lib/schemas";
import { reviewCard, type Grade } from "@/lib/sm2";
import { normalizeFolder } from "./documents";

export async function createFlashcards(
    cards: { front: string; back: string }[],
    opts: { folder: string; sourceNoteId?: string | null },
): Promise<number> {
    if (cards.length === 0)
        throw new Error("createFlashcards needs at least one card");
    const t = now();
    const folder = normalizeFolder(opts.folder);
    for (const c of cards) {
        await getDb().execute(
            `INSERT INTO flashcards
               (id, folder, front, back, source_note_id, ease, interval_days,
                reps, due_at, suspended, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 2.5, 0, 0, ?, 0, ?, ?)`,
            [newId("fc"), folder, c.front, c.back, opts.sourceNoteId ?? null, t, t, t],
        );
    }
    return cards.length;
}

export async function listDueFlashcards(
    nowMs: number,
    limit = 50,
): Promise<Flashcard[]> {
    const rows = await getDb().select(
        `SELECT * FROM flashcards
         WHERE suspended = 0 AND due_at <= ?
         ORDER BY due_at ASC LIMIT ?`,
        [nowMs, limit],
    );
    return rows.map((r) => flashcardSchema.parse(r));
}

export async function countDueFlashcards(nowMs: number): Promise<number> {
    const rows = await getDb().select<{ n: number }>(
        "SELECT COUNT(*) AS n FROM flashcards WHERE suspended = 0 AND due_at <= ?",
        [nowMs],
    );
    return rows[0]?.n ?? 0;
}

export async function applyReview(
    id: string,
    grade: Grade,
    nowMs = now(),
): Promise<Flashcard> {
    const rows = await getDb().select(
        "SELECT * FROM flashcards WHERE id = ?",
        [id],
    );
    if (!rows[0]) throw new Error(`flashcard not found: ${id}`);
    const card = flashcardSchema.parse(rows[0]);
    const next = reviewCard(
        { ease: card.ease, intervalDays: card.interval_days, reps: card.reps },
        grade,
        nowMs,
    );
    await getDb().execute(
        `UPDATE flashcards SET ease = ?, interval_days = ?, reps = ?,
            due_at = ?, updated_at = ? WHERE id = ?`,
        [next.ease, next.intervalDays, next.reps, next.dueAt, now(), id],
    );
    return flashcardSchema.parse(
        (await getDb().select("SELECT * FROM flashcards WHERE id = ?", [id]))[0],
    );
}

export async function suspendFlashcard(id: string): Promise<void> {
    await getDb().execute(
        "UPDATE flashcards SET suspended = 1, updated_at = ? WHERE id = ?",
        [now(), id],
    );
}

export async function deleteFlashcard(id: string): Promise<void> {
    await getDb().execute("DELETE FROM flashcards WHERE id = ?", [id]);
}

export async function listFlashcards(folder?: string): Promise<Flashcard[]> {
    const f = folder ? normalizeFolder(folder) : null;
    const rows =
        f && f !== "/"
            ? await getDb().select(
                  `SELECT * FROM flashcards WHERE folder = ? OR folder LIKE ?
                   ORDER BY created_at DESC`,
                  [f, `${f}/%`],
              )
            : await getDb().select(
                  "SELECT * FROM flashcards ORDER BY created_at DESC",
              );
    return rows.map((r) => flashcardSchema.parse(r));
}
