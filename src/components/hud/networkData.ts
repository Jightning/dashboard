/**
 * Turns domain data (chat sessions, agent topology) into the node/edge graph
 * the NetworkSphere renders. Each meaningful entity becomes a node placed on
 * the unit sphere; satellites (an instance's specialists + their tools) cluster
 * around their hub via tangent-plane offsets.
 *
 * The node model is deliberately extensible (`kind` includes 'doc' | 'note') so
 * a future `buildFolderNetwork(agent, folder)` can emit file/context satellites
 * from listDocuments/listNotes without touching this component.
 */
import type { ChatSession, Preset } from "@/lib/schemas";
import { presetAgents } from "@/lib/schemas";
import { agentColor } from "./AgentNode";
import { agentSpec, agentTools } from "./agentCatalog";
import { fibonacciSphere, tangentOffset, type Vec3 } from "./sphere";

export type NodeKind = "session" | "agent" | "tool" | "doc" | "note";

export interface NodeMeta {
    title: string;
    subtitle?: string;
    body?: string;
    /** Colored pills (agents, tools). */
    chips?: { label: string; color?: string }[];
    foot?: string;
}

export interface NetworkNode {
    id: string;
    kind: NodeKind;
    label: string;
    /** Resolved CSS color (e.g. agentColor("knowledge")). */
    color: string;
    /** Placement on the unit sphere. */
    unit: Vec3;
    /** Base draw radius (viewBox units). */
    r: number;
    /** Hub id this node belongs to, for subtree highlighting. */
    parentId?: string;
    /** Hubs/agents get labels and are selectable; tools are context. */
    primary: boolean;
    meta: NodeMeta;
    /** Domain payload for the click handler (e.g. the ChatSession). */
    payload?: unknown;
}

export interface NetworkEdge {
    a: string;
    b: string;
}

export interface Network {
    nodes: NetworkNode[];
    edges: NetworkEdge[];
}

const ORCHESTRATOR = "var(--agent-orchestrator)";
const HUB_R = 2.3;
const AGENT_R = 1.5;
const TOOL_R = 0.85;
/** Angular spread (tangent units) of satellites around their hub. */
const AGENT_SPREAD = 0.42;
const TOOL_SPREAD = 0.22;

/** A session's identity color: its lone specialist, else the orchestrator hue. */
export function sessionColor(preset: Preset | undefined): string {
    if (!preset) return "var(--primary)";
    const agents = safeAgents(preset);
    return agents.length === 1 ? agentColor(agents[0]!) : ORCHESTRATOR;
}

function safeAgents(preset: Preset | undefined): string[] {
    if (!preset) return [];
    try {
        return presetAgents(preset);
    } catch {
        return [];
    }
}

/** Place a satellite around `hub` at slot k of n on a small tangent circle. */
function satelliteUnit(hub: Vec3, k: number, n: number, spread: number): Vec3 {
    const angle = (2 * Math.PI * k) / Math.max(1, n) + 0.6;
    return tangentOffset(hub, Math.cos(angle) * spread, Math.sin(angle) * spread);
}

/** Attach an agent satellite + its tool sub-satellites to a hub. */
function attachAgent(
    net: Network,
    hubId: string,
    hubUnit: Vec3,
    agentName: string,
    slot: number,
    slots: number,
    idPrefix: string,
) {
    const unit = satelliteUnit(hubUnit, slot, slots, AGENT_SPREAD);
    const color = agentColor(agentName);
    const spec = agentSpec(agentName);
    const agentId = `${idPrefix}:agent:${agentName}`;
    net.nodes.push({
        id: agentId,
        kind: "agent",
        label: agentName,
        color,
        unit,
        r: AGENT_R,
        parentId: hubId,
        // Context around the instance — hover reveals it; the hub is the click target.
        primary: false,
        meta: {
            title: spec?.title ?? agentName,
            subtitle: spec?.role,
            chips: agentTools(agentName).map((t) => ({ label: t })),
        },
    });
    net.edges.push({ a: hubId, b: agentId });

    const tools = agentTools(agentName);
    tools.forEach((tool, ti) => {
        const tUnit = satelliteUnit(unit, ti, tools.length, TOOL_SPREAD);
        const toolId = `${agentId}:tool:${tool}`;
        net.nodes.push({
            id: toolId,
            kind: "tool",
            label: tool,
            color,
            unit: tUnit,
            r: TOOL_R,
            parentId: hubId,
            primary: false,
            meta: { title: tool, subtitle: `tool · ${agentName}` },
        });
        net.edges.push({ a: agentId, b: toolId });
    });
}

