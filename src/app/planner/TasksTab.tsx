import { useCallback, useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import * as tasksRepo from "@/db/repo/tasks";
import * as categoriesRepo from "@/db/repo/categories";
import type { Recurrence } from "@/lib/recurrence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FilterChips } from "@/components/ui/filterChips";
import type { Category, Task } from "@/lib/schemas";

const DAY = 86_400_000;

export function TasksTab() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setTasks(await tasksRepo.listOpenTasks());
        setCategories(await categoriesRepo.listCategories());
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);

    // If the category backing the active filter chip gets deleted, fall back
    // to "All" instead of silently showing an empty task list.
    useEffect(() => {
        if (categoryFilter && !categories.some((c) => c.id === categoryFilter)) {
            setCategoryFilter(null);
        }
    }, [categories, categoryFilter]);

    const act = async (fn: () => Promise<unknown>) => {
        setError(null);
        try {
            await fn();
            await reload();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    return (
        <div className="flex flex-col gap-6">
            {error && <p className="text-xs text-destructive">{error}</p>}
            <QuickAdd
                categories={categories}
                onAdd={(input) => act(() => tasksRepo.createTask(input))}
                onCreateCategory={async (name) => {
                    setError(null);
                    try {
                        const c = await categoriesRepo.createCategory({ name });
                        await reload();
                        return c.id;
                    } catch (e) {
                        setError(e instanceof Error ? e.message : String(e));
                        return null;
                    }
                }}
            />
            <FilterChips
                options={categories.map((c) => ({
                    id: c.id,
                    label: c.name,
                    color: c.color ?? undefined,
                }))}
                active={categoryFilter}
                onChange={setCategoryFilter}
            />
            <TaskList
                tasks={categoryFilter ? tasks.filter((t) => t.category_id === categoryFilter) : tasks}
                categories={categories}
                act={act}
            />
        </div>
    );
}

function QuickAdd({
    categories,
    onAdd,
    onCreateCategory,
}: {
    categories: Category[];
    onAdd: (input: tasksRepo.TaskInput) => Promise<void>;
    onCreateCategory: (name: string) => Promise<string | null>;
}) {
    const [title, setTitle] = useState("");
    const [due, setDue] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [creating, setCreating] = useState(false);
    const [newCategory, setNewCategory] = useState("");
    const [savingCategory, setSavingCategory] = useState(false);
    const [recurrence, setRecurrence] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const submit = async () => {
        if (!title.trim() || submitting) return;
        setSubmitting(true);
        try {
            await onAdd({
                title: title.trim(),
                categoryId: categoryId || null,
                dueAt: due ? new Date(due).getTime() : null,
                recurrence: (recurrence || null) as Recurrence | null,
            });
            setTitle("");
            setDue("");
            setRecurrence("");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm">
                New task
                <Input
                    value={title}
                    placeholder="e.g. Ship the quarterly report"
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.repeat && !submitting)
                            void submit();
                    }}
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Due
                <Input
                    type="datetime-local"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                />
            </label>
            <label className="flex w-36 flex-col gap-1 text-sm">
                Category
                {creating ? (
                    <Input
                        autoFocus
                        value={newCategory}
                        placeholder="name…"
                        onChange={(e) => setNewCategory(e.target.value)}
                        onKeyDown={(e) => {
                            if (
                                e.key === "Enter" &&
                                !e.repeat &&
                                !savingCategory &&
                                newCategory.trim()
                            ) {
                                setSavingCategory(true);
                                void onCreateCategory(newCategory.trim())
                                    .then((id) => {
                                        if (id) {
                                            setCategoryId(id);
                                            setCreating(false);
                                            setNewCategory("");
                                        }
                                    })
                                    .finally(() => setSavingCategory(false));
                            }
                            if (e.key === "Escape") setCreating(false);
                        }}
                    />
                ) : (
                    <Select
                        value={categoryId}
                        onChange={(e) => {
                            if (e.target.value === "__new") setCreating(true);
                            else setCategoryId(e.target.value);
                        }}
                    >
                        <option value="">—</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                        <option value="__new">+ new category…</option>
                    </Select>
                )}
            </label>
            <label className="flex w-28 flex-col gap-1 text-sm">
                Repeat
                <Select
                    value={recurrence}
                    onChange={(e) => setRecurrence(e.target.value)}
                >
                    <option value="">never</option>
                    <option value="daily">daily</option>
                    <option value="weekly">weekly</option>
                    <option value="monthly">monthly</option>
                </Select>
            </label>
            <Button
                onClick={() => void submit()}
                disabled={submitting}
                aria-label="Add task"
            >
                <Plus className="h-4 w-4" />
            </Button>
        </div>
    );
}

function dueTone(dueAt: number | null): "neutral" | "warning" | "destructive" {
    if (dueAt === null) return "neutral";
    if (dueAt < Date.now()) return "destructive";
    if (dueAt < Date.now() + 2 * DAY) return "warning";
    return "neutral";
}

function TaskList({
    tasks,
    categories,
    act,
}: {
    tasks: Task[];
    categories: Category[];
    act: (fn: () => Promise<unknown>) => Promise<void>;
}) {
    const categoryOf = (id: string | null) =>
        categories.find((c) => c.id === id);
    if (tasks.length === 0)
        return (
            <p className="text-sm text-muted-foreground">
                Nothing open. Add one above or ask the planner agent.
            </p>
        );
    return (
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
                    {categoryOf(t.category_id) && (
                        <Badge>
                            <span
                                aria-hidden
                                className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
                                style={{
                                    background:
                                        categoryOf(t.category_id)!.color ?? "var(--primary)",
                                }}
                            />
                            {categoryOf(t.category_id)!.name}
                        </Badge>
                    )}
                    {t.recurrence && <Badge tone="primary">{t.recurrence}</Badge>}
                    {t.due_at !== null && (
                        <Badge tone={dueTone(t.due_at)}>
                            {new Date(t.due_at).toLocaleString(undefined, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                            })}
                        </Badge>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${t.title}`}
                        onClick={() => void act(() => tasksRepo.deleteTask(t.id))}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ))}
        </div>
    );
}
