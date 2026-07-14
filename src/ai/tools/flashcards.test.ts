import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { countDueFlashcards } from "@/db/repo/flashcards";
import { PermissionContext } from "./context";
import { createFlashcardTools } from "./flashcards";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

const opts = { toolCallId: "t", messages: [], context: {} };

describe("create_flashcards tool", () => {
    it("creates cards when the folder is granted", async () => {
        const p = new PermissionContext();
        p.levelGrants = [
            {
                tool: "create_flashcards",
                access: "write",
                scopeType: "doc_folder",
                scopeValue: "/school/ece437",
            },
        ];
        const tools = createFlashcardTools(p);
        const result = (await tools.create_flashcards.execute!(
            {
                folder: "/school/ece437",
                cards: [
                    { front: "What is MESI?", back: "A cache coherence protocol" },
                ],
            },
            opts,
        )) as { created: number };
        expect(result.created).toBe(1);
        expect(await countDueFlashcards(Date.now())).toBe(1);
    });

    it("asks (deny honored) outside the granted folder", async () => {
        const p = new PermissionContext();
        p.broker.subscribe((pending) => {
            for (const req of pending) p.broker.respond(req.id, "deny");
        });
        const tools = createFlashcardTools(p);
        const result = (await tools.create_flashcards.execute!(
            { folder: "/personal", cards: [{ front: "f", back: "b" }] },
            opts,
        )) as { denied?: boolean };
        expect(result.denied).toBe(true);
        expect(await countDueFlashcards(Date.now())).toBe(0);
    });
});
