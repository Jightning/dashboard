import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { listSessions } from "@/db/repo/sessions";
import { listDocuments } from "@/db/repo/documents";
import { listNotes } from "@/db/repo/notes";
import { listPresets } from "@/db/repo/presets";
import { listOpenTasks, createTask } from "@/db/repo/tasks";
import { listEventsBetween } from "@/db/repo/events";
import { listFollowUpsDue } from "@/db/repo/applications";
import { countDueFlashcards } from "@/db/repo/flashcards";
import { listBookmarks } from "@/db/repo/library";
import { createNote } from "@/db/repo/notes";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NeuralCore } from "@/components/hud/NeuralCore";
import { Typewriter } from "@/components/hud/Typewriter";
import { relativeTime } from "@/components/hud/networkData";
import { openExternal } from "@/lib/openExternal";
import { cn } from "@/lib/utils";
import type { NavTarget } from "@/app/Sidebar";
import type { Application, Bookmark, CalendarEvent, ChatSession, Task } from "@/lib/schemas";

interface HomeStats {
    sessions: number;
    notes: number;
    documents: number;
    presets: number;
}

const DAY = 86_400_000;

function endOfToday(): number {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
}

function greeting(): string {
    const hour = new Date().getHours();
    if (hour < 5) return "Working late.";
    if (hour < 12) return "Good morning.";
    if (hour < 18) return "Good afternoon.";
    return "Good evening.";
}

