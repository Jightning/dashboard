import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Upload, Trash2, Plus, X } from "lucide-react";
import * as coursesRepo from "@/db/repo/courses";
import * as categoriesRepo from "@/db/repo/categories";
import { deleteEvent, insertEvent } from "@/db/repo/events";
import { importClassSchedule } from "@/lib/ics";
import { collectCalendarItems, type CalendarItem } from "./calendarItems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterChips } from "@/components/ui/filterChips";
import { cn } from "@/lib/utils";
import type { Category, Course } from "@/lib/schemas";

const DAY = 86_400_000;
type ViewMode = "1d" | "7d" | "14d" | "month";

function startOfDay(t: number): number {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

/** [rangeStart, rangeEnd) for the mode, anchored at `anchor`. */
function rangeFor(mode: ViewMode, anchor: number): { from: number; to: number } {
    if (mode === "month") {
        const d = new Date(anchor);
        const first = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        const gridStart = startOfDay(first - new Date(first).getDay() * DAY);
        return { from: gridStart, to: gridStart + 42 * DAY };
    }
    const from = startOfDay(anchor);
    return {
        from,
        to: from + (mode === "1d" ? 1 : mode === "7d" ? 7 : 14) * DAY,
    };
}

export function CalendarTab() {
    const [mode, setMode] = useState<ViewMode>("7d");
    const [anchor, setAnchor] = useState(() => Date.now());
    const [items, setItems] = useState<CalendarItem[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { from, to } = useMemo(() => rangeFor(mode, anchor), [mode, anchor]);

    const reload = useCallback(async () => {
        setItems(await collectCalendarItems(from, to));
        setCourses(await coursesRepo.listCourses());
        setCategories(await categoriesRepo.listCategories());
    }, [from, to]);
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

    const visible = categoryFilter
        ? items.filter((i) => i.categoryId === categoryFilter)
        : items;

    const shift = (dir: 1 | -1) =>
        setAnchor((a) => {
            if (mode !== "month") {
                const step = (mode === "1d" ? 1 : mode === "7d" ? 7 : 14) * DAY;
                return a + dir * step;
            }
            const d = new Date(a);
            d.setDate(1);
            d.setMonth(d.getMonth() + dir);
            return d.getTime();
        });

    return (
        <div className="flex flex-col gap-4">
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-md border border-border">
                    {(["1d", "7d", "14d", "month"] as const).map((m) => (
                        <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={cn(
                                "cursor-pointer px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider",
                                mode === m
                                    ? "bg-primary/15 text-primary"
                                    : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {m === "month"
                                ? "1 month"
                                : m === "1d"
                                  ? "1 day"
                                  : `${m.slice(0, -1)} days`}
                        </button>
                    ))}
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Earlier"
                    onClick={() => shift(-1)}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Later"
                    onClick={() => shift(1)}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <button
                    className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    onClick={() => setAnchor(Date.now())}
                >
                    today
                </button>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {new Date(from).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                    })}{" "}
                    –{" "}
                    {new Date(to - 1).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                    })}
                </span>
            </div>
            <FilterChips
                options={categories.map((c) => ({
                    id: c.id,
                    label: c.name,
                    color: c.color ?? undefined,
                }))}
                active={categoryFilter}
                onChange={setCategoryFilter}
            />
            <QuickEvent
                onAdd={(input) =>
                    act(() => insertEvent({ ...input, source: "manual" }))
                }
            />
            {mode === "month" ? (
                <MonthGrid from={from} items={visible} anchor={anchor} />
            ) : (
                <DayList
                    from={from}
                    days={mode === "1d" ? 1 : mode === "7d" ? 7 : 14}
                    items={visible}
                    onDeleteManual={(item) =>
                        void act(() => deleteEvent(item.refId))
                    }
                />
            )}
            <CoursesPanel courses={courses} act={act} reload={reload} />
        </div>
    );
}

