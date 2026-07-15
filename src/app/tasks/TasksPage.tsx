import { useCallback, useEffect, useState } from "react";
import { Check, Plus, Trash2, Upload } from "lucide-react";
import * as tasksRepo from "@/db/repo/tasks";
import * as coursesRepo from "@/db/repo/courses";
import { listEventsBetween } from "@/db/repo/events";
import { importClassSchedule } from "@/lib/ics";
import type { Recurrence } from "@/lib/recurrence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterChips } from "@/components/ui/filterChips";
import type { CalendarEvent, Course, Task } from "@/lib/schemas";

const DAY = 86_400_000;

export function TasksPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [courseFilter, setCourseFilter] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setTasks(await tasksRepo.listOpenTasks());
        setCourses(await coursesRepo.listCourses());
        setEvents(await listEventsBetween(Date.now(), Date.now() + 7 * DAY));
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);

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
        <div className="h-full overflow-y-auto p-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
                <header>
                    <h1 className="font-display text-2xl font-semibold tracking-wide">
                        Tasks
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Everything with a deadline — also readable by the
                        planner agent.
                    </p>
                </header>
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
                <WeekEvents events={events} courses={courses} />
                <CoursesPanel courses={courses} act={act} reload={reload} />
            </div>
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

function WeekEvents({
    events,
    courses,
}: {
    events: CalendarEvent[];
    courses: Course[];
}) {
    const color = (id: string | null) =>
        courses.find((c) => c.id === id)?.color ?? "var(--primary)";
    return (
        <Card>
            <CardHeader>
                <CardTitle>Next 7 days</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
                {events.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                        No events. Import a class schedule below.
                    </p>
                )}
                {events.map((e) => (
                    <div key={e.id} className="flex items-center gap-2 text-sm">
                        <span
                            aria-hidden
                            className="h-2 w-2 rounded-full"
                            style={{ background: color(e.course_id) }}
                        />
                        <span className="w-40 font-mono text-xs text-muted-foreground">
                            {new Date(e.starts_at).toLocaleString(undefined, {
                                weekday: "short",
                                hour: "numeric",
                                minute: "2-digit",
                            })}
                        </span>
                        <span className="flex-1">{e.title}</span>
                        {e.location && (
                            <span className="font-mono text-xs text-muted-foreground">
                                {e.location}
                            </span>
                        )}
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function CoursesPanel({
    courses,
    act,
    reload,
}: {
    courses: Course[];
    act: (fn: () => Promise<unknown>) => Promise<void>;
    reload: () => Promise<void>;
}) {
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [term, setTerm] = useState("Fall 2026");
    const [color, setColor] = useState("");
    const [importing, setImporting] = useState<string | null>(null);
    const [importResult, setImportResult] = useState<string | null>(null);

    const addCourse = () =>
        act(async () => {
            if (!code.trim() || !name.trim())
                throw new Error("course needs a code and a name");
            const folder = `/school/${code.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
            await coursesRepo.createCourse({
                code,
                name,
                term,
                folder,
                color: color.trim() || null,
            });
            setCode("");
            setName("");
            setColor("");
        });

    // ICS import works on both targets via a plain file input.
    const importIcs = async (course: Course, file: File) => {
        setImporting(course.id);
        setImportResult(null);
        try {
            const text = await file.text();
            const from = Date.now() - 7 * 86_400_000;
            const until = Date.now() + 200 * 86_400_000; // covers the term
            const count = await importClassSchedule({
                courseId: course.id,
                icsText: text,
                from,
                until,
            });
            setImportResult(`${course.code}: imported ${count} events`);
            await reload();
        } catch (e) {
            setImportResult(e instanceof Error ? e.message : String(e));
        } finally {
            setImporting(null);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Courses</CardTitle>
                <p className="text-xs text-muted-foreground">
                    Each course's folder (/school/…) is a permission scope for
                    notes, documents, and flashcards.
                </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {courses.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 text-sm">
                        <span className="w-24 font-mono text-xs">{c.code}</span>
                        <span className="flex-1">{c.name}</span>
                        <code className="font-mono text-[10px] text-muted-foreground">
                            {c.folder}
                        </code>
                        <label className="cursor-pointer">
                            <span className="sr-only">
                                Import ICS for {c.code}
                            </span>
                            <input
                                type="file"
                                accept=".ics,text/calendar"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) void importIcs(c, file);
                                    e.target.value = "";
                                }}
                            />
                            <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider hover:text-foreground">
                                <Upload className="h-3 w-3" />
                                {importing === c.id ? "importing…" : "import ics"}
                            </span>
                        </label>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${c.code}`}
                            onClick={() =>
                                void act(() => coursesRepo.deleteCourse(c.id))
                            }
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
                {importResult && (
                    <p className="font-mono text-xs text-muted-foreground">
                        {importResult}
                    </p>
                )}
                <div className="flex items-end gap-2">
                    <label className="flex w-28 flex-col gap-1 text-sm">
                        Code
                        <Input
                            value={code}
                            placeholder="ECE 437"
                            onChange={(e) => setCode(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Name
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </label>
                    <label className="flex w-32 flex-col gap-1 text-sm">
                        Term
                        <Input
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                        />
                    </label>
                    <label className="flex w-32 flex-col gap-1 text-sm">
                        Color (optional)
                        <Input
                            value={color}
                            placeholder="#3b82f6"
                            onChange={(e) => setColor(e.target.value)}
                        />
                    </label>
                    <Button onClick={() => void addCourse()}>Add</Button>
                </div>
            </CardContent>
        </Card>
    );
}
