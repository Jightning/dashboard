import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { listSessions } from "@/db/repo/sessions";
import { listDocuments } from "@/db/repo/documents";
import { listNotes } from "@/db/repo/notes";
import { listPresets } from "@/db/repo/presets";
import { listOpenTasks } from "@/db/repo/tasks";
import { listEventsBetween } from "@/db/repo/events";
import { listFollowUpsDue } from "@/db/repo/applications";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NeuralCore } from "@/components/hud/NeuralCore";
import { Typewriter } from "@/components/hud/Typewriter";
import type { Application, CalendarEvent, Task } from "@/lib/schemas";

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

export function HomePage() {
    const [stats, setStats] = useState<HomeStats | null>(null);
    const [today, setToday] = useState<{
        events: CalendarEvent[];
        dueTasks: Task[];
        followUps: Application[];
    } | null>(null);

    useEffect(() => {
        void (async () => {
            const [sessions, notes, documents, presets] = await Promise.all([
                listSessions(),
                listNotes(),
                listDocuments(),
                listPresets(),
            ]);
            setStats({
                sessions: sessions.length,
                notes: notes.length,
                documents: documents.length,
                presets: presets.length,
            });
            setToday({
                events: await listEventsBetween(
                    Date.now() - 12 * 3_600_000,
                    endOfToday(),
                ),
                dueTasks: await listOpenTasks({ dueBefore: endOfToday() + 2 * DAY }),
                followUps: await listFollowUpsDue(endOfToday()),
            });
        })();
    }, []);

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mx-auto flex max-w-4xl flex-col gap-6">
                <header className="flex items-end justify-between gap-4">
                    <div>
                        <h1 className="font-display text-2xl font-bold tracking-wide">
                            <Typewriter text={greeting()} />
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            All systems nominal — awaiting directive.
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

                <div className="flex items-center gap-6">
                    <NeuralCore size={220} state="idle" className="shrink-0" />
                    <div className="grid flex-1 grid-cols-2 gap-3">
                        <StatTile
                            index={0}
                            label="chat sessions"
                            value={stats?.sessions}
                        />
                        <StatTile
                            index={1}
                            label="notes"
                            value={stats?.notes}
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
                        />
                    </div>
                </div>

                <section>
                    <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Today
                    </h2>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <Card corners className="flex flex-col gap-2 p-4">
                            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                schedule
                            </span>
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
                                    No classes today.
                                </span>
                            )}
                        </Card>
                        <Card corners className="flex flex-col gap-2 p-4">
                            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                due next 48h
                            </span>
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
                                    Nothing due. Suspicious — check the Tasks
                                    page.
                                </span>
                            )}
                        </Card>
                        <Card corners className="flex flex-col gap-2 p-4">
                            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                follow-ups due
                            </span>
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
}: {
    label: string;
    value: number | undefined;
    index: number;
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
            <Card corners className="flex flex-col gap-1 p-4">
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
