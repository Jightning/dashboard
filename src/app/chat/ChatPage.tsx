import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { Plus } from "lucide-react";
import { useRuntime } from "@/app/runtime";
import { tauriFetch } from "@/ai/providers/tauriFetch";
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
import type { ChatSession, PermissionLevel, Preset } from "@/lib/schemas";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { ApprovalCards } from "@/components/chat/ApprovalCard";
import { TokenMeter } from "@/components/chat/TokenMeter";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

interface ActiveChat {
    session: ChatSession;
    preset: Preset;
    permissions: PermissionContext;
    chatContext: SessionChatContext;
    initialMessages: UIMessage[];
}

export function ChatPage() {
    const { settings } = useRuntime();
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [presets, setPresets] = useState<Preset[]>([]);
    const [levels, setLevels] = useState<PermissionLevel[]>([]);
    const [active, setActive] = useState<ActiveChat | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void (async () => {
            setSessions(await sessionsRepo.listSessions());
            setPresets(await listPresets());
            setLevels(await listLevels());
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
                        fetch: tauriFetch,
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

    return (
        <div className="flex h-full flex-col">
            <header className="flex items-center gap-3 border-b border-border px-4 py-2">
                <Select
                    value={active?.session.id ?? ""}
                    onChange={(e) => {
                        const s = sessions.find((x) => x.id === e.target.value);
                        if (s) void openSession(s);
                    }}
                >
                    <option value="" disabled>
                        {sessions.length ? "Open a chat…" : "No chats yet"}
                    </option>
                    {sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.title}
                        </option>
                    ))}
                </Select>
                {active && <LevelDropdown active={active} levels={levels} />}
                <div className="flex-1" />
                {presets.map((p) => (
                    <Button
                        key={p.id}
                        size="sm"
                        variant="outline"
                        onClick={() => void newChat(p)}
                    >
                        <Plus className="h-3 w-3" /> {p.name}
                    </Button>
                ))}
            </header>

            {error && (
                <div className="p-3 text-sm text-destructive">{error}</div>
            )}

            {active ? (
                <ActiveChatView key={active.session.id} active={active} />
            ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                    Start a new chat with a preset, or open an existing one.
                </div>
            )}
        </div>
    );
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
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Permissions
            <Select
                className="h-8"
                value={levelId}
                onChange={(e) => void change(e.target.value)}
            >
                <option value="">Ask everything</option>
                {levels.map((l) => (
                    <option key={l.id} value={l.id}>
                        {l.name}
                    </option>
                ))}
            </Select>
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
                      { settings, fetch: tauriFetch },
                  ),
                  audio,
              })
        : undefined;

    return (
        <>
            <div className="flex items-center justify-between px-4 py-1.5">
                <span className="text-xs text-muted-foreground">
                    {active.preset.name} · {active.preset.provider}/
                    {active.preset.model}
                </span>
                <TokenMeter
                    totals={totals}
                    budget={active.preset.token_budget}
                />
            </div>
            <MessageList messages={messages} />
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