const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
/** Human relative time from a unix-seconds timestamp (e.g. "3 minutes ago"). */
export function relativeTime(ts: number): string {
    const sec = Math.round((ts * 1000 - Date.now()) / 1000);
    const abs = Math.abs(sec);
    if (abs < 60) return RELATIVE.format(Math.round(sec), "second");
    if (abs < 3600) return RELATIVE.format(Math.round(sec / 60), "minute");
    if (abs < 86400) return RELATIVE.format(Math.round(sec / 3600), "hour");
    return RELATIVE.format(Math.round(sec / 86400), "day");
}

/** Cap so the globe stays readable and cheap. */
const MAX_SESSIONS = 10;

/**
 * Existing chat sessions as agent instances: one hub per session (colored by
 * type), each expanding into its enabled specialists + their tools.
 */
export function buildSessionNetwork(
    sessions: ChatSession[],
    presets: Preset[],
): Network {
    const shown = sessions.slice(0, MAX_SESSIONS);
    const hubUnits = fibonacciSphere(shown.length);
    const presetById = new Map(presets.map((p) => [p.id, p]));
    const net: Network = { nodes: [], edges: [] };

    shown.forEach((session, i) => {
        const hubUnit = hubUnits[i]!;
        const preset = session.preset_id
            ? presetById.get(session.preset_id)
            : undefined;
        const agents = safeAgents(preset);
        const hubId = `session:${session.id}`;
        net.nodes.push({
            id: hubId,
            kind: "session",
            label: session.title,
            color: sessionColor(preset),
            unit: hubUnit,
            r: HUB_R,
            primary: true,
            meta: {
                title: session.title,
                subtitle: preset
                    ? `${preset.name} · ${preset.provider}/${preset.model}`
                    : "no preset",
                chips: agents.map((a) => ({ label: a, color: agentColor(a) })),
                foot: `updated ${relativeTime(session.updated_at)}`,
            },
            payload: session,
        });
        agents.forEach((agent, k) =>
            attachAgent(net, hubId, hubUnit, agent, k, agents.length, hubId),
        );
    });

    return net;
}

/**
 * The static agent topology (orchestrator hub → specialists → their tools).
 * Used by the Agents page and as the empty-state fallback when no sessions
 * exist yet.
 */
export function buildAgentTypeNetwork(): Network {
    const specialists = ["knowledge", "research", "planner"];
    // Orchestrator + specialists distributed on the sphere.
    const primaries = ["orchestrator", ...specialists];
    const units = fibonacciSphere(primaries.length);
    const unitByName = new Map(primaries.map((n, i) => [n, units[i]!]));
    const net: Network = { nodes: [], edges: [] };

    const orchUnit = unitByName.get("orchestrator")!;
    const orch = agentSpec("orchestrator");
    net.nodes.push({
        id: "agent:orchestrator",
        kind: "agent",
        label: "orchestrator",
        color: ORCHESTRATOR,
        unit: orchUnit,
        r: HUB_R,
        primary: true,
        meta: {
            title: orch?.title ?? "Orchestrator",
            subtitle: orch?.role,
        },
        payload: { agent: "orchestrator" },
    });

    specialists.forEach((name) => {
        const unit = unitByName.get(name)!;
        const spec = agentSpec(name);
        const color = agentColor(name);
        const id = `agent:${name}`;
        net.nodes.push({
            id,
            kind: "agent",
            label: name,
            color,
            unit,
            r: AGENT_R + 0.3,
            primary: true,
            meta: {
                title: spec?.title ?? name,
                subtitle: spec?.role,
                chips: agentTools(name).map((t) => ({ label: t })),
                foot: spec?.future ? `${spec.future} · coming soon` : undefined,
            },
            payload: { agent: name },
        });
        // Delegation edge from the orchestrator hub.
        if (name !== "planner") net.edges.push({ a: "agent:orchestrator", b: id });

        const tools = agentTools(name);
        tools.forEach((tool, ti) => {
            const tUnit = satelliteUnit(unit, ti, tools.length, TOOL_SPREAD);
            const toolId = `${id}:tool:${tool}`;
            net.nodes.push({
                id: toolId,
                kind: "tool",
                label: tool,
                color,
                unit: tUnit,
                r: TOOL_R,
                parentId: id,
                primary: false,
                meta: { title: tool, subtitle: `tool · ${name}` },
            });
            net.edges.push({ a: id, b: toolId });
        });
    });

    return net;
}
