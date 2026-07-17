import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { createSession, deleteSession } from "./sessions";
import { extractTextParts, insertMessage, searchSessionIds } from "./messages";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

const parts = (text: string) => JSON.stringify([{ type: "text", text }]);

describe("message search", () => {
    it("extracts only text parts", () => {
        expect(
            extractTextParts(
                JSON.stringify([
                    { type: "text", text: "hello" },
                    { type: "tool-fetch_url", input: { url: "https://x.dev" } },
                    { type: "text", text: "world" },
                ]),
            ),
        ).toBe("hello\nworld");
        expect(extractTextParts("not json")).toBe("");
    });

    it("indexes on insert and searches by session", async () => {
        const a = await createSession({ title: "a" });
        const b = await createSession({ title: "b" });
        await insertMessage({ sessionId: a.id, role: "user", partsJson: parts("quantum flapjacks") });
        await insertMessage({ sessionId: b.id, role: "user", partsJson: parts("regular pancakes") });

        expect(await searchSessionIds("flapjacks")).toEqual([a.id]);
        expect(await searchSessionIds("pancakes")).toEqual([b.id]);
        // toFtsQuery quotes every whitespace-split token, so this becomes an
        // implicit-AND phrase query across all 4 terms (SQLite FTS5's default
        // combinator) — it must not throw on the embedded FTS5 syntax/SQL-ish
        // characters, matching the precedent in src/db/db.test.ts's
        // "does not break on FTS5 syntax characters" case.
        await expect(
            searchSessionIds("pancakes OR flapjacks; DROP TABLE"),
        ).resolves.toBeDefined();
    });

    it("drops the index rows with the session", async () => {
        const s = await createSession({ title: "gone" });
        await insertMessage({ sessionId: s.id, role: "user", partsJson: parts("ephemeral walrus") });
        await deleteSession(s.id);
        expect(await searchSessionIds("walrus")).toEqual([]);
    });
});
