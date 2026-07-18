import { describe, expect, it } from "vitest";
import {
    buildCategoryUniverse,
    buildUniverseNetwork,
    relativeTime,
    CATEGORY_INNER,
    EXO_LAYER_SIZE,
    MAX_EXO_RINGS,
    EXO_SHELL_BASE,
    EXO_SHELL_STEP,
} from "./networkData";
import type { AgentDef, Category, ChatSession, Preset, Project } from "@/lib/schemas";

function session(id: string, over: Partial<ChatSession> = {}): ChatSession {
    return {
        id,
        title: id,
        preset_id: null,
        permission_level_id: null,
        compaction_summary: null,
        project_id: null,
        category_id: null,
        color: null,
        auto_summary: null,
        auto_tags_json: "[]",
        created_at: 0,
        updated_at: 0,
        ...over,
    };
}

function project(id: string, name: string): Project {
    return {
        id,
        name,
        description: null,
        color: "#22d3ee",
        category_id: null,
        created_at: 0,
        updated_at: 0,
    };
}

function agentDef(id: string, name: string, toolsJson = "[]"): AgentDef {
    return {
        id,
        name,
        description: "",
        instructions: "",
        tools_json: toolsJson,
        model: null,
        max_steps: 5,
        color: null,
        is_builtin: 0,
        created_at: 0,
        updated_at: 0,
    };
}

function presetWith(id: string, agentIds: string[]): Preset {
    return {
        id,
        name: id,
        description: null,
        system_prompt: "",
        provider: "anthropic",
        model: "claude",
        router_model: null,
        enabled_agents_json: JSON.stringify(agentIds),
        permission_level_id: null,
        token_budget: null,
        compaction_threshold: null,
        is_builtin: 0,
        created_at: 0,
        updated_at: 0,
    };
}

const base = {
    presets: [] as Preset[],
    agents: [] as AgentDef[],
    documents: [] as { id: string; title: string; project_id: string | null }[],
};

describe("relativeTime", () => {
    it("treats input as milliseconds", () => {
        expect(relativeTime(Date.now() - 5 * 60_000)).toMatch(/\d+ minutes? ago/);
        expect(relativeTime(Date.now() - 2 * 86_400_000)).toMatch(/\d+ days? ago/);
    });
});

describe("buildUniverseNetwork", () => {
    it("makes one hub per project with doc satellites in its cluster", () => {
        const p = project("prj_1", "Thesis");
        const net = buildUniverseNetwork({
            ...base,
            projects: [p],
            documents: [{ id: "doc_1", title: "spec.pdf", project_id: "prj_1" }],
            sessions: [session("ses_1", { project_id: "prj_1" })],
            expanded: false,
        });
        const hub = net.nodes.find((n) => n.kind === "project");
        expect(hub).toBeDefined();
        expect(hub!.label).toBe("Thesis");
        const doc = net.nodes.find((n) => n.kind === "doc");
        expect(doc!.parentId).toBe(hub!.id);
        const ses = net.nodes.find((n) => n.kind === "session");
        expect(ses!.parentId).toBe(hub!.id);
    });

    it("collapses old unfiled sessions into one archive star", () => {
        const sessions = Array.from({ length: 12 }, (_, i) =>
            session(`ses_${i}`, { updated_at: 100 - i }),
        );
        const net = buildUniverseNetwork({
            ...base,
            projects: [],
            sessions,
            expanded: false,
        });
        const hubs = net.nodes.filter((n) => n.kind === "session" && n.primary);
        expect(hubs).toHaveLength(8); // RECENT_HUBS newest
        const archive = net.nodes.find((n) => n.kind === "archive");
        expect(archive).toBeDefined();
        expect((archive!.payload as { count: number }).count).toBe(4);
    });

    it("expands the archive into session satellites", () => {
        const sessions = Array.from({ length: 12 }, (_, i) =>
            session(`ses_${i}`, { updated_at: 100 - i }),
        );
        const net = buildUniverseNetwork({
            ...base,
            projects: [],
            sessions,
            expanded: true,
        });
        const archive = net.nodes.find((n) => n.kind === "archive")!;
        const archived = net.nodes.filter(
            (n) => n.kind === "session" && n.parentId === archive.id,
        );
        expect(archived).toHaveLength(4);
    });

    it("omits the archive star when everything fits", () => {
        const net = buildUniverseNetwork({
            ...base,
            projects: [],
            sessions: [session("ses_1")],
            expanded: false,
        });
        expect(net.nodes.find((n) => n.kind === "archive")).toBeUndefined();
    });
});

