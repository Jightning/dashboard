import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { presetAgents } from "@/lib/schemas";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { Shield } from "lucide-react";
import { useRuntime } from "@/app/runtime";
import { appFetch } from "@/ai/providers/appFetch";
import { applyPermissionLevel, buildSessionAgent } from "@/ai/agents/runtime";
import {
    createModel,
    supportsVision,
    type ProviderId,
} from "@/ai/providers/registry";
import { ingestPdf } from "@/ai/multimodal/pdf";
import { transcribeAudio } from "@/ai/multimodal/stt";
import {
    SessionTransport,
    rowToUiMessage,
    type SessionChatContext,
} from "@/ai/chat/transport";
import { UsageCollector } from "@/ai/context/tokens";
import type { PermissionContext } from "@/ai/tools/context";
import * as sessionsRepo from "@/db/repo/sessions";
import * as messagesRepo from "@/db/repo/messages";
import { getPreset, listPresets } from "@/db/repo/presets";
import { listLevels } from "@/db/repo/permissions";
import { listAgents } from "@/db/repo/agents";
import { listProjects } from "@/db/repo/projects";
import { listDocuments } from "@/db/repo/documents";
import type {
    AgentDef,
    ChatSession,
    Document,
    PermissionLevel,
    Preset,
    Project,
} from "@/lib/schemas";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { ApprovalCards } from "@/components/chat/ApprovalCard";
import { TokenMeter } from "@/components/chat/TokenMeter";
import { NetworkSphere } from "@/components/hud/NetworkSphere";
import {
    buildAgentTypeNetwork,
    buildUniverseNetwork,
} from "@/components/hud/networkData";
import { Typewriter } from "@/components/hud/Typewriter";
import { PermissionLevelSelect } from "@/components/PermissionLevelSelect";
import { InstancesSidebar } from "./InstancesSidebar";

interface ActiveChat {
    session: ChatSession;
    preset: Preset;
    permissions: PermissionContext;
    chatContext: SessionChatContext;
    initialMessages: UIMessage[];
}

