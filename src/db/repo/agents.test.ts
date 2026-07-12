import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb, getDb } from "@/db/client";
import { agentSlug, delegationToolName, type AgentDef } from "@/lib/schemas";

let db: ReturnType<typeof createTestDbClient>;

beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});

afterEach(() => {
    db.close();
});

describe("agents migration", () => {
    it("creates the agents table with defaults", async () => {
        await getDb().execute(
            `INSERT INTO agents (id, name, description, instructions, created_at, updated_at)
             VALUES ('agt_x', 'Writer', 'writes things', 'You write.', 1, 1)`,
        );
        const rows = await getDb().select<{
            tools_json: string;
            max_steps: number;
            is_builtin: number;
        }>("SELECT tools_json, max_steps, is_builtin FROM agents WHERE id = 'agt_x'");
        expect(rows[0]).toEqual({ tools_json: "[]", max_steps: 6, is_builtin: 0 });
    });
});

describe("agent naming helpers", () => {
    it("slugifies display names", () => {
        expect(agentSlug("Knowledge")).toBe("knowledge");
        expect(agentSlug("HN Digest v2")).toBe("hn_digest_v2");
    });

    it("throws on names that slug to nothing", () => {
        expect(() => agentSlug("!!!")).toThrow(/empty slug/);
    });

    it("builds delegation tool names", () => {
        const def = { name: "Research" } as AgentDef;
        expect(delegationToolName(def)).toBe("ask_research_agent");
    });
});
