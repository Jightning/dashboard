import { beforeEach, describe, expect, it } from "vitest";
import { loadNav, saveNav } from "./navPersist";

// Node 22+ exposes localStorage in vitest's node environment via --experimental
// APIs inconsistently — stub a minimal one for determinism.
beforeEach(() => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear(),
        key: () => null,
        length: 0,
    } as Storage;
});

describe("nav persistence", () => {
    it("round-trips a NavTarget", () => {
        saveNav({ page: "planner", tab: "calendar" });
        expect(loadNav()).toEqual({ page: "planner", tab: "calendar" });
    });

    it("rejects unknown pages and garbage", () => {
        localStorage.setItem("hugh.nav.v1", JSON.stringify({ page: "nope" }));
        expect(loadNav()).toBeNull();
        localStorage.setItem("hugh.nav.v1", "not json");
        expect(loadNav()).toBeNull();
        // Prototype-chain members must not validate as pages.
        localStorage.setItem("hugh.nav.v1", JSON.stringify({ page: "constructor" }));
        expect(loadNav()).toBeNull();
    });

    it("keeps sessionId and projectId strings only", () => {
        localStorage.setItem(
            "hugh.nav.v1",
            JSON.stringify({ page: "agents", tab: "chat", sessionId: 42 }),
        );
        expect(loadNav()).toEqual({ page: "agents", tab: "chat" });
    });
});
