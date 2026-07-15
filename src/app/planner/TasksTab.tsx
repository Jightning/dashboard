import { useCallback, useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import * as tasksRepo from "@/db/repo/tasks";
import * as coursesRepo from "@/db/repo/courses";
import type { Recurrence } from "@/lib/recurrence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FilterChips } from "@/components/ui/filterChips";
import type { Course, Task } from "@/lib/schemas";

const DAY = 86_400_000;

export function TasksTab() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [courseFilter, setCourseFilter] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setTasks(await tasksRepo.listOpenTasks());
        setCourses(await coursesRepo.listCourses());
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);

    // If the course backing the active filter chip gets deleted, fall back
    // to "All" instead of silently showing an empty task list.
    useEffect(() => {
        if (courseFilter && !courses.some((c) => c.id === courseFilter)) {
            setCourseFilter(null);
        }
    }, [courses, courseFilter]);

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
            <QuickAdd courses={courses} onAdd={(input) => act(() => tasksRepo.createTask(input))} />
            <FilterChips
                options={courses.map((c) => ({
                    id: c.id,
                    label: c.code,
                    color: c.color ?? undefined,
                }))}
                active={courseFilter}
                onChange={setCourseFilter}
            />
            <TaskList
                tasks={courseFilter ? tasks.filter((t) => t.course_id === courseFilter) : tasks}
                courses={courses}
                act={act}
            />
        </div>
    );
}

function QuickAdd({
    courses,
    onAdd,
}: {
    courses: Course[];
    onAdd: (input: tasksRepo.TaskInput) => Promise<void>;
}) {
    const [title, setTitle] = useState("");
    const [due, setDue] = useState("");
    const [courseId, setCourseId] = useState("");
    const [recurrence, setRecurrence] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const submit = async () => {
        if (!title.trim() || submitting) return;
        setSubmitting(true);
        try {
            await onAdd({
                title: title.trim(),
                courseId: courseId || null,
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
            {courses.length > 0 && (
                <label className="flex w-32 flex-col gap-1 text-sm">
                    Course
                    <Select
                        value={courseId}
                        onChange={(e) => setCourseId(e.target.value)}
                    >
                        <option value="">—</option>
                        {courses.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.code}
                            </option>
                        ))}
                    </Select>
                </label>
            )}
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
    courses,
    act,
}: {
    tasks: Task[];
    courses: Course[];
    act: (fn: () => Promise<unknown>) => Promise<void>;
}) {
    const courseCode = (id: string | null) =>
        courses.find((c) => c.id === id)?.code;
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
                    {courseCode(t.course_id) && (
                        <Badge>{courseCode(t.course_id)}</Badge>
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
