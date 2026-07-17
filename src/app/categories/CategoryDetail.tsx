import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Plus, Trash2 } from "lucide-react";
import * as categoriesRepo from "@/db/repo/categories";
import * as projectsRepo from "@/db/repo/projects";
import * as sessionsRepo from "@/db/repo/sessions";
import * as tasksRepo from "@/db/repo/tasks";
import * as notesRepo from "@/db/repo/notes";
import type { Category, ChatSession, NoteSummary, Project, Task } from "@/lib/schemas";
import type { NavTarget } from "@/app/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TabBar } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectDetail } from "@/app/projects/ProjectDetail";
import { SESSION_COLORS } from "@/app/chat/InstancesSidebar";
import { relativeTime } from "@/components/hud/networkData";

type Tab = "projects" | "chats" | "tasks" | "notes";
const TABS: { id: Tab; label: string }[] = [
    { id: "projects", label: "Projects" },
    { id: "chats", label: "Chats" },
    { id: "tasks", label: "Tasks" },
    { id: "notes", label: "Notes" },
];

export function CategoryDetail({
    category,
    onBack,
    onChanged,
    onNavigate,
}: {
    category: Category;
    onBack: () => void;
    onChanged: () => Promise<void>;
    onNavigate: (t: NavTarget) => void;
}) {
    const [tab, setTab] = useState<Tab>("projects");
    const [projects, setProjects] = useState<Project[]>([]);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [notes, setNotes] = useState<NoteSummary[]>([]);
    const [openProject, setOpenProject] = useState<Project | null>(null);
    const [newProject, setNewProject] = useState("");
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setProjects(await projectsRepo.listProjects({ categoryId: category.id }));
        setSessions(await sessionsRepo.listSessions({ categoryId: category.id }));
        setTasks(await tasksRepo.listOpenTasks({ categoryId: category.id }));
        setNotes(await notesRepo.listNotes({ categoryId: category.id }));
    }, [category.id]);
    useEffect(() => {
        void reload();
    }, [reload]);

    const act = async (fn: () => Promise<unknown>) => {
        setError(null);
        try {
            await fn();
            await reload();
            await onChanged();
            return true;
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            return false;
        }
    };

    if (openProject) {
        return (
            <ProjectDetail
                key={openProject.id}
                project={openProject}
                onBack={() => setOpenProject(null)}
                onChanged={reload}
                onOpenChat={(sessionId) =>
                    onNavigate({ page: "agents", tab: "chat", sessionId })
                }
            />
        );
    }

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
                <header className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" aria-label="Back" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <span
                        aria-hidden
                        className="h-3 w-3 rounded-full"
                        style={{ background: category.color ?? "var(--primary)" }}
                    />
                    <h1 className="flex-1 font-display text-2xl font-semibold tracking-wide">
                        {category.name}
                    </h1>
                    {confirmingDelete ? (
                        <>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                    void act(() =>
                                        categoriesRepo.deleteCategory(category.id),
                                    ).then((ok) => {
                                        if (ok) onBack();
                                    })
                                }
                            >
                                Confirm — untag everything
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                                Cancel
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${category.name}`}
                            onClick={() => setConfirmingDelete(true)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </header>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <TabBar tabs={TABS} active={tab} onSelect={setTab} />

                {tab === "projects" && (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-end gap-2">
                            <label className="flex flex-1 flex-col gap-1 text-sm">
                                New project in {category.name}
                                <Input
                                    value={newProject}
                                    onChange={(e) => setNewProject(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && newProject.trim())
                                            void act(async () => {
                                                const color =
                                                    SESSION_COLORS[
                                                        projects.length % SESSION_COLORS.length
                                                    ]!;
                                                await projectsRepo.createProject({
                                                    name: newProject,
                                                    color,
                                                    categoryId: category.id,
                                                });
                                                setNewProject("");
                                            });
                                    }}
                                />
                            </label>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {projects.map((p) => (
                                <Card
                                    key={p.id}
                                    className="cursor-pointer transition-colors hover:border-primary/40"
                                    style={{ borderLeft: `2px solid ${p.color ?? "var(--primary)"}` }}
                                    onClick={() => setOpenProject(p)}
                                >
                                    <CardHeader>
                                        <CardTitle>{p.name}</CardTitle>
                                        {p.description && (
                                            <p className="text-xs text-muted-foreground">
                                                {p.description}
                                            </p>
                                        )}
                                    </CardHeader>
                                </Card>
                            ))}
                            {projects.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    No projects here yet.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {tab === "chats" && (
                    <div className="flex flex-col gap-1.5">
                        {sessions.map((s) => (
                            <button
                                key={s.id}
                                className="flex items-center gap-3 rounded-md border border-border bg-card/60 px-3 py-2 text-left hover:border-primary/40"
                                onClick={() =>
                                    onNavigate({ page: "agents", tab: "chat", sessionId: s.id })
                                }
                            >
                                <span
                                    aria-hidden
                                    className="h-2 w-2 rounded-full"
                                    style={{ background: s.color ?? "var(--primary)" }}
                                />
                                <span className="flex-1 text-sm">{s.title}</span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                    {relativeTime(s.updated_at)}
                                </span>
                            </button>
                        ))}
                        {sessions.length === 0 && (
                            <p className="text-sm text-muted-foreground">No chats filed here.</p>
                        )}
                    </div>
                )}

                {tab === "tasks" && (
                    <div className="flex flex-col gap-1.5">
                        {tasks.map((t) => (
                            <div
                                key={t.id}
                                className="flex items-center gap-3 rounded-md border border-border bg-card/60 px-3 py-2"
                            >
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Complete ${t.title}`}
                                    onClick={() => void act(() => tasksRepo.completeTask(t.id))}
                                >
                                    <Check className="h-4 w-4" />
                                </Button>
                                <span className="flex-1 text-sm">{t.title}</span>
                                {t.due_at !== null && (
                                    <span className="font-mono text-[10px] text-muted-foreground">
                                        {new Date(t.due_at).toLocaleDateString()}
                                    </span>
                                )}
                            </div>
                        ))}
                        {tasks.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                Nothing open.{" "}
                                <button
                                    className="cursor-pointer underline"
                                    onClick={() => onNavigate({ page: "planner", tab: "tasks" })}
                                >
                                    Add one in the Planner.
                                </button>
                            </p>
                        )}
                    </div>
                )}

                {tab === "notes" && (
                    <div className="flex flex-col gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            className="self-start"
                            onClick={() =>
                                void act(async () => {
                                    await notesRepo.createNote({
                                        title: "Untitled",
                                        categoryId: category.id,
                                    });
                                }).then((ok) => {
                                    if (ok)
                                        onNavigate({
                                            page: "notes",
                                            tab: "notes",
                                        });
                                })
                            }
                        >
                            <Plus className="mr-1 h-3.5 w-3.5" /> New note here
                        </Button>
                        {notes.map((n) => (
                            <button
                                key={n.id}
                                className="flex items-center gap-3 rounded-md border border-border bg-card/60 px-3 py-2 text-left hover:border-primary/40"
                                onClick={() => onNavigate({ page: "notes", tab: "notes" })}
                            >
                                <span className="flex-1 text-sm">{n.title}</span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                    {relativeTime(n.updated_at)}
                                </span>
                            </button>
                        ))}
                        {notes.length === 0 && (
                            <p className="text-sm text-muted-foreground">No notes filed here.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
