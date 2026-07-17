import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import * as categoriesRepo from "@/db/repo/categories";
import * as projectsRepo from "@/db/repo/projects";
import type { Category, Project } from "@/lib/schemas";
import type { NavTarget } from "@/app/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SESSION_COLORS } from "@/app/chat/InstancesSidebar";
import { ProjectDetail } from "@/app/projects/ProjectDetail";
import { CategoryDetail } from "./CategoryDetail";

export function CategoriesPage({
    onNavigate,
    initialProjectId,
}: {
    onNavigate: (t: NavTarget) => void;
    initialProjectId?: string;
}) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [counts, setCounts] = useState<Record<string, categoriesRepo.CategoryCounts>>({});
    const [looseProjects, setLooseProjects] = useState<Project[]>([]);
    const [openId, setOpenId] = useState<string | null>(null);
    const [openProject, setOpenProject] = useState<Project | null>(null);
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        const list = await categoriesRepo.listCategories();
        setCategories(list);
        const entries = await Promise.all(
            list.map(async (c) => [c.id, await categoriesRepo.categoryCounts(c.id)] as const),
        );
        setCounts(Object.fromEntries(entries));
        setLooseProjects(
            (await projectsRepo.listProjects()).filter((p) => p.category_id === null),
        );
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);

    // Deep link (e.g. "open this project" from a network sphere's star).
    useEffect(() => {
        if (!initialProjectId) return;
        void projectsRepo
            .getProject(initialProjectId)
            .then((p) => setOpenProject(p))
            .catch(() => setOpenProject(null));
    }, [initialProjectId]);

    const create = async () => {
        setError(null);
        try {
            const color = SESSION_COLORS[categories.length % SESSION_COLORS.length]!;
            const c = await categoriesRepo.createCategory({ name, color });
            setName("");
            await reload();
            setOpenId(c.id);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
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

    const open = openId ? categories.find((c) => c.id === openId) : undefined;
    if (open) {
        return (
            <CategoryDetail
                key={open.id}
                category={open}
                onBack={() => setOpenId(null)}
                onChanged={reload}
                onNavigate={onNavigate}
            />
        );
    }

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
                <header>
                    <h1 className="font-display text-2xl font-semibold tracking-wide">
                        Categories
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        One tag for everything — projects, chats, tasks, and
                        notes all file under a category and filter by it.
                    </p>
                </header>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <div className="flex items-end gap-2">
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        New category
                        <Input
                            value={name}
                            placeholder="e.g. Career"
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") void create();
                            }}
                        />
                    </label>
                    <Button onClick={() => void create()} aria-label="Create category">
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {categories.map((c) => {
                        const n = counts[c.id];
                        return (
                            <Card
                                key={c.id}
                                corners
                                className="cursor-pointer transition-colors hover:border-primary/40"
                                style={{ borderLeft: `2px solid ${c.color ?? "var(--primary)"}` }}
                                onClick={() => setOpenId(c.id)}
                            >
                                <CardHeader>
                                    <CardTitle>{c.name}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                        {n
                                            ? `${n.projects} projects · ${n.sessions} chats · ${n.tasks} tasks · ${n.notes} notes`
                                            : "…"}
                                    </span>
                                </CardContent>
                            </Card>
                        );
                    })}
                    {categories.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            No categories yet — name one above.
                        </p>
                    )}
                </div>
                {looseProjects.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                            Projects without a category
                        </h2>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {looseProjects.map((p) => (
                                <Card
                                    key={p.id}
                                    className="cursor-pointer transition-colors hover:border-primary/40"
                                    style={{ borderLeft: `2px solid ${p.color ?? "var(--primary)"}` }}
                                    onClick={() => setOpenProject(p)}
                                >
                                    <CardHeader>
                                        <CardTitle>{p.name}</CardTitle>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
