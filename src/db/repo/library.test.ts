import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import {
    createBookmark,
    createSnippet,
    listBookmarks,
    searchLibrary,
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
});
