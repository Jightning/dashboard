import { listEventsBetween } from "@/db/repo/events";
import { listOpenTasks } from "@/db/repo/tasks";
import { listAutomations } from "@/db/repo/automations";
import { listApplications } from "@/db/repo/applications";
import { listCourses } from "@/db/repo/courses";
import { listCategories } from "@/db/repo/categories";

export interface CalendarItem {
    id: string;
    kind: "event" | "task" | "automation" | "application";
    title: string;
    at: number;
    endAt: number | null;
    color: string;
    categoryId: string | null;
    detail: string | null;
    /** Underlying row id (task/event/automation/application). */
    refId: string;
    /** True for user-created events — the only calendar items deletable in place. */
    manual: boolean;
}

const KIND_FALLBACK: Record<CalendarItem["kind"], string> = {
    event: "var(--primary)",
    task: "var(--primary)",
    automation: "var(--agent-orchestrator)",
    application: "var(--muted-foreground)",
};

/**
 * Everything time-shaped in [from, to): course events, open tasks with a due
 * date, enabled automations' next runs, and application follow-ups. One
 * query pass, sorted ascending — the calendar grids just bucket by day.
 */
export async function collectCalendarItems(
    from: number,
    to: number,
): Promise<CalendarItem[]> {
    const [events, tasks, automations, applications, courses, categories] =
        await Promise.all([
            listEventsBetween(from, to),
            listOpenTasks(),
            listAutomations(),
            listApplications(),
            listCourses(),
            listCategories(),
        ]);
    const categoryColor = new Map(categories.map((c) => [c.id, c.color]));
    const courseById = new Map(courses.map((c) => [c.id, c]));
    const color = (categoryId: string | null, kind: CalendarItem["kind"]) =>
        (categoryId ? categoryColor.get(categoryId) : null) ?? KIND_FALLBACK[kind];

    const items: CalendarItem[] = [];
    for (const e of events) {
        const categoryId = e.course_id
            ? (courseById.get(e.course_id)?.category_id ?? null)
            : null;
        items.push({
            id: `event:${e.id}`,
            kind: "event",
            title: e.title,
            at: e.starts_at,
            endAt: e.ends_at,
            color: courseById.get(e.course_id ?? "")?.color ?? color(categoryId, "event"),
            categoryId,
            detail: e.location,
            refId: e.id,
            manual: e.source === "manual",
        });
    }
    for (const t of tasks) {
        if (t.due_at === null || t.due_at < from || t.due_at >= to) continue;
        items.push({
            id: `task:${t.id}`,
            kind: "task",
            title: t.title,
            at: t.due_at,
            endAt: null,
            color: color(t.category_id, "task"),
            categoryId: t.category_id,
            detail: t.recurrence ? `repeats ${t.recurrence}` : null,
            refId: t.id,
            manual: false,
        });
    }
    for (const a of automations) {
        if (!a.enabled || a.next_run_at === null) continue;
        if (a.next_run_at < from || a.next_run_at >= to) continue;
        items.push({
            id: `automation:${a.id}`,
            kind: "automation",
            title: a.name,
            at: a.next_run_at,
            endAt: null,
            color: color(null, "automation"),
            categoryId: null,
            detail: "scheduled run",
            refId: a.id,
            manual: false,
        });
    }
    for (const app of applications) {
        if (app.next_action_at === null) continue;
        if (app.next_action_at < from || app.next_action_at >= to) continue;
        items.push({
            id: `application:${app.id}`,
            kind: "application",
            title: `${app.company} — ${app.next_action ?? "follow up"}`,
            at: app.next_action_at,
            endAt: null,
            color: color(null, "application"),
            categoryId: null,
            detail: app.role,
            refId: app.id,
            manual: false,
        });
    }
    return items.sort((a, b) => a.at - b.at);
}
