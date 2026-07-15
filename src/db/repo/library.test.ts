import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import {
    createBookmark,
    createSnippet,
    listBookmarks,
    listSnippets,
    searchLibrary,
    updateBookmark,
    updateSnippet,
} from "./library";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

describe("library repo", () => {
    it("groups bookmarks and searches across both kinds", async () => {
        await createBookmark({
            title: "Brightspace",
            url: "https://purdue.brightspace.com",
            groupName: "School",
        });
        await createSnippet({
            title: "SSH ecegrid",
            body: "ssh user@ecegrid.ecn.purdue.edu",
        });

        const grouped = await listBookmarks();
        expect(grouped[0]!.group_name).toBe("School");

        const hits = await searchLibrary("ecegrid");
        expect(hits).toHaveLength(1);
        expect(hits[0]!.kind).toBe("snippet");
        expect((await searchLibrary("bright"))[0]!.kind).toBe("bookmark");
    });

    it("filters bookmarks by project and edits in place", async () => {
        const kept = await createBookmark({
            title: "Docs",
            url: "https://a.dev",
        });
        await updateBookmark(kept.id, {
            title: "API Docs",
            url: "https://a.dev/api",
            groupName: "Reference",
            projectId: null,
        });
        const all = await listBookmarks();
        expect(all[0]!.title).toBe("API Docs");
        expect(all[0]!.group_name).toBe("Reference");
    });

    it("snippets carry groups", async () => {
        const s = await createSnippet({
            title: "greeting",
            body: "hello",
            groupName: "Email",
        });
        expect(s.group_name).toBe("Email");
        await updateSnippet(s.id, { title: "greeting", body: "hi", groupName: "Chat" });
        expect((await listSnippets())[0]!.group_name).toBe("Chat");
    });
});
