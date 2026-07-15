import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import * as projectsRepo from "@/db/repo/projects";
import type { Project } from "@/lib/schemas";
import type { NavTarget } from "@/app/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SESSION_COLORS } from "@/app/chat/InstancesSidebar";
import { ProjectDetail } from "./ProjectDetail";

export function ProjectsPage({
    onNavigate,
}: {
    onNavigate: (t: NavTarget) => void;
}) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [counts, setCounts] = useState<Record<string, projectsRepo.ProjectCounts>>({});
    const [openId, setOpenId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        const list = await projectsRepo.listProjects();
        setProjects(list);
        const entries = await Promise.all(
            list.map(async (p) => [p.id, await projectsRepo.projectCounts(p.id)] as const),
        );
        setCounts(Object.fromEntries(entries));
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);

    const create = async () => {
        setError(null);
        try {
            const color = SESSION_COLORS[projects.length % SESSION_COLORS.length]!;
            const p = await projectsRepo.createProject({ name, color });
            setName("");
            await reload();
            setOpenId(p.id);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    const open = openId ? projects.find((p) => p.id === openId) : undefined;
    if (open) {
        return (
            <ProjectDetail
                key={open.id}
                project={open}
                onBack={() => setOpenId(null)}
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
                <header>
                    <h1 className="font-display text-2xl font-semibold tracking-wide">
                        Projects
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Group chats, files, and bookmarks around one goal. Each
                        project is its own star on the chat constellation.
                    </p>
                </header>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <div className="flex items-end gap-2">
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        New project
                        <Input
                            value={name}
                            placeholder="e.g. Apartment hunt"
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") void create();
                            }}
                        />
                    </label>
                    <Button onClick={() => void create()} aria-label="Create project">
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {projects.map((p) => {
                        const c = counts[p.id];
                        return (
                            <Card
                                key={p.id}
                                corners
                                className="cursor-pointer transition-colors hover:border-primary/40"
                                style={{ borderLeft: `2px solid ${p.color ?? "var(--primary)"}` }}
                                onClick={() => setOpenId(p.id)}
                            >
                                <CardHeader>
                                    <CardTitle>{p.name}</CardTitle>
                                    {p.description && (
                                        <p className="text-xs text-muted-foreground">
                                            {p.description}
                                        </p>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                        {c
                                            ? `${c.sessions} chats · ${c.documents} files · ${c.bookmarks} bookmarks`
                                            : "…"}
                                    </span>
                                </CardContent>
                            </Card>
                        );
                    })}
                    {projects.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            No projects yet — name one above.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
