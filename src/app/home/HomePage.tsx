import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Bookmark, CalendarCheck, ScrollText } from "lucide-react";
import { listSessions } from "@/db/repo/sessions";
import { listDocuments } from "@/db/repo/documents";
import { listNotes } from "@/db/repo/notes";
import { listPresets } from "@/db/repo/presets";
import { Card } from "@/components/ui/card";
import { NeuralCore } from "@/components/hud/NeuralCore";
import { Typewriter } from "@/components/hud/Typewriter";
import { StubPanel } from "@/components/hud/StubPanel";

interface HomeStats {
    sessions: number;
    notes: number;
    documents: number;
    presets: number;
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
                        Modules — coming online
                    </h2>
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                        <StubPanel
                            icon={Bookmark}
                            title="Bookmarks"
                            phase="Phase 3"
                            description="Grouped links with favicons and a ⌘K palette to open anything fast."
                        />
                        <StubPanel
                            icon={ScrollText}
                            title="Snippets"
                            phase="Phase 3"
                            description="Reusable text snippets with one-click copy."
                        />
                        <StubPanel
                            icon={CalendarCheck}
                            title="Tasks"
                            phase="Phase 4"
                            description="Due dates, class schedule import, reminders — and the planner agent."
                        />
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
