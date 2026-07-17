/**
 * Turns domain data (chat sessions, agent topology) into the node/edge graph
 * the NetworkSphere renders. Each meaningful entity becomes a node placed on
 * the unit sphere; satellites (an instance's specialists + their tools) cluster
 * around their hub via tangent-plane offsets.
 *
 * The universe view groups everything by project: one star per project with
 * its sessions and files clustered around it, the newest unfiled sessions as
 * their own stars, and older ones folded into a single expandable archive star.
 */
import type { Category, ChatSession, Document, Preset, Project } from "@/lib/schemas";
import { agentSlug, agentToolNames, presetAgents, type AgentDef } from "@/lib/schemas";
import { effectiveCategoryId } from "@/lib/categories";
import { agentColor } from "./AgentNode";
import { fibonacciSphere, tangentOffset, type Vec3 } from "./sphere";

export type NodeKind =
    | "session" | "agent" | "tool" | "doc" | "project" | "archive" | "category";

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
    /** Radius multiplier: 1 = main sphere, >1 = exo-sphere (older overflow). */
    shell?: number;
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

/** A session's identity color: user-chosen, else its lone specialist, else orchestrator. */
export function sessionColor(
    session: ChatSession,
    preset: Preset | undefined,
    agentsById: Map<string, AgentDef>,
): string {
    if (session.color) return session.color;
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
    const sec = Math.round((ts - Date.now()) / 1000);
    const abs = Math.abs(sec);
    if (abs < 60) return RELATIVE.format(Math.round(sec), "second");
    if (abs < 3600) return RELATIVE.format(Math.round(sec / 60), "minute");
    if (abs < 86400) return RELATIVE.format(Math.round(sec / 3600), "hour");
    return RELATIVE.format(Math.round(sec / 86400), "day");
}

export const RECENT_HUBS = 8;
const PROJECT_SESSION_SAT = 6;
const PROJECT_DOC_SAT = 5;
const ARCHIVE_SAT = 24;
const PROJECT_R = HUB_R + 0.5;
const ARCHIVE_COLOR = "var(--muted-foreground)";

/**
 * The full chat universe: one star per project (sessions + files clustered
 * around it), the newest unfiled sessions as their own stars, and everything
 * older folded into a single expandable "archive" star — so the globe stays
 * readable at any chat count.
 */