describe("buildCategoryUniverse", () => {
    const cat = (id: string, name: string): Category => ({
        id, name, color: "#22d3ee", created_at: 0, updated_at: 0,
    });

    it("top level: one star per category plus unfiled", () => {
        const net = buildCategoryUniverse({
            categories: [cat("cat_a", "School")],
            projects: [],
            sessions: [session("ses_1", { category_id: "cat_a" }), session("ses_2")],
            documents: [], presets: [], agents: [],
            focusCategoryId: null,
        });
        const kinds = net.nodes.map((n) => n.kind);
        expect(kinds.filter((k) => k === "category")).toHaveLength(2); // School + unfiled
        expect(net.nodes.find((n) => n.id === "category:cat_a")!.meta.foot).toContain("1 chat");
    });

    it("focused: newest chats inner, overflow on the exo shell", () => {
        const sessions = Array.from({ length: 12 }, (_, i) =>
            session(`ses_${i}`, { category_id: "cat_a", updated_at: 100 - i }),
        );
        const net = buildCategoryUniverse({
            categories: [cat("cat_a", "School")],
            projects: [], sessions, documents: [], presets: [], agents: [],
            focusCategoryId: "cat_a",
        });
        const chats = net.nodes.filter((n) => n.kind === "session");
        expect(chats).toHaveLength(12);
        expect(chats.filter((n) => (n.shell ?? 1) > 1)).toHaveLength(12 - CATEGORY_INNER);
        // Newest stay inner.
        expect(chats.find((n) => n.id === "session:ses_0")!.shell ?? 1).toBe(1);
    });

    it("splits exo overflow into rings of EXO_LAYER_SIZE with stepped shells", () => {
        const sessions = Array.from({ length: CATEGORY_INNER + 30 }, (_, i) =>
            session(`ses_${i}`, { category_id: "cat_a", updated_at: 1000 - i }),
        );
        const net = buildCategoryUniverse({
            categories: [cat("cat_a", "School")],
            projects: [], sessions, documents: [], presets: [], agents: [],
            focusCategoryId: "cat_a",
        });
        const exo = net.nodes.filter((n) => (n.shell ?? 1) > 1);
        expect(exo).toHaveLength(30);
        const shells = new Set(exo.map((n) => n.shell));
        expect(shells).toEqual(
            new Set([EXO_SHELL_BASE, EXO_SHELL_BASE + EXO_SHELL_STEP, EXO_SHELL_BASE + 2 * EXO_SHELL_STEP]),
        );
        // Ring 0 holds the newest EXO_LAYER_SIZE of the overflow.
        expect(
            exo.filter((n) => n.shell === EXO_SHELL_BASE),
        ).toHaveLength(EXO_LAYER_SIZE);
    });

    it("the terminal ring absorbs overflow beyond MAX_EXO_RINGS — nothing unreachable", () => {
        const deep = CATEGORY_INNER + MAX_EXO_RINGS * EXO_LAYER_SIZE + 20;
        const sessions = Array.from({ length: deep }, (_, i) =>
            session(`ses_${i}`, { category_id: "cat_a", updated_at: 10_000 - i }),
        );
        const net = buildCategoryUniverse({
            categories: [cat("cat_a", "School")],
            projects: [], sessions, documents: [], presets: [], agents: [],
            focusCategoryId: "cat_a",
        });
        const exo = net.nodes.filter((n) => (n.shell ?? 1) > 1);
        // Every overflow chat renders — none dropped past the last ring.
        expect(exo).toHaveLength(deep - CATEGORY_INNER);
        const lastShell = EXO_SHELL_BASE + (MAX_EXO_RINGS - 1) * EXO_SHELL_STEP;
        expect(Math.max(...exo.map((n) => n.shell!))).toBe(lastShell);
        // The terminal ring holds its normal share plus everything deeper.
        expect(exo.filter((n) => n.shell === lastShell)).toHaveLength(
            EXO_LAYER_SIZE + 20,
        );
    });

    it("focused chat stars carry subtle agent satellites, no tools", () => {
        const agent = agentDef("agt_r", "Research", '["search_web","fetch_url"]');
        const preset = presetWith("pre_1", ["agt_r"]);
        const net = buildCategoryUniverse({
            categories: [cat("cat_a", "School")],
            projects: [],
            sessions: [session("ses_1", { category_id: "cat_a", preset_id: "pre_1" })],
            documents: [],
            presets: [preset],
            agents: [agent],
            focusCategoryId: "cat_a",
        });
        const agents = net.nodes.filter((n) => n.kind === "agent");
        expect(agents).toHaveLength(1);
        expect(agents[0]!.primary).toBe(false);
        expect(agents[0]!.r).toBeLessThan(1.5); // subtler than the old AGENT_R
        expect(net.nodes.filter((n) => n.kind === "tool")).toHaveLength(0);
        // Hover card lists the agents as chips.
        const star = net.nodes.find((n) => n.id === "session:ses_1")!;
        expect(star.meta.chips?.map((c) => c.label)).toEqual(["research"]);
    });

    it("focused unfiled shows only unfiled sessions", () => {
        const net = buildCategoryUniverse({
            categories: [cat("cat_a", "School")],
            projects: [],
            sessions: [session("ses_a", { category_id: "cat_a" }), session("ses_b")],
            documents: [], presets: [], agents: [],
            focusCategoryId: "unfiled",
        });
        expect(net.nodes.filter((n) => n.kind === "session").map((n) => n.id))
            .toEqual(["session:ses_b"]);
    });
});
