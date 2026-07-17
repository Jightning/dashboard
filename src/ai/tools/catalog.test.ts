import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { PermissionContext } from "./context";
import { buildToolSet, TOOL_CATALOG } from "./catalog";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { seedBuiltinAgents } from "@/db/repo/agents";
import { listAgents } from "@/db/repo/agents";
import { agentToolNames } from "@/lib/schemas";

const deps = {
    permissions: new PermissionContext(),
    fetch: (async () => new Response("stub")) as typeof globalThis.fetch,
};

describe("tool catalog", () => {
    it("every catalog entry builds a real tool", () => {
        const all = buildToolSet(
            TOOL_CATALOG.map((e) => e.name),
            deps,
        );
        expect(Object.keys(all).sort()).toEqual(
            TOOL_CATALOG.map((e) => e.name).sort(),
        );
    });

    it("builds only the requested subset", () => {
        const set = buildToolSet(["fetch_url", "write_note"], deps);
        expect(Object.keys(set).sort()).toEqual(["fetch_url", "write_note"]);
    });

    it("throws on unknown tool names", () => {
        expect(() => buildToolSet(["run_shell"], deps)).toThrow(
            /unknown tool.*run_shell/,
        );
    });
});

describe("catalog covers builtin agents", () => {
    let db: ReturnType<typeof createTestDbClient>;
    beforeEach(() => {
        db = createTestDbClient();
        setDb(db);
    });
    afterEach(() => db.close());

    it("every builtin agent tool is a catalog entry (and therefore grantable)", async () => {
        await seedBuiltinAgents();
        const catalog = new Set(TOOL_CATALOG.map((t) => t.name));
        for (const agent of await listAgents()) {
            for (const tool of agentToolNames(agent)) {
                expect(catalog, `${agent.name} uses ungrantable tool`).toContain(tool);
            }
        }
    });
});