export function buildUniverseNetwork(opts: {
    projects: Project[];
    sessions: ChatSession[];
    documents: Pick<Document, "id" | "title" | "project_id">[];
    presets: Preset[];
    agents: AgentDef[];
    expanded: boolean;
}): Network {
    const presetById = new Map(opts.presets.map((p) => [p.id, p]));
    const agentsById = new Map(opts.agents.map((a) => [a.id, a]));
    const net: Network = { nodes: [], edges: [] };

    const filed = opts.sessions.filter((s) => s.project_id !== null);
    const unfiled = opts.sessions.filter((s) => s.project_id === null);
    const recent = unfiled.slice(0, RECENT_HUBS);
    const archived = unfiled.slice(RECENT_HUBS);

    const hubCount =
        opts.projects.length + recent.length + (archived.length > 0 ? 1 : 0);
    const hubUnits = fibonacciSphere(hubCount);
    let slot = 0;

    // Project stars: files in close, chats orbiting.
    for (const project of opts.projects) {
        const unit = hubUnits[slot++]!;
        const hubId = `project:${project.id}`;
        const color = project.color ?? "var(--primary)";
        const allDocs = opts.documents.filter((d) => d.project_id === project.id);
        const allSessions = filed.filter((s) => s.project_id === project.id);
        const docs = allDocs.slice(0, PROJECT_DOC_SAT);
        const sessions = allSessions.slice(0, PROJECT_SESSION_SAT);
        net.nodes.push({
            id: hubId,
            kind: "project",
            label: project.name,
            color,
            unit,
            r: PROJECT_R,
            primary: true,
            meta: {
                title: project.name,
                subtitle: project.description ?? "project",
                chips: docs.map((d) => ({ label: d.title })),
                foot: `${allSessions.length} chats · ${allDocs.length} files`,
            },
            payload: { project },
        });
        docs.forEach((doc, i) => {
            const dUnit = satelliteUnit(unit, i, docs.length, TOOL_SPREAD);
            const id = `${hubId}:doc:${doc.id}`;
            net.nodes.push({
                id,
                kind: "doc",
                label: doc.title,
                color,
                unit: dUnit,
                r: TOOL_R,
                parentId: hubId,
                primary: false,
                meta: { title: doc.title, subtitle: `file · ${project.name}` },
            });
            net.edges.push({ a: hubId, b: id });
        });
        sessions.forEach((s, i) => {
            const sUnit = satelliteUnit(unit, i, sessions.length, AGENT_SPREAD);
            const preset = s.preset_id ? presetById.get(s.preset_id) : undefined;
            const id = `session:${s.id}`;
            net.nodes.push({
                id,
                kind: "session",
                label: s.title,
                color: sessionColor(s, preset, agentsById),
                unit: sUnit,
                r: AGENT_R,
                parentId: hubId,
                primary: true,
                meta: {
                    title: s.title,
                    subtitle: preset ? preset.name : "no preset",
                    foot: `updated ${relativeTime(s.updated_at)}`,
                },
                payload: s,
            });
            net.edges.push({ a: hubId, b: id });
        });
    }

    // Recent unfiled sessions: their own stars with specialist satellites.
    for (const s of recent) {
        const unit = hubUnits[slot++]!;
        const preset = s.preset_id ? presetById.get(s.preset_id) : undefined;
        const defs = safeAgents(preset)
            .map((id) => agentsById.get(id))
            .filter((d): d is AgentDef => d !== undefined);
        const hubId = `session:${s.id}`;
        net.nodes.push({
            id: hubId,
            kind: "session",
            label: s.title,
            color: sessionColor(s, preset, agentsById),
            unit,
            r: HUB_R,
            primary: true,
            meta: {
                title: s.title,
                subtitle: preset
                    ? `${preset.name} · ${preset.provider}/${preset.model}`
                    : "no preset",
                chips: defs.map((d) => {
                    const info = agentInfo(d);
                    return { label: info.slug, color: info.color };
                }),
                foot: `updated ${relativeTime(s.updated_at)}`,
            },
            payload: s,
        });
        defs.forEach((def, k) =>
            attachAgent(net, hubId, unit, def, k, defs.length, hubId),
        );
    }

    // The outskirts: older chats as one dim star; click to unfold them.
    if (archived.length > 0) {
        const unit = hubUnits[slot++]!;
        const hubId = "archive";
        net.nodes.push({
            id: hubId,
            kind: "archive",
            label: `${archived.length} older`,
            color: ARCHIVE_COLOR,
            unit,
            r: HUB_R,
            primary: true,
            meta: {
                title: `${archived.length} older chats`,
                subtitle: opts.expanded
                    ? "Click a chat to open it · click here to fold them back."
                    : "Click to unfold them onto the globe.",
            },
            payload: { archive: true, count: archived.length },
        });
        if (opts.expanded) {
            const shown = archived.slice(0, ARCHIVE_SAT);
            shown.forEach((s, i) => {
                const sUnit = satelliteUnit(unit, i, shown.length, AGENT_SPREAD * 1.4);
                const preset = s.preset_id ? presetById.get(s.preset_id) : undefined;
                const id = `session:${s.id}`;
                net.nodes.push({
                    id,
                    kind: "session",
                    label: s.title,
                    color: sessionColor(s, preset, agentsById),
                    unit: sUnit,
                    r: AGENT_R,
                    parentId: hubId,
                    primary: true,
                    meta: {
                        title: s.title,
                        subtitle: preset ? preset.name : "no preset",
                        foot: `updated ${relativeTime(s.updated_at)}`,
                    },
                    payload: s,
                });
                net.edges.push({ a: hubId, b: id });
            });
        }
    }

    return net;
}

export const CATEGORY_INNER = 8;
export const EXO_SHELL = 1.75;
export const UNFILED_ID = "unfiled";

/**
 * Category-first universe. Top level (focusCategoryId null): one star per
 * category plus an "unfiled" star when untagged chats exist. Focused on a
 * category (or the "unfiled" sentinel): its projects as stars with their
 * chats/files clustered, direct chats as stars — newest CATEGORY_INNER on
 * the main sphere, the rest pushed to the exo-shell (shell EXO_SHELL),
 * reachable by zooming out.
 */
