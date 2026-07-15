import { useCallback, useEffect, useState } from "react";
import { Upload, Trash2 } from "lucide-react";
import * as coursesRepo from "@/db/repo/courses";
import { listEventsBetween } from "@/db/repo/events";
import { importClassSchedule } from "@/lib/ics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CalendarEvent, Course } from "@/lib/schemas";

const DAY = 86_400_000;

export function CalendarTab() {
    const [courses, setCourses] = useState<Course[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
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
        <div className="flex flex-col gap-6">
            {error && <p className="text-xs text-destructive">{error}</p>}
            <WeekEvents events={events} courses={courses} />
            <CoursesPanel courses={courses} act={act} reload={reload} />
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
                        No events this week. Import a schedule below.
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