export function ChatWorkspace({
    initialSessionId,
}: {
    initialSessionId?: string | null;
} = {}) {
    const { settings } = useRuntime();
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [presets, setPresets] = useState<Preset[]>([]);
    const [levels, setLevels] = useState<PermissionLevel[]>([]);
    const [agents, setAgents] = useState<AgentDef[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [docs, setDocs] = useState<
        Pick<Document, "id" | "title" | "project_id">[]
    >([]);
    const [archiveOpen, setArchiveOpen] = useState(false);
    const [active, setActive] = useState<ActiveChat | null>(null);
    const [error, setError] = useState<string | null>(null);
    // Session id highlighted by hovering a sphere node or a sidebar row.
    const [hoveredInstanceId, setHoveredInstanceId] = useState<string | null>(
        null,
    );

    useEffect(() => {
        void (async () => {
            setSessions(await sessionsRepo.listSessions());
            setPresets(await listPresets());
            setLevels(await listLevels());
            setAgents(await listAgents());
            setProjects(await listProjects());
            setDocs(await listDocuments());
        })();
    }, []);

    const openSession = useCallback(
        async (session: ChatSession) => {
            setError(null);
            try {
                if (!session.preset_id)
                    throw new Error("session has no preset");
                const preset = await getPreset(session.preset_id);
                const collector = new UsageCollector();
                const { orchestrator, permissions, summarize } =
                    await buildSessionAgent({
                        preset,
                        settings,
                        permissionLevelId: session.permission_level_id,
                        fetch: appFetch,
                        onUsage: collector.collect,
                    });
                const rows = await messagesRepo.listActiveMessages(session.id);
                setActive({
                    session,
                    preset,
                    permissions,
                    chatContext: {
                        sessionId: session.id,
                        preset,
                        orchestrator,
                        summarize,
                        collector,
                    },
                    initialMessages: rows.map(rowToUiMessage),
                });
            } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
            }
        },
        [settings],
    );

    // Deep link (e.g. "open this project chat" from the Projects page).
    useEffect(() => {
        if (!initialSessionId) return;
        void sessionsRepo
            .getSession(initialSessionId)
            .then(openSession)
            .catch((e: unknown) =>
                setError(e instanceof Error ? e.message : String(e)),
            );
    }, [initialSessionId, openSession]);

    const newChat = useCallback(
        async (preset: Preset) => {
            const session = await sessionsRepo.createSession({
                title: `${preset.name} chat`,
                presetId: preset.id,
                permissionLevelId: preset.permission_level_id,
            });
            setSessions(await sessionsRepo.listSessions());
            await openSession(session);
        },
        [openSession],
    );

    // No chat selected → the universe: project stars, recent chats, and an
    // archive star; with nothing yet, the static agent-type topology as an intro.
    const network = useMemo(
        () =>
            sessions.length || projects.length
                ? buildUniverseNetwork({
                      projects,
                      sessions,
                      documents: docs,
                      presets,
                      agents,
                      expanded: archiveOpen,
                  })
                : buildAgentTypeNetwork(agents),
        [sessions, projects, docs, presets, agents, archiveOpen],
    );

    const openFromNode = useCallback(
        (node: { kind: string; payload?: unknown }) => {
            if (node.kind === "archive") {
                setArchiveOpen((v) => !v);
                return;
            }
            if (node.kind === "project") {
                return; // project stars are context; management lives in Projects
            }
            if (node.kind === "session") {
                void openSession(node.payload as ChatSession);
                return;
            }
            // Fallback (no sessions yet): start a chat with a preset that
            // enables the clicked agent.
            const agent = (node.payload as { agent?: string } | undefined)
                ?.agent;
            if (!agent) return;
            const preset =
                presets.find((p) => {
                    try {
                        return presetAgents(p).includes(agent);
                    } catch {
                        return false;
                    }
                }) ?? presets[0];
            if (preset) void newChat(preset);
        },
        [openSession, newChat, presets],
    );

    const deleteInstance = useCallback(async (session: ChatSession) => {
        setError(null);
        try {
            await sessionsRepo.deleteSession(session.id);
            setSessions(await sessionsRepo.listSessions());
            setActive((cur) => (cur?.session.id === session.id ? null : cur));
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, []);

    const renameInstance = useCallback(
        async (session: ChatSession, title: string) => {
            if (title === session.title) return;
            await sessionsRepo.renameSession(session.id, title);
            setSessions(await sessionsRepo.listSessions());
            setActive((cur) =>
                cur?.session.id === session.id
                    ? { ...cur, session: { ...cur.session, title } }
                    : cur,
            );
        },
        [],
    );

    const recolorInstance = useCallback(
        async (session: ChatSession, color: string | null) => {
            await sessionsRepo.setSessionColor(session.id, color);
            setSessions(await sessionsRepo.listSessions());
        },
        [],
    );

    return (
        <div className="flex h-full">
            <InstancesSidebar
                sessions={sessions}
                projects={projects}
                presets={presets}
                levels={levels}
                agents={agents}
                activeId={active?.session.id ?? null}
                highlightId={hoveredInstanceId}
                onOpen={(s) => void openSession(s)}
                onDelete={(s) => void deleteInstance(s)}
                onHover={setHoveredInstanceId}
                onNewChat={(p) => void newChat(p)}
                onRename={(s, t) => void renameInstance(s, t)}
                onRecolor={(s, c) => void recolorInstance(s, c)}
            />

            <div className="flex min-w-0 flex-1 flex-col">
                {active && (
                    <header className="flex items-center gap-3 border-b border-border bg-background/85 px-4 py-2">
                        <LevelDropdown active={active} levels={levels} />
                    </header>
                )}

                {error && (
                    <div className="mx-4 mt-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 font-mono text-xs text-destructive">
                        {error}
                    </div>
                )}

                {active ? (
                    <ActiveChatView key={active.session.id} active={active} />
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3">
                        <NetworkSphere
                            nodes={network.nodes}
                            edges={network.edges}
                            size={320}
                            onSelect={openFromNode}
                            onHover={(node) =>
                                setHoveredInstanceId(sessionIdOf(node))
                            }
                            highlightId={
                                hoveredInstanceId
                                    ? `session:${hoveredInstanceId}`
                                    : null
                            }
                        />
                        <div className="font-mono text-sm uppercase tracking-[0.2em] text-primary text-glow">
                            <Typewriter text="standing by" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {sessions.length
                                ? "Hover a node or row to link them · click to open."
                                : "Start a chat from a preset in the sidebar."}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

/** Map a hovered network node to the session (instance) it belongs to. */
function sessionIdOf(
    node: { kind: string; payload?: unknown; parentId?: string } | null,
): string | null {
    if (!node) return null;
    if (node.kind === "session") return (node.payload as ChatSession).id;
    if (node.parentId?.startsWith("session:"))
        return node.parentId.slice("session:".length);
    return null;
}

function LevelDropdown({
    active,
    levels,
}: {
    active: ActiveChat;
    levels: PermissionLevel[];
}) {
    const [levelId, setLevelId] = useState(
        active.session.permission_level_id ?? "",
    );

    const change = async (value: string) => {
        setLevelId(value);
        await sessionsRepo.setSessionPermissionLevel(
            active.session.id,
            value || null,
        );
        await applyPermissionLevel(active.permissions, value || null);
    };

    return (
        <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <Shield aria-hidden className="h-3.5 w-3.5 text-primary/70" />
            Permissions
            <PermissionLevelSelect
                className="h-8 font-mono text-xs normal-case tracking-normal"
                levels={levels}
                value={levelId || null}
                onChange={(id) => void change(id ?? "")}
            />
        </label>
    );
}

function ActiveChatView({ active }: { active: ActiveChat }) {
    const { settings } = useRuntime();
    const [totals, setTotals] = useState({
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
    });

    const contextRef = useRef(active.chatContext);
    contextRef.current = active.chatContext;

    const refreshTotals = useCallback(() => {
        void messagesRepo
            .sessionUsageTotals(contextRef.current.sessionId)
            .then(setTotals);
    }, []);

    useEffect(refreshTotals, [refreshTotals]);

    const transport = useMemo(
        () =>
            new SessionTransport({
                getContext: () => contextRef.current,
                onPersisted: refreshTotals,
            }),
        [refreshTotals],
    );

    const { messages, sendMessage, status, stop } = useChat({
        id: active.session.id,
        messages: active.initialMessages,
        transport,
    });

    const busy = status === "streaming" || status === "submitted";

    const vision = supportsVision({
        provider: active.preset.provider as ProviderId,
        modelId: active.preset.model,
    });

    // STT runs on Gemini free tier (the only $0 audio-capable path in v1).
    const transcriber = settings.googleApiKey
        ? (audio: Blob) =>
              transcribeAudio({
                  model: createModel(
                      { provider: "google", modelId: "gemini-2.5-flash" },
                      { settings, fetch: appFetch },
                  ),
                  audio,
              })
        : undefined;

    return (
        <>
            <div className="flex items-center justify-between px-4 py-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {active.preset.name} · {active.preset.provider}/
                    {active.preset.model}
                </span>
                <TokenMeter
                    totals={totals}
                    budget={active.preset.token_budget}
                />
            </div>
            <MessageList messages={messages} busy={busy} />
            <div className="px-4 pb-2">
                <ApprovalCards broker={active.permissions.broker} />
            </div>
            <Composer
                busy={busy}
                visionEnabled={vision}
                ingestPdf={async (file) => {
                    const doc = await ingestPdf({
                        data: new Uint8Array(await file.arrayBuffer()),
                        fileName: file.name,
                    });
                    return { title: doc.title, folder: doc.folder };
                }}
                transcriber={transcriber}
                onSend={(text, files) =>
                    void sendMessage(
                        files.length > 0 ? { text, files } : { text },
                    )
                }
                onStop={() => {
                    active.permissions.broker.denyAll();
                    void stop();
                }}
            />
        </>
    );
}
