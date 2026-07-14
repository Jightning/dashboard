import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import {
    applyReview,
    countDueFlashcards,
    createFlashcards,
    listDueFlashcards,
    suspendFlashcard,
} from "./flashcards";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

describe("flashcards repo", () => {
    it("bulk-creates cards due immediately", async () => {
        const n = await createFlashcards(
            [
                { front: "Carnot efficiency?", back: "1 - Tc/Th" },
                { front: "MESI states?", back: "Modified Exclusive Shared Invalid" },
            ],
            { folder: "/school/ece437" },
        );
        expect(n).toBe(2);
        expect(await countDueFlashcards(Date.now())).toBe(2);
    });

    it("review pushes due date out; failed cards requeue soon", async () => {
        await createFlashcards([{ front: "f", back: "b" }], { folder: "/" });
        const [card] = await listDueFlashcards(Date.now());
        const now = Date.now();

        await applyReview(card!.id, 4, now);
        expect(await countDueFlashcards(now + 60_000)).toBe(0); // 1 day away
        expect(await countDueFlashcards(now + 2 * 86_400_000)).toBe(1);

        const [again] = await listDueFlashcards(now + 2 * 86_400_000);
        await applyReview(again!.id, 0, now);
        expect(await countDueFlashcards(now + 11 * 60_000)).toBe(1); // 10 min
    });

    it("suspended cards leave the queue", async () => {
        await createFlashcards([{ front: "f", back: "b" }], { folder: "/" });
        const [card] = await listDueFlashcards(Date.now());
        await suspendFlashcard(card!.id);
        expect(await countDueFlashcards(Date.now())).toBe(0);
    });

    it("rejects empty batches", async () => {
        await expect(createFlashcards([], { folder: "/" })).rejects.toThrow(
            /at least one/,
        );
    });
});
