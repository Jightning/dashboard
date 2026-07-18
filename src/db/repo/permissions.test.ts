import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { TOOL_CATALOG } from "@/ai/tools/catalog";
import { evaluateToolCall, SessionGrants, toScopedGrant } from "@/ai/permissions/engine";
import { webScopeResolvers } from "@/ai/tools/web";
import { BUILTIN_LEVELS, listGrants, seedBuiltinLevels } from "./permissions";

let db: ReturnType<typeof createTestDbClient>;

beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});

afterEach(() => {
    db.close();
});

describe("Reads only builtin level", () => {
    it("auto-allows every read tool in the catalog, including real web scopes", async () => {
        await seedBuiltinLevels();
        const levelGrants = (await listGrants(BUILTIN_LEVELS.readsOnly)).map(toScopedGrant);
        const sessionGrants = new SessionGrants();
        for (const entry of TOOL_CATALOG) {
            if (entry.access !== "read") continue;
            // Representative scopes per type; web tools use their REAL resolvers.
            const scope =
                entry.name === "search_web"
                    ? await webScopeResolvers.search_web!({ query: "x" })
                    : entry.name === "fetch_url"
                      ? await webScopeResolvers.fetch_url!({ url: "https://example.com/a" })
                      : { access: "read" as const, scopeType: "doc_folder" as const, scopeValue: "/anywhere" };
            expect(
                evaluateToolCall({ tool: entry.name, scope, levelGrants, sessionGrants }),
                `${entry.name} should auto-allow under Reads only`,
            ).toBe("allow");
        }
    });

    it("write tools still ask under Reads only", async () => {
        await seedBuiltinLevels();
        const levelGrants = (await listGrants(BUILTIN_LEVELS.readsOnly)).map(toScopedGrant);
        expect(
            evaluateToolCall({
                tool: "write_note",
                scope: { access: "write", scopeType: "doc_folder", scopeValue: "/x" },
                levelGrants,
                sessionGrants: new SessionGrants(),
            }),
        ).toBe("ask");
    });

    it("re-seeding is idempotent", async () => {
        await seedBuiltinLevels();
        const before = (await listGrants(BUILTIN_LEVELS.readsOnly)).length;
        await seedBuiltinLevels();
        expect((await listGrants(BUILTIN_LEVELS.readsOnly)).length).toBe(before);
    });
});
