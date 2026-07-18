import { beforeEach, describe, expect, it } from "vitest";
import { loadDraft, saveDraft, removeDraft, pruneDrafts, MAX_DRAFT_CHARS, DRAFT_TTL_MS, MAX_DRAFTS } from "./drafts";

// Node 22+ exposes localStorage in vitest's node environment via --experimental
// APIs inconsistently — stub a minimal one for determinism. Unlike navPersist's
// stub, pruneDrafts needs key enumeration, so this stub backs onto a Map and
// implements length/key(i) too.
beforeEach(() => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear(),
        key: (i: number) => Array.from(store.keys())[i] ?? null,
        get length() {
            return store.size;
        },
    } as Storage;
});

describe("bounded drafts", () => {
    it("round-trips and accepts legacy plain-string values", () => {
        saveDraft("ses_a", "hello");
        expect(loadDraft("ses_a")).toBe("hello");
        localStorage.setItem("hugh.draft.ses_old", "legacy text");
        expect(loadDraft("ses_old")).toBe("legacy text");
    });

    it("caps draft size", () => {
        saveDraft("ses_big", "x".repeat(MAX_DRAFT_CHARS + 5));
        expect(loadDraft("ses_big").length).toBe(MAX_DRAFT_CHARS);
    });

    it("expires drafts past the TTL", () => {
        localStorage.setItem(
            "hugh.draft.ses_stale",
            JSON.stringify({ t: "old", at: Date.now() - DRAFT_TTL_MS - 1 }),
        );
        expect(loadDraft("ses_stale")).toBe("");
        expect(localStorage.getItem("hugh.draft.ses_stale")).toBeNull();
    });

    it("prunes to the newest MAX_DRAFTS", () => {
        // `at` values must stay within the TTL window (offsets of a few tens
        // of ms vs. a 14-day TTL) so this exercises the cap logic, not
        // TTL-expiry — only relative order (i => newer) matters here.
        const base = Date.now();
        for (let i = 0; i < MAX_DRAFTS + 5; i++) {
            localStorage.setItem(
                `hugh.draft.ses_${i}`,
                JSON.stringify({ t: `d${i}`, at: base - (MAX_DRAFTS + 5 - i) }),
            );
        }
        pruneDrafts();
        // newest MAX_DRAFTS survive; the 5 oldest (smallest at) are gone
        expect(loadDraft("ses_0")).toBe("");
        expect(loadDraft(`ses_${MAX_DRAFTS + 4}`)).toBe(`d${MAX_DRAFTS + 4}`);
    });

    it("saveDraft with empty text removes the draft", () => {
        saveDraft("ses_b", "something");
        expect(loadDraft("ses_b")).toBe("something");
        saveDraft("ses_b", "");
        expect(loadDraft("ses_b")).toBe("");
        expect(localStorage.getItem("hugh.draft.ses_b")).toBeNull();
    });

    it("removeDraft clears a stored draft", () => {
        saveDraft("ses_c", "text");
        removeDraft("ses_c");
        expect(loadDraft("ses_c")).toBe("");
    });
});