function QuickEvent({
    onAdd,
}: {
    onAdd: (input: {
        title: string;
        startsAt: number;
        endsAt: number;
        location: string | null;
    }) => Promise<void>;
}) {
    const [title, setTitle] = useState("");
    const [start, setStart] = useState("");
    const [minutes, setMinutes] = useState("60");
    const [location, setLocation] = useState("");
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!title.trim() || !start || saving) return;
        setSaving(true);
        try {
            const startsAt = new Date(start).getTime();
            await onAdd({
                title: title.trim(),
                startsAt,
                endsAt: startsAt + Math.max(5, Number(minutes) || 60) * 60_000,
                location: location.trim() || null,
            });
            setTitle("");
            setStart("");
            setLocation("");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm">
                New event
                <Input
                    value={title}
                    placeholder="e.g. Dentist"
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.repeat && !saving) void submit();
                    }}
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Starts
                <Input
                    type="datetime-local"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                />
            </label>
            <label className="flex w-24 flex-col gap-1 text-sm">
                Minutes
                <Input
                    type="number"
                    min={5}
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                />
            </label>
            <label className="flex w-36 flex-col gap-1 text-sm">
                Where (optional)
                <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                />
            </label>
            <Button onClick={() => void submit()} disabled={saving} aria-label="Add event">
                <Plus className="h-4 w-4" />
            </Button>
        </div>
    );
}

function ItemChip({
    item,
    showTime,
    onDelete,
}: {
    item: CalendarItem;
    showTime: boolean;
    onDelete?: () => void;
}) {
    return (
        <div
            className="flex min-w-0 items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs"
            style={{ background: `color-mix(in oklab, ${item.color} 12%, transparent)` }}
            title={item.detail ?? item.title}
        >
            <span
                aria-hidden
                className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    item.kind === "task" && "rounded-[2px]",
                )}
                style={{ background: item.color }}
            />
            {showTime && (
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {new Date(item.at).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                    })}
                </span>
            )}
            <span className="truncate">{item.title}</span>
            {onDelete && (
                <button
                    aria-label={`Delete ${item.title}`}
                    className="ml-auto shrink-0 cursor-pointer text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete()}
                >
                    <X className="h-3 w-3" />
                </button>
            )}
        </div>
    );
}

function DayList({
    from,
    days,
    items,
    onDeleteManual,
}: {
    from: number;
    days: number;
    items: CalendarItem[];
    onDeleteManual?: (item: CalendarItem) => void;
}) {
    const today = startOfDay(Date.now());
    return (
        <div className="flex flex-col gap-1">
            {Array.from({ length: days }, (_, i) => {
                const dayStart = from + i * DAY;
                const dayItems = items.filter(
                    (x) => x.at >= dayStart && x.at < dayStart + DAY,
                );
                return (
                    <div
                        key={dayStart}
                        className={cn(
                            "flex gap-3 rounded-md border border-border/60 px-3 py-1.5",
                            dayStart === today && "border-primary/40 bg-primary/5",
                        )}
                    >
                        <span className="w-20 shrink-0 pt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {new Date(dayStart).toLocaleDateString(undefined, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                            })}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            {dayItems.length === 0 ? (
                                <span className="text-xs text-muted-foreground/50">—</span>
                            ) : (
                                dayItems.map((x) => (
                                    <ItemChip
                                        key={x.id}
                                        item={x}
                                        showTime
                                        onDelete={
                                            x.manual
                                                ? () => onDeleteManual?.(x)
                                                : undefined
                                        }
                                    />
                                ))
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function MonthGrid({
    from,
    items,
    anchor,
}: {
    from: number;
    items: CalendarItem[];
    anchor: number;
}) {
    const today = startOfDay(Date.now());
    const month = new Date(anchor).getMonth();
    return (
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-border bg-border">
            {Array.from({ length: 42 }, (_, i) => {
                const dayStart = from + i * DAY;
                const d = new Date(dayStart);
                const dayItems = items.filter(
                    (x) => x.at >= dayStart && x.at < dayStart + DAY,
                );
                return (
                    <div
                        key={dayStart}
                        className={cn(
                            "flex min-h-20 flex-col gap-0.5 bg-background p-1",
                            d.getMonth() !== month && "opacity-45",
                            dayStart === today && "bg-primary/5",
                        )}
                    >
                        <span
                            className={cn(
                                "font-mono text-[10px] text-muted-foreground",
                                dayStart === today && "text-primary",
                            )}
                        >
                            {d.getDate()}
                        </span>
                        {dayItems.slice(0, 3).map((x) => (
                            <ItemChip key={x.id} item={x} showTime={false} />
                        ))}
                        {dayItems.length > 3 && (
                            <span className="font-mono text-[9px] text-muted-foreground">
                                +{dayItems.length - 3} more
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
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
                <CardTitle>Courses & schedules</CardTitle>
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