export function HomePage({
    onNavigate,
}: { onNavigate?: (t: NavTarget) => void } = {}) {
    const [stats, setStats] = useState<HomeStats | null>(null);
    const [recent, setRecent] = useState<ChatSession[]>([]);
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [today, setToday] = useState<{
        events: CalendarEvent[];
        dueTasks: Task[];
        followUps: Application[];
        reviewDue: number;
    } | null>(null);

    useEffect(() => {
        void (async () => {
            const [sessions, notes, documents, presets, bmks] = await Promise.all([
                listSessions(),
                listNotes(),
                listDocuments(),
                listPresets(),
                listBookmarks(),
            ]);
            setStats({
                sessions: sessions.length,
                notes: notes.length,
                documents: documents.length,
                presets: presets.length,
            });
            setRecent(sessions.slice(0, 3));
            setBookmarks(bmks.slice(0, 8));
            setToday({
                events: await listEventsBetween(
                    Date.now() - 12 * 3_600_000,
                    endOfToday(),
                ),
                dueTasks: await listOpenTasks({ dueBefore: endOfToday() + 2 * DAY }),
                followUps: await listFollowUpsDue(endOfToday()),
                reviewDue: await countDueFlashcards(Date.now()),
            });
        })();
    }, []);

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mx-auto flex max-w-4xl flex-col gap-6">
                <header className="flex items-end justify-between gap-4">
                    <div>
                        <h1 className="font-display text-2xl font-semibold tracking-wide">
                            <Typewriter text={greeting()} />
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Clear skies. The plate is developed — what are we
                            looking for?
                        </p>
                    </div>
                    <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        {new Date().toLocaleDateString(undefined, {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                        })}
                    </div>
                </header>

                <QuickCapture onNavigate={onNavigate} />

                <div className="flex items-center gap-6">
                    <NeuralCore size={220} state="idle" className="shrink-0" />
                    <div className="grid flex-1 grid-cols-2 gap-3">
                        <StatTile
                            index={0}
                            label="chat sessions"
                            value={stats?.sessions}
                            onClick={() =>
                                onNavigate?.({ page: "agents", tab: "chat" })
                            }
                        />
                        <StatTile
                            index={1}
                            label="notes"
                            value={stats?.notes}
                            onClick={() =>
                                onNavigate?.({ page: "notes", tab: "notes" })
                            }
                        />
                        <StatTile
                            index={2}
                            label="documents indexed"
                            value={stats?.documents}
                        />
                        <StatTile
                            index={3}
                            label="context presets"
                            value={stats?.presets}
                            onClick={() => onNavigate?.({ page: "presets" })}
                        />
                    </div>
                </div>

                {recent.length > 0 && (
                    <section>
                        <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Recent chats
                        </h2>
                        <div className="flex flex-col gap-1">
                            {recent.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() =>
                                        onNavigate?.({
                                            page: "agents",
                                            tab: "chat",
                                            sessionId: s.id,
                                        })
                                    }
                                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors duration-(--dur-fast) hover:bg-accent"
                                >
                                    <span
                                        aria-hidden
                                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                                        style={{
                                            backgroundColor:
                                                s.color ?? "var(--primary)",
                                        }}
                                    />
                                    <span className="flex-1 truncate text-sm">
                                        {s.title}
                                    </span>
                                    <span className="font-mono text-[10px] text-muted-foreground">
                                        {relativeTime(s.updated_at)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {bookmarks.length > 0 && (
                    <section>
                        <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Bookmarks
                        </h2>
                        <div className="flex flex-wrap gap-1.5">
                            {bookmarks.map((b) => (
                                <button
                                    key={b.id}
                                    onClick={() => void openExternal(b.url)}
                                    className="cursor-pointer rounded-full border border-border px-2.5 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                                >
                                    {b.title}
                                </button>
                            ))}
                            <button
                                onClick={() =>
                                    onNavigate?.({
                                        page: "notes",
                                        tab: "bookmarks",
                                    })
                                }
                                className="cursor-pointer rounded-full px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground hover:text-foreground"
                            >
                                all →
                            </button>
                        </div>
                    </section>
                )}

                <section>
                    <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Today
                    </h2>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <Card corners className="flex flex-col gap-2 p-4">
                            <button
                                onClick={() =>
                                    onNavigate?.({
                                        page: "planner",
                                        tab: "calendar",
                                    })
                                }
                                className="cursor-pointer self-start font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-primary"
                            >
                                schedule
                            </button>
                            {today?.events.length ? (
                                today.events.map((e) => (
                                    <div
                                        key={e.id}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <span className="w-16 font-mono text-xs text-primary">
                                            {new Date(
                                                e.starts_at,
                                            ).toLocaleTimeString(undefined, {
                                                hour: "numeric",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                        <span className="flex-1 truncate">
                                            {e.title}
                                        </span>
                                        {e.location && (
                                            <span className="font-mono text-[10px] text-muted-foreground">
                                                {e.location}
                                            </span>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <span className="text-xs text-muted-foreground">
                                    Nothing scheduled today.
                                </span>
                            )}
                        </Card>
                        <Card corners className="flex flex-col gap-2 p-4">
                            <button
                                onClick={() =>
                                    onNavigate?.({
                                        page: "planner",
                                        tab: "tasks",
                                    })
                                }
                                className="cursor-pointer self-start font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-primary"
                            >
                                due next 48h
                            </button>
                            {today?.dueTasks.length ? (
                                today.dueTasks.map((t) => (
                                    <div
                                        key={t.id}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <span className="flex-1 truncate">
                                            {t.title}
                                        </span>
                                        <Badge
                                            tone={
                                                (t.due_at ?? 0) < Date.now()
                                                    ? "destructive"
                                                    : "warning"
                                            }
                                        >
                                            {new Date(
                                                t.due_at!,
                                            ).toLocaleString(undefined, {
                                                weekday: "short",
                                                hour: "numeric",
                                            })}
                                        </Badge>
                                    </div>
                                ))
                            ) : (
                                <span className="text-xs text-muted-foreground">
                                    Nothing due. Suspicious — check the
                                    Planner.
                                </span>
                            )}
                            {today && (
                                <span className="mt-1 font-mono text-[10px] uppercase tracking-wider text-primary">
                                    {today.reviewDue > 0
                                        ? `${today.reviewDue} flashcards due`
                                        : "reviews clear"}
                                </span>
                            )}
                        </Card>
                        <Card corners className="flex flex-col gap-2 p-4">
                            <button
                                onClick={() =>
                                    onNavigate?.({
                                        page: "planner",
                                        tab: "applications",
                                    })
                                }
                                className="cursor-pointer self-start font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-primary"
                            >
                                follow-ups due
                            </button>
                            {today?.followUps.length ? (
                                today.followUps.map((a) => (
                                    <div
                                        key={a.id}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <span className="flex-1 truncate">
                                            {a.company} — {a.next_action}
                                        </span>
                                        <Badge tone="warning">
                                            {new Date(
                                                a.next_action_at!,
                                            ).toLocaleDateString(undefined, {
                                                month: "short",
                                                day: "numeric",
                                            })}
                                        </Badge>
                                    </div>
                                ))
                            ) : (
                                <span className="text-xs text-muted-foreground">
                                    All caught up.
                                </span>
                            )}
                        </Card>
                    </div>
                </section>
            </div>
        </div>
    );
}

function StatTile({
    label,
    value,
    index,
    onClick,
}: {
    label: string;
    value: number | undefined;
    index: number;
    onClick?: () => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                delay: 0.05 * index,
                duration: 0.3,
                ease: [0.16, 1, 0.3, 1],
            }}
        >
            <Card
                corners
                onClick={onClick}
                className={cn(
                    "flex flex-col gap-1 p-4",
                    onClick &&
                        "cursor-pointer transition-colors duration-(--dur-fast) hover:border-primary/50 hover:bg-accent/40",
                )}
            >
                <span className="font-mono text-3xl text-primary text-glow">
                    {value ?? "–"}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {label}
                </span>
            </Card>
        </motion.div>
    );
}

function QuickCapture({
    onNavigate,
}: {
    onNavigate?: (t: NavTarget) => void;
}) {
    const [text, setText] = useState("");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const capture = async (kind: "task" | "note") => {
        const title = text.trim();
        if (!title || saving) return;
        setSaving(true);
        setError(null);
        try {
            if (kind === "task") {
                await createTask({ title });
                setSaved("Task added — see Planner.");
            } else {
                await createNote({ title });
                setSaved("Note created — see Notes.");
            }
            setText("");
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <Input
                value={text}
                placeholder="Capture a task or note…"
                onChange={(e) => {
                    setText(e.target.value);
                    setSaved(null);
                    setError(null);
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.repeat) void capture("task");
                }}
            />
            <Button size="sm" disabled={saving} onClick={() => void capture("task")}>
                Task
            </Button>
            <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => void capture("note")}
            >
                Note
            </Button>
            {error && (
                <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-destructive">
                    {error}
                </span>
            )}
            {saved && (
                <button
                    className="cursor-pointer whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    onClick={() =>
                        onNavigate?.(
                            saved.startsWith("Task")
                                ? { page: "planner", tab: "tasks" }
                                : { page: "notes", tab: "notes" },
                        )
                    }
                >
                    {saved}
                </button>
            )}
        </div>
    );
}
