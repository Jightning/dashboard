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
import { agentSlug, agentToolNames, presetAgents, type AgentDef } from "@/lib/schemas";
import { agentColor } from "./AgentNode";
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

/** Display info derived from a definition; color falls back to the identity hue. */
function agentInfo(def: AgentDef) {
    const slug = agentSlug(def.name);
    return {
        slug,
        color: def.color ?? agentColor(slug),
        tools: safeToolNames(def),
    };
}

function safeToolNames(def: AgentDef): string[] {
    try {
        return agentToolNames(def);
    } catch {
        return [];
    }
}

/** A session's identity color: its lone specialist, else the orchestrator hue. */
export function sessionColor(
    preset: Preset | undefined,
    agentsById: Map<string, AgentDef>,
): string {
    if (!preset) return "var(--primary)";
    const ids = safeAgents(preset);
    const def = ids.length === 1 ? agentsById.get(ids[0]!) : undefined;
    return def ? agentInfo(def).color : ORCHESTRATOR;
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
    def: AgentDef,
    slot: number,
    slots: number,
    idPrefix: string,
) {
    const unit = satelliteUnit(hubUnit, slot, slots, AGENT_SPREAD);
    const { slug, color, tools } = agentInfo(def);
    const agentId = `${idPrefix}:agent:${slug}`;
    net.nodes.push({
        id: agentId,
        kind: "agent",
        label: slug,
        color,
        unit,
        r: AGENT_R,
        parentId: hubId,
        // Context around the instance — hover reveals it; the hub is the click target.
        primary: false,
        meta: {
            title: def.name,
            subtitle: def.description,
            chips: tools.map((t) => ({ label: t })),
        },
    });
    net.edges.push({ a: hubId, b: agentId });

    tools.forEach((toolName, ti) => {
        const tUnit = satelliteUnit(unit, ti, tools.length, TOOL_SPREAD);
        const toolId = `${agentId}:tool:${toolName}`;
        net.nodes.push({
            id: toolId,
            kind: "tool",
            label: toolName,
            color,
            unit: tUnit,
            r: TOOL_R,
            parentId: hubId,
            primary: false,
            meta: { title: toolName, subtitle: `tool · ${slug}` },
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
    agents: AgentDef[],
): Network {
    const shown = sessions.slice(0, MAX_SESSIONS);
    const hubUnits = fibonacciSphere(shown.length);
    const presetById = new Map(presets.map((p) => [p.id, p]));
    const agentsById = new Map(agents.map((a) => [a.id, a]));
    const net: Network = { nodes: [], edges: [] };

    shown.forEach((session, i) => {
        const hubUnit = hubUnits[i]!;
        const preset = session.preset_id
            ? presetById.get(session.preset_id)
            : undefined;
        const defs = safeAgents(preset)
            .map((id) => agentsById.get(id))
            .filter((d): d is AgentDef => d !== undefined);
        const hubId = `session:${session.id}`;
        net.nodes.push({
            id: hubId,
            kind: "session",
            label: session.title,
            color: sessionColor(preset, agentsById),
            unit: hubUnit,
            r: HUB_R,
            primary: true,
            meta: {
                title: session.title,
                subtitle: preset
                    ? `${preset.name} · ${preset.provider}/${preset.model}`
                    : "no preset",
                chips: defs.map((d) => {
                    const info = agentInfo(d);
                    return { label: info.slug, color: info.color };
                }),
                foot: `updated ${relativeTime(session.updated_at)}`,
            },
            payload: session,
        });
        defs.forEach((def, k) =>
            attachAgent(net, hubId, hubUnit, def, k, defs.length, hubId),
        );
    });

    return net;
}

/** Orchestrator hub → every defined agent → its tools. */
export function buildAgentTypeNetwork(agents: AgentDef[]): Network {
    const units = fibonacciSphere(agents.length + 1);
    const net: Network = { nodes: [], edges: [] };

    net.nodes.push({
        id: "agent:orchestrator",
        kind: "agent",
        label: "orchestrator",
        color: ORCHESTRATOR,
        unit: units[0]!,
        r: HUB_R,
        primary: true,
        meta: {
            title: "Orchestrator",
            subtitle:
                "Runs on the preset's router model. Answers directly when it can; delegates to your agents as tool calls.",
        },
        payload: { agent: "orchestrator" },
    });

    agents.forEach((def, i) => {
        const unit = units[i + 1]!;
        const { slug, color, tools } = agentInfo(def);
        const id = `agent:${def.id}`;
        net.nodes.push({
            id,
            kind: "agent",
            label: slug,
            color,
            unit,
            r: AGENT_R + 0.3,
            primary: true,
            meta: {
                title: def.name,
                subtitle: def.description,
                chips: tools.map((t) => ({ label: t })),
            },
            payload: { agent: def.id },
        });
        net.edges.push({ a: "agent:orchestrator", b: id });

        tools.forEach((toolName, ti) => {
            const tUnit = satelliteUnit(unit, ti, tools.length, TOOL_SPREAD);
            const toolId = `${id}:tool:${toolName}`;
            net.nodes.push({
                id: toolId,
                kind: "tool",
                label: toolName,
                color,
                unit: tUnit,
                r: TOOL_R,
                parentId: id,
                primary: false,
                meta: { title: toolName, subtitle: `tool · ${slug}` },
            });
            net.edges.push({ a: id, b: toolId });
        });
    });

    return net;
}
