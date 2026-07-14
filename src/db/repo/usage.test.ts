import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb, getDb } from "@/db/client";
import { usageByDay } from "./usage";

let db: ReturnType<typeof createTestDbClient>;

beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});

afterEach(() => {
    db.close();
});

async function seedSession(): Promise<string> {
    const id = "ses_x";
    await getDb().execute(
        `INSERT INTO chat_sessions (id, title, created_at, updated_at)
         VALUES (?, 'Test', 0, 0)`,
        [id],
    );
    return id;
}

async function seedMessage(opts: {
    sessionId: string;
    model: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    createdAt: number;
    id: string;
}) {
    await getDb().execute(
        `INSERT INTO chat_messages
            (id, session_id, role, parts_json, model, input_tokens, output_tokens, created_at)
         VALUES (?, ?, 'assistant', '[]', ?, ?, ?, ?)`,
        [
            opts.id,
            opts.sessionId,
            opts.model,
            opts.inputTokens,
            opts.outputTokens,
            opts.createdAt,
        ],
    );
}

describe("usageByDay", () => {
    it("rolls up token usage per day and model, most recent day first", async () => {
        const sessionId = await seedSession();
        const now = Date.now();
        const today = now;
        const yesterday = now - 86_400_000;

        await seedMessage({
            id: "msg_1",
            sessionId,
            model: "gemini-2.5-flash",
            inputTokens: 100,
            outputTokens: 50,
            createdAt: today,
        });
        await seedMessage({
            id: "msg_2",
            sessionId,
            model: "gemini-2.5-flash",
            inputTokens: 20,
            outputTokens: 10,
            createdAt: today,
        });
        await seedMessage({
            id: "msg_3",
            sessionId,
            model: "gemini-2.5-flash",
            inputTokens: 5,
            outputTokens: 5,
            createdAt: yesterday,
        });

        const rows = await usageByDay(14);
        expect(rows).toHaveLength(2);
        const [mostRecent, older] = rows;
        // Most recent day first.
        expect(mostRecent!.model).toBe("gemini-2.5-flash");
        expect(mostRecent!.inputTokens).toBe(120);
        expect(mostRecent!.outputTokens).toBe(60);
        expect(older!.inputTokens).toBe(5);
        expect(older!.outputTokens).toBe(5);
        expect(new Date(mostRecent!.day).getTime()).toBeGreaterThan(
            new Date(older!.day).getTime(),
        );
    });

    it("defaults a missing model to 'unknown' and skips rows with no token counts", async () => {
        const sessionId = await seedSession();
        await seedMessage({
            id: "msg_1",
            sessionId,
            model: null,
            inputTokens: 7,
            outputTokens: null,
            createdAt: Date.now(),
        });
        // Row with no token counts at all should be excluded.
        await seedMessage({
            id: "msg_2",
            sessionId,
            model: "gemini-2.5-flash",
            inputTokens: null,
            outputTokens: null,
            createdAt: Date.now(),
        });

        const rows = await usageByDay(14);
        expect(rows).toHaveLength(1);
        expect(rows[0]!.model).toBe("unknown");
        expect(rows[0]!.inputTokens).toBe(7);
        expect(rows[0]!.outputTokens).toBe(0);
    });

    it("excludes messages older than the requested window", async () => {
        const sessionId = await seedSession();
        await seedMessage({
            id: "msg_1",
            sessionId,
            model: "gemini-2.5-flash",
            inputTokens: 10,
            outputTokens: 10,
            createdAt: Date.now() - 30 * 86_400_000,
        });

        const rows = await usageByDay(14);
        expect(rows).toHaveLength(0);
    });
});