export function buildCategoryUniverse(opts: {
    categories: Category[];
    projects: Project[];
    sessions: ChatSession[];
    documents: Pick<Document, "id" | "title" | "project_id">[];
    presets: Preset[];
    agents: AgentDef[];
    focusCategoryId: string | null;
}): Network {
    const presetById = new Map(opts.presets.map((p) => [p.id, p]));
    const agentsById = new Map(opts.agents.map((a) => [a.id, a]));
    const projectById = new Map(opts.projects.map((p) => [p.id, p]));
    const net: Network = { nodes: [], edges: [] };
    const catOf = (s: ChatSession) => effectiveCategoryId(s, projectById);

    if (opts.focusCategoryId === null) {
        const unfiled = opts.sessions.filter((s) => catOf(s) === null);
        const stars = opts.categories.length + (unfiled.length > 0 ? 1 : 0);
        const units = fibonacciSphere(Math.max(1, stars));
        let slot = 0;
        for (const c of opts.categories) {
            const chats = opts.sessions.filter((s) => catOf(s) === c.id).length;
            const projects = opts.projects.filter((p) => p.category_id === c.id).length;
            net.nodes.push({
                id: `category:${c.id}`,
                kind: "category",
                label: c.name,
                color: c.color ?? "var(--primary)",
                unit: units[slot++]!,
                r: PROJECT_R + 0.4,
                primary: true,
                meta: {
                    title: c.name,
                    subtitle: "Click to open this category's sphere.",
                    foot: `${chats} chat${chats === 1 ? "" : "s"} · ${projects} project${projects === 1 ? "" : "s"}`,
                },
                payload: { categoryId: c.id },
            });
        }
        if (unfiled.length > 0) {
            net.nodes.push({
                id: `category:${UNFILED_ID}`,
                kind: "category",
                label: "unfiled",
                color: ARCHIVE_COLOR,
                unit: units[slot++]!,
                r: PROJECT_R,
                primary: true,
                meta: {
                    title: `${unfiled.length} unfiled chats`,
                    subtitle: "Chats without a category. Click to open.",
                },
                payload: { categoryId: UNFILED_ID },
            });
        }
        return net;
    }

    const focusId = opts.focusCategoryId;
    const projects = opts.projects.filter(
        (p) => focusId !== UNFILED_ID && p.category_id === focusId,
    );
    const projectIds = new Set(projects.map((p) => p.id));
    const direct = opts.sessions
        .filter((s) =>
            focusId === UNFILED_ID
                ? catOf(s) === null
                : catOf(s) === focusId && !projectIds.has(s.project_id ?? ""),
        )
        .sort((a, b) => b.updated_at - a.updated_at);
    const inner = direct.slice(0, CATEGORY_INNER);
    const exo = direct.slice(CATEGORY_INNER);

    const hubUnits = fibonacciSphere(Math.max(1, projects.length + inner.length));
    let slot = 0;

    for (const project of projects) {
        const unit = hubUnits[slot++]!;
        const hubId = `project:${project.id}`;
        const color = project.color ?? "var(--primary)";
        const allDocs = opts.documents.filter((d) => d.project_id === project.id);
        const allSessions = opts.sessions.filter((s) => s.project_id === project.id);
        const docs = allDocs.slice(0, PROJECT_DOC_SAT);
        const sessions = allSessions.slice(0, PROJECT_SESSION_SAT);
        net.nodes.push({
            id: hubId,
            kind: "project",
            label: project.name,
            color,
            unit,
            r: PROJECT_R,
            primary: true,
            meta: {
                title: project.name,
                subtitle: project.description ?? "project",
                foot: `${allSessions.length} chats · ${allDocs.length} files`,
            },
            payload: { project },
        });
        docs.forEach((doc, i) => {
            const dUnit = satelliteUnit(unit, i, docs.length, TOOL_SPREAD);
            const id = `${hubId}:doc:${doc.id}`;
            net.nodes.push({
                id, kind: "doc", label: doc.title, color, unit: dUnit,
                r: TOOL_R, parentId: hubId, primary: false,
                meta: { title: doc.title, subtitle: `file · ${project.name}` },
            });
            net.edges.push({ a: hubId, b: id });
        });
        sessions.forEach((s, i) => {
            const sUnit = satelliteUnit(unit, i, sessions.length, AGENT_SPREAD);
            const preset = s.preset_id ? presetById.get(s.preset_id) : undefined;
            const id = `session:${s.id}`;
            net.nodes.push({
                id, kind: "session", label: s.title,
                color: sessionColor(s, preset, agentsById),
                unit: sUnit, r: AGENT_R, parentId: hubId, primary: true,
                meta: {
                    title: s.title,
                    subtitle: preset ? preset.name : "no preset",
                    foot: `updated ${relativeTime(s.updated_at)}`,
                },
                payload: s,
            });
            net.edges.push({ a: hubId, b: id });
        });
    }

    for (const s of inner) {
        const unit = hubUnits[slot++]!;
        const preset = s.preset_id ? presetById.get(s.preset_id) : undefined;
        net.nodes.push({
            id: `session:${s.id}`,
            kind: "session",
            label: s.title,
            color: sessionColor(s, preset, agentsById),
            unit,
            r: HUB_R,
            primary: true,
            meta: {
                title: s.title,
                subtitle: preset ? preset.name : "no preset",
                foot: `updated ${relativeTime(s.updated_at)}`,
            },
            payload: s,
        });
    }

    // Overflow: older chats orbit outside the chart circle — scroll out.
    const exoUnits = fibonacciSphere(Math.max(1, exo.length));
    exo.forEach((s, i) => {
        const preset = s.preset_id ? presetById.get(s.preset_id) : undefined;
        net.nodes.push({
            id: `session:${s.id}`,
            kind: "session",
            label: s.title,
            color: sessionColor(s, preset, agentsById),
            unit: exoUnits[i]!,
            r: AGENT_R,
            shell: EXO_SHELL,
            primary: true,
            meta: {
                title: s.title,
                subtitle: preset ? preset.name : "no preset",
                foot: `exo-sphere · updated ${relativeTime(s.updated_at)}`,
            },
            payload: s,
        });
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
