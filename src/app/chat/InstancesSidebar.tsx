import { useCallback, useEffect, useRef, useState } from "react";
import {
    Check,
    ChevronDown,
    ChevronRight,
    PanelLeftClose,
    PanelLeftOpen,
    Plus,
    Trash2,
    X,
} from "lucide-react";
import { presetAgents } from "@/lib/schemas";
import type { ChatSession, PermissionLevel, Preset } from "@/lib/schemas";
import { sessionMessageCount } from "@/db/repo/messages";
import { agentColor } from "@/components/hud/AgentNode";
import { relativeTime, sessionColor } from "@/components/hud/networkData";
import { cn } from "@/lib/utils";

/**
 * Left panel listing every agent instance (chat session): open, expand for
 * details, delete (two-step), create from a preset, and highlight-sync with the
 * network sphere (hover a row ↔ hover its node).
 */
export function InstancesSidebar({
    sessions,
    presets,
    levels,
    activeId,
    highlightId,
    onOpen,
    onDelete,
    onHover,
    onNewChat,
}: {
    sessions: ChatSession[];
    presets: Preset[];
    levels: PermissionLevel[];
    activeId: string | null;
    highlightId: string | null;
    onOpen: (session: ChatSession) => void;
    onDelete: (session: ChatSession) => void;
    onHover: (sessionId: string | null) => void;
    onNewChat: (preset: Preset) => void;
}) {
    const [collapsed, setCollapsed] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const presetById = new Map(presets.map((p) => [p.id, p]));
    const levelById = new Map(levels.map((l) => [l.id, l]));

    const toggleExpand = useCallback(
        (id: string) => {
            setExpandedId((cur) => (cur === id ? null : id));
            if (counts[id] === undefined) {
                void sessionMessageCount(id).then((n) =>
                    setCounts((cc) => ({ ...cc, [id]: n })),
                );
            }
        },
        [counts],
    );

    // Bring an externally-highlighted row (hovered node) into view.
    useEffect(() => {
        if (highlightId) rowRefs.current[highlightId]?.scrollIntoView({ block: "nearest" });
    }, [highlightId]);

    if (collapsed) {
        return (
            <div className="flex w-11 shrink-0 flex-col items-center gap-2 border-r border-border bg-background/85 py-3">
                <IconButton
                    label="Expand agents panel"
                    onClick={() => setCollapsed(false)}
                >
                    <PanelLeftOpen className="h-4 w-4" />
                </IconButton>
                <div className="mt-1 flex flex-col items-center gap-2 overflow-y-auto">
                    {sessions.map((s) => (
                        <button
                            key={s.id}
                            title={s.title}
                            onClick={() => onOpen(s)}
                            onPointerEnter={() => onHover(s.id)}
                            onPointerLeave={() => onHover(null)}
                            className={cn(
                                "h-3 w-3 rounded-full border transition-transform hover:scale-125",
                                (highlightId === s.id || activeId === s.id) &&
                                    "scale-125 ring-2 ring-offset-1 ring-offset-background",
                            )}
                            style={{
                                background: sessionColor(
                                    s.preset_id
                                        ? presetById.get(s.preset_id)
                                        : undefined,
                                ),
                                borderColor: "transparent",
                            }}
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-64 shrink-0 flex-col border-r border-border bg-background/85">
            <div className="flex items-center justify-between px-3 pb-2 pt-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                    Agents
                </div>
                <IconButton
                    label="Collapse agents panel"
                    onClick={() => setCollapsed(true)}
                >
                    <PanelLeftClose className="h-4 w-4" />
                </IconButton>
            </div>

            {/* New chat from a preset */}
            <div className="flex flex-wrap gap-1 px-2 pb-2">
                {presets.map((p) => (
                    <button
                        key={p.id}
                        onClick={() => onNewChat(p)}
                        className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-primary transition-colors hover:bg-primary/15"
                    >
                        <Plus className="h-3 w-3" /> {p.name}
                    </button>
                ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 [scrollbar-gutter:stable]">
                {sessions.length === 0 && (
                    <p className="px-2 py-4 text-xs text-muted-foreground">
                        No agents yet. Start one from a preset above.
                    </p>
                )}
                {sessions.map((s) => {
                    const preset = s.preset_id
                        ? presetById.get(s.preset_id)
                        : undefined;
                    const color = sessionColor(preset);
                    const active = activeId === s.id;
                    const highlit = highlightId === s.id;
                    const expanded = expandedId === s.id;
                    const agents = preset ? safeAgents(preset) : [];
                    return (
                        <div
                            key={s.id}
                            ref={(el) => {
                                rowRefs.current[s.id] = el;
                            }}
                            onPointerEnter={() => onHover(s.id)}
                            onPointerLeave={() => onHover(null)}
                            className={cn(
                                "mb-1 rounded-md border transition-colors",
                                active
                                    ? "border-primary/40 bg-primary/10"
                                    : highlit
                                      ? "border-primary/30 bg-primary/5"
                                      : "border-transparent hover:bg-muted/50",
                            )}
                        >
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ background: color }}
                                    aria-hidden
                                />
                                <button
                                    onClick={() => onOpen(s)}
                                    className="min-w-0 flex-1 text-left"
                                >
                                    <div className="truncate text-xs text-foreground">
                                        {s.title}
                                    </div>
                                    <div className="truncate font-mono text-[10px] text-muted-foreground">
                                        {preset
                                            ? preset.name
                                            : "no preset"}
                                    </div>
                                </button>

                                {confirmingId === s.id ? (
                                    <div className="flex items-center gap-0.5">
                                        <IconButton
                                            label="Confirm delete"
                                            onClick={() => {
                                                setConfirmingId(null);
                                                onDelete(s);
                                            }}
                                            className="text-destructive hover:text-destructive"
                                        >
                                            <Check className="h-3.5 w-3.5" />
                                        </IconButton>
                                        <IconButton
                                            label="Cancel delete"
                                            onClick={() => setConfirmingId(null)}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </IconButton>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-0.5">
                                        <IconButton
                                            label="Delete agent"
                                            onClick={() => setConfirmingId(s.id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </IconButton>
                                        <IconButton
                                            label={
                                                expanded ? "Hide details" : "Show details"
                                            }
                                            onClick={() => toggleExpand(s.id)}
                                        >
                                            {expanded ? (
                                                <ChevronDown className="h-3.5 w-3.5" />
                                            ) : (
                                                <ChevronRight className="h-3.5 w-3.5" />
                                            )}
                                        </IconButton>
                                    </div>
                                )}
                            </div>

                            {expanded && (
                                <div className="flex flex-col gap-1.5 border-t border-border/60 px-3 py-2 text-[11px]">
                                    <Detail label="Model">
                                        {preset
                                            ? `${preset.provider}/${preset.model}`
                                            : "—"}
                                    </Detail>
                                    <Detail label="Agents">
                                        {agents.length ? (
                                            <div className="flex flex-wrap gap-1">
                                                {agents.map((a) => (
                                                    <span
                                                        key={a}
                                                        className="rounded-sm px-1 py-0.5 font-mono text-[9px]"
                                                        style={{
                                                            color: agentColor(a),
                                                            background: `color-mix(in oklab, ${agentColor(a)} 15%, transparent)`,
                                                        }}
                                                    >
                                                        {a}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            "orchestrator only"
                                        )}
                                    </Detail>
                                    <Detail label="Permissions">
                                        {s.permission_level_id
                                            ? (levelById.get(s.permission_level_id)?.name ??
                                              "custom")
                                            : "Ask everything"}
                                    </Detail>
                                    <Detail label="Messages">
                                        {counts[s.id] ?? "…"}
                                    </Detail>
                                    <Detail label="Updated">
                                        {relativeTime(s.updated_at)}
                                    </Detail>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function safeAgents(preset: Preset): string[] {
    try {
        return presetAgents(preset);
    } catch {
        return [];
    }
}

function Detail({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                {label}
            </span>
            <span className="min-w-0 flex-1 text-right text-foreground/90">
                {children}
            </span>
        </div>
    );
}

function IconButton({
    label,
    onClick,
    className,
    children,
}: {
    label: string;
    onClick: () => void;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            onClick={onClick}
            className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                className,
            )}
        >
            {children}
        </button>
    );
}
