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

import {
    createAgent,
    deleteAgent,
    duplicateAgent,
    getAgent,
    listAgents,
    seedBuiltinAgents,
    updateAgent,
    BUILTIN_AGENT_IDS,
} from "./agents";
import { agentToolNames } from "@/lib/schemas";

describe("agents repo", () => {
    it("seeds builtin knowledge and research agents idempotently", async () => {
        await seedBuiltinAgents();
        await seedBuiltinAgents(); // must not throw or duplicate
        const agents = await listAgents();
        expect(agents.map((a) => a.id).sort()).toEqual([
            BUILTIN_AGENT_IDS.knowledge,
            BUILTIN_AGENT_IDS.planner,
            BUILTIN_AGENT_IDS.research,
        ]);
        const knowledge = await getAgent(BUILTIN_AGENT_IDS.knowledge);
        expect(knowledge.is_builtin).toBe(1);
        expect(agentToolNames(knowledge)).toContain("search_documents");
    });

    it("seeds the planner agent with semester tools", async () => {
        await seedBuiltinAgents();
        const planner = await getAgent("agt_planner");
        expect(planner.is_builtin).toBe(1);
        expect(agentToolNames(planner)).toEqual([
            "list_tasks",
            "create_task",
            "list_events",
            "list_applications",
            "search_notes",
        ]);
    });

    it("creates, updates, and deletes a custom agent", async () => {
        const created = await createAgent({
            name: "Writer",
            description: "Drafts notes",
            instructions: "You write concise notes.",
            tools: ["write_note"],
        });
        expect(created.max_steps).toBe(6);

        const updated = await updateAgent(created.id, {
            name: "Writer",
            description: "Drafts notes",
            instructions: "You write very concise notes.",
            tools: ["write_note", "search_notes"],
            maxSteps: 4,
        });
        expect(updated.max_steps).toBe(4);
        expect(agentToolNames(updated)).toEqual(["write_note", "search_notes"]);

        await deleteAgent(created.id);
        await expect(getAgent(created.id)).rejects.toThrow(/not found/);
    });

    it("refuses to delete builtin agents but allows editing them", async () => {
        await seedBuiltinAgents();
        await expect(
            deleteAgent(BUILTIN_AGENT_IDS.knowledge),
        ).rejects.toThrow(/built-in/);
        const edited = await updateAgent(BUILTIN_AGENT_IDS.knowledge, {
            name: "Knowledge",
            description: "custom desc",
            instructions: "custom instructions",
            tools: ["search_documents"],
        });
        expect(edited.description).toBe("custom desc");
        expect(edited.is_builtin).toBe(1);
    });

    it("duplicates an agent with a distinct name", async () => {
        await seedBuiltinAgents();
        const copy = await duplicateAgent(BUILTIN_AGENT_IDS.research);
        expect(copy.name).toBe("Research copy");
        expect(copy.is_builtin).toBe(0);
        expect(copy.instructions).toBe(
            (await getAgent(BUILTIN_AGENT_IDS.research)).instructions,
        );
    });
});
