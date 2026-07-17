import { describe, expect, it } from "vitest";
import { buildUniverseNetwork } from "./networkData";
import type { AgentDef, ChatSession, Preset, Project } from "@/lib/schemas";

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

const base = {
    presets: [] as Preset[],
    agents: [] as AgentDef[],
    documents: [] as { id: string; title: string; project_id: string | null }[],
};

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
