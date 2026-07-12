import { describe, expect, it } from "vitest";
import { PermissionContext } from "./context";
import { buildToolSet, TOOL_CATALOG } from "./catalog";

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
