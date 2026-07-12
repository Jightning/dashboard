# Semester & Internship Utilities — Implementation Plan (plan_2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the dashboard into the daily driver for a computer-engineering student's semester and internship season: tasks + class schedule, an internship application tracker, spaced-repetition study cards, a ⌘K command palette, and reliability guarantees (backups, usage visibility) — all at $0 recurring cost.

**Architecture:** Every feature lands the same way the AI OS was designed to grow: a migration + typed repo, agent tools registered in the plan.md tool catalog behind the permission engine, and a page that follows the HUD design system. The planner agent (roadmap Phase 4) finally ships because its tools now exist. Scheduling, spaced repetition, and ICS expansion are pure TypeScript functions with unit tests; no server, no subscriptions.

**Tech Stack:** Existing stack + three free additions: `ical.js` (class-schedule import), `cmdk` (command palette), `@tauri-apps/plugin-opener` (open bookmarks externally on desktop). Everything else is SQLite, zod, AI SDK, Tailwind — already installed.

## Global Constraints

- **$0 recurring cost.** No paid APIs, no hosting, no subscriptions. AI features default to the settings' models (Gemini free tier or Ollama); nothing in this plan requires a paid key. New deps must be free-license npm packages: `ical.js@^2` (MPL-2.0), `cmdk@^1` (MIT), `@tauri-apps/plugin-opener@^2` (MIT/Apache-2.0). No other new dependencies.
- **Depends on plan.md Milestone A** (agents table, `TOOL_CATALOG`/`buildToolSet`, `seedBuiltinAgents`, `write_note`). Tasks 8 and 12 also reference pipelines/automations (plan.md C–D) in *manual usage examples only* — no code dependency. Migrations here start at **0006** (plan.md ends at 0005).
- Every new agent tool goes through `PermissionContext.gated(...)` and gets a `TOOL_CATALOG` entry + scope resolver in `src/ai/tools/index.ts`'s spread. Write access is never part of builtin permission levels.
- New migrations: file in `src-tauri/migrations/` **and** a `Migration` entry in `src-tauri/src/lib.rs`; web worker and testClient pick the file up automatically.
- Both targets work (Tauri + web). Tauri-only affordances (file dialog, backups via `VACUUM INTO`, opener) degrade gracefully on web (`isTauri()` guards), never crash it.
- Design system rules (docs/design.md): tokens only; data in `font-mono`; page skeleton `h-full overflow-y-auto p-6` → centered column → `font-display` h1; lucide icons; new pages register in the `Page` union (`Sidebar.tsx`) + `PAGES` map (`Shell.tsx`).
- Fail fast; TDD; `npx vitest run <file>` per task, `npm test && npm run typecheck` before every commit.

## What this builds (spec)

**Milestone 1 — Semester backbone (Tasks 1–6).** Courses (each mapping to a permission-scope folder like `/school/ece437`), tasks with due dates + simple recurrence (daily/weekly/monthly — deliberately not rrule), calendar events imported from the university's ICS class schedule (re-importable each semester), agent tools (`list_tasks`, `create_task`, `complete_task`, `list_events`), a Tasks page with quick-add and agenda view, and a Home page rebuilt into a **Today** view: today's classes, due/overdue work, application follow-ups.

**Milestone 2 — Internship application tracker (Tasks 7–9).** An `applications` table with a status pipeline (interested → applied → OA → interview → offer / rejected / ghosted), automatic status history, next-action follow-ups that surface on Today, a kanban-style board UI, agent tools (`list_applications`, `create_application`, `update_application_status`), and the **Planner agent** seeded as a third builtin ("plan my week" now has real tools). Pairs with plan.md pipelines: a scout pipeline can fetch postings and file candidates.

**Milestone 3 — Study loop (Tasks 10–12).** Flashcards with SM-2 spaced repetition (pure function, unit-tested), a `create_flashcards` agent tool (write-gated by course folder) so any chat/pipeline can turn lecture notes into cards, and a Review page with keyboard-first grading. Daily reviews appear on Today.

**Milestone 4 — Speed layer (Tasks 13–14).** Bookmarks + snippets (Library page, one-click copy/open) and a global **⌘K palette** (cmdk) fuzzy-searching notes, documents, tasks, applications, bookmarks, snippets, and app actions.

**Milestone 5 — Reliability & $0 ops (Task 15).** Daily automatic SQLite backups (`VACUUM INTO` app-data/backups, 14 kept), backup-now + export controls in Settings, and a token-usage rollup so free-tier limits are visible before they bite.

Deliberately out of scope: rrule/complex recurrence, Google Calendar sync (needs OAuth app review — revisit), grade tracking, email integration, pomodoro (a timer is not this app's edge), mobile port (roadmap P5 unchanged).

## File structure

```txt
Create:
  src-tauri/migrations/0006_semester.sql       courses, tasks, events
  src-tauri/migrations/0007_applications.sql   applications + status history
  src-tauri/migrations/0008_flashcards.sql     flashcards
  src-tauri/migrations/0009_library.sql        bookmarks, snippets
  src/db/repo/courses.ts                       course CRUD
  src/db/repo/tasks.ts                         task CRUD + recurrence rollover
  src/db/repo/events.ts                        event CRUD + range queries
  src/db/repo/semester.test.ts                 covers the three repos above
  src/db/repo/applications.ts                  application CRUD + status log
  src/db/repo/applications.test.ts
  src/db/repo/flashcards.ts                    card CRUD + due queue
  src/db/repo/flashcards.test.ts
  src/db/repo/library.ts                       bookmarks + snippets CRUD
  src/db/repo/library.test.ts
  src/db/repo/usage.ts                         token usage rollup query
  src/lib/recurrence.ts                        nextDueDate() (pure)
  src/lib/recurrence.test.ts
  src/lib/ics.ts                               parseIcsEvents() (pure, ical.js)
  src/lib/ics.test.ts
  src/lib/sm2.ts                               reviewCard() (pure)
  src/lib/sm2.test.ts
  src/lib/backup.ts                            runDailyBackup(), exportNotesMarkdown()
  src/ai/tools/tasks.ts                        list/create/complete_task, list_events
  src/ai/tools/tasks.test.ts
  src/ai/tools/applications.ts                 list/create/update_application_status
  src/ai/tools/applications.test.ts
  src/ai/tools/flashcards.ts                   create_flashcards
  src/ai/tools/flashcards.test.ts
  src/app/tasks/TasksPage.tsx                  agenda + quick-add + courses + ICS import
  src/app/applications/ApplicationsPage.tsx    status board
  src/app/review/ReviewPage.tsx                flashcard review queue
  src/app/library/LibraryPage.tsx              bookmarks + snippets
  src/components/palette/CommandPalette.tsx    global ⌘K (cmdk)

Modify:
  src-tauri/src/lib.rs                         migrations 6–9 + opener plugin
  src-tauri/capabilities/*.json                opener permission (+ fs appdata if absent)
  package.json                                 ical.js, cmdk, @tauri-apps/plugin-opener
  src/lib/schemas.ts                           course/task/event/application/flashcard/
                                               bookmark/snippet schemas
  src/ai/tools/catalog.ts                      8 new TOOL_CATALOG entries + factories
  src/ai/tools/index.ts                        new scope resolvers spread
  src/db/repo/agents.ts                        seed builtin Planner agent
  src/app/Sidebar.tsx                          real nav entries replace SOON stubs
  src/app/Shell.tsx                            PAGES map + palette mount
  src/app/home/HomePage.tsx                    Today view
  src/app/settings/SettingsPage.tsx            backups card + usage card
  src/app/bootstrap.ts                         runDailyBackup() fire-and-forget
```

---

## Milestone 1 — Semester backbone

### Task 1: semester migration + schemas + recurrence math

**Files:**
- Create: `src-tauri/migrations/0006_semester.sql`, `src/lib/recurrence.ts`
- Modify: `src-tauri/src/lib.rs`, `src/lib/schemas.ts`
- Test: `src/lib/recurrence.test.ts`

**Interfaces:**
- Produces (schemas): `courseSchema/Course` (`id, code, name, term, folder, color, created_at`), `taskSchema/Task` (`id, title, notes, course_id, due_at, recurrence: "daily"|"weekly"|"monthly"|null, completed_at, created_at, updated_at`), `eventSchema/CalendarEvent` (`id, course_id, title, location, starts_at, ends_at, source, created_at`).
- Produces (pure): `nextDueDate(dueAt: number, recurrence: Recurrence): number`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/recurrence.test.ts
import { describe, expect, it } from "vitest";
import { nextDueDate } from "./recurrence";

describe("nextDueDate", () => {
    it("daily adds one day", () => {
        const due = new Date(2026, 7, 24, 23, 59).getTime();
        expect(new Date(nextDueDate(due, "daily")).getDate()).toBe(25);
    });

    it("weekly adds seven days preserving time", () => {
        const due = new Date(2026, 7, 24, 9, 0).getTime();
        const next = new Date(nextDueDate(due, "weekly"));
        expect([next.getDate(), next.getHours()]).toEqual([31, 9]);
    });

    it("monthly advances the month", () => {
        const due = new Date(2026, 7, 15).getTime(); // Aug 15
        expect(new Date(nextDueDate(due, "monthly")).getMonth()).toBe(8); // Sep
    });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/lib/recurrence.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/lib/recurrence.ts`**

```ts
export type Recurrence = "daily" | "weekly" | "monthly";

/** Next occurrence after completing a recurring task. Local-time arithmetic. */
export function nextDueDate(dueAt: number, recurrence: Recurrence): number {
    const d = new Date(dueAt);
    switch (recurrence) {
        case "daily":
            d.setDate(d.getDate() + 1);
            break;
        case "weekly":
            d.setDate(d.getDate() + 7);
            break;
        case "monthly":
            d.setMonth(d.getMonth() + 1);
            break;
    }
    return d.getTime();
}
```

- [ ] **Step 4: Write the migration `src-tauri/migrations/0006_semester.sql`**

```sql
-- Semester backbone: courses (whose folder doubles as a permission scope),
-- tasks with simple recurrence, and calendar events (ICS class schedule).

CREATE TABLE courses (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    term TEXT NOT NULL,
    folder TEXT NOT NULL,
    color TEXT,
    created_at INTEGER NOT NULL
);

CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    notes TEXT,
    course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
    due_at INTEGER,
    recurrence TEXT CHECK (recurrence IN ('daily', 'weekly', 'monthly')),
    completed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX idx_tasks_open ON tasks(completed_at, due_at);

CREATE TABLE events (
    id TEXT PRIMARY KEY,
    course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    location TEXT,
    starts_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT 'ics',
    created_at INTEGER NOT NULL
);
CREATE INDEX idx_events_start ON events(starts_at);
```

Register in `src-tauri/src/lib.rs` as `version: 6, description: "courses, tasks, events"`.

- [ ] **Step 5: Add schemas to `src/lib/schemas.ts`**

```ts
export const courseSchema = z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    term: z.string(),
    folder: z.string(),
    color: z.string().nullable(),
    created_at: z.number(),
});
export type Course = z.infer<typeof courseSchema>;

export const recurrenceSchema = z.enum(["daily", "weekly", "monthly"]);

export const taskSchema = z.object({
    id: z.string(),
    title: z.string(),
    notes: z.string().nullable(),
    course_id: z.string().nullable(),
    due_at: z.number().nullable(),
    recurrence: recurrenceSchema.nullable(),
    completed_at: z.number().nullable(),
    created_at: z.number(),
    updated_at: z.number(),
});
export type Task = z.infer<typeof taskSchema>;

export const eventSchema = z.object({
    id: z.string(),
    course_id: z.string().nullable(),
    title: z.string(),
    location: z.string().nullable(),
    starts_at: z.number(),
    ends_at: z.number(),
    source: z.string(),
    created_at: z.number(),
});
export type CalendarEvent = z.infer<typeof eventSchema>;
```

- [ ] **Step 6: Run tests, typecheck, commit**

Run: `npx vitest run src/lib/recurrence.test.ts && npm run typecheck` — Expected: PASS/clean.

```bash
git add src-tauri/migrations/0006_semester.sql src-tauri/src/lib.rs src/lib/schemas.ts src/lib/recurrence.ts src/lib/recurrence.test.ts
git commit -m "feat: semester schema (courses, tasks, events) + recurrence math"
```

### Task 2: courses / tasks / events repositories

**Files:**
- Create: `src/db/repo/courses.ts`, `src/db/repo/tasks.ts`, `src/db/repo/events.ts`
- Test: `src/db/repo/semester.test.ts`

**Interfaces:**
- Produces (`courses.ts`): `createCourse({code, name, term, folder, color?})`, `listCourses()`, `deleteCourse(id)`.
- Produces (`tasks.ts`): `createTask({title, notes?, courseId?, dueAt?, recurrence?})`, `updateTask(id, sameFields)`, `completeTask(id)` → **returns the follow-up `Task` or `null`** (recurring tasks roll over via `nextDueDate`), `reopenTask(id)`, `deleteTask(id)`, `listOpenTasks(opts?: {dueBefore?: number})` (open, soonest due first, undated last), `listCompletedTasks(limit?)`, `getTask(id)`.
- Produces (`events.ts`): `insertEvent({courseId?, title, location?, startsAt, endsAt, source?})`, `listEventsBetween(from, to)`, `deleteEventsBySource(courseId, source)`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/db/repo/semester.test.ts
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { createCourse, deleteCourse, listCourses } from "./courses";
import {
    completeTask,
    createTask,
    getTask,
    listOpenTasks,
} from "./tasks";
import {
    deleteEventsBySource,
    insertEvent,
    listEventsBetween,
} from "./events";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

describe("courses repo", () => {
    it("creates and lists courses", async () => {
        await createCourse({
            code: "ECE 437",
            name: "Computer Design",
            term: "Fall 2026",
            folder: "/school/ece437",
        });
        const all = await listCourses();
        expect(all).toHaveLength(1);
        expect(all[0]!.folder).toBe("/school/ece437");
        await deleteCourse(all[0]!.id);
        expect(await listCourses()).toHaveLength(0);
    });
});

describe("tasks repo", () => {
    it("orders open tasks by due date with undated last", async () => {
        await createTask({ title: "no due" });
        await createTask({ title: "later", dueAt: Date.now() + 2_000_000 });
        await createTask({ title: "sooner", dueAt: Date.now() + 1_000_000 });
        const open = await listOpenTasks();
        expect(open.map((t) => t.title)).toEqual(["sooner", "later", "no due"]);
    });

    it("completing a one-shot task closes it with no follow-up", async () => {
        const t = await createTask({ title: "once", dueAt: Date.now() });
        const next = await completeTask(t.id);
        expect(next).toBeNull();
        expect((await getTask(t.id)).completed_at).not.toBeNull();
        expect(await listOpenTasks()).toHaveLength(0);
    });

    it("completing a recurring task rolls a new one forward", async () => {
        const due = new Date(2026, 7, 24, 9, 0).getTime();
        const t = await createTask({
            title: "gym",
            dueAt: due,
            recurrence: "weekly",
        });
        const next = await completeTask(t.id);
        expect(next).not.toBeNull();
        expect(next!.due_at).toBe(due + 7 * 86_400_000);
        expect(next!.recurrence).toBe("weekly");
        expect(await listOpenTasks()).toHaveLength(1);
    });
});

describe("events repo", () => {
    it("range-queries and clears by source", async () => {
        const course = await createCourse({
            code: "ECE 437",
            name: "x",
            term: "Fall 2026",
            folder: "/school/ece437",
        });
        await insertEvent({
            courseId: course.id,
            title: "Lecture",
            startsAt: 1_000,
            endsAt: 2_000,
        });
        expect(await listEventsBetween(0, 5_000)).toHaveLength(1);
        expect(await listEventsBetween(3_000, 5_000)).toHaveLength(0);
        await deleteEventsBySource(course.id, "ics");
        expect(await listEventsBetween(0, 5_000)).toHaveLength(0);
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/db/repo/semester.test.ts` — Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the three repos**

```ts
// src/db/repo/courses.ts
import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { courseSchema, type Course } from "@/lib/schemas";
import { normalizeFolder } from "./documents";

export async function createCourse(input: {
    code: string;
    name: string;
    term: string;
    folder: string;
    color?: string | null;
}): Promise<Course> {
    const id = newId("crs");
    await getDb().execute(
        `INSERT INTO courses (id, code, name, term, folder, color, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            input.code,
            input.name,
            input.term,
            normalizeFolder(input.folder),
            input.color ?? null,
            now(),
        ],
    );
    const rows = await getDb().select("SELECT * FROM courses WHERE id = ?", [id]);
    return courseSchema.parse(rows[0]);
}

export async function listCourses(): Promise<Course[]> {
    const rows = await getDb().select(
        "SELECT * FROM courses ORDER BY term DESC, code ASC",
    );
    return rows.map((r) => courseSchema.parse(r));
}

export async function deleteCourse(id: string): Promise<void> {
    await getDb().execute("DELETE FROM courses WHERE id = ?", [id]);
}
```

```ts
// src/db/repo/tasks.ts
import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { taskSchema, type Task } from "@/lib/schemas";
import { nextDueDate, type Recurrence } from "@/lib/recurrence";

export interface TaskInput {
    title: string;
    notes?: string | null;
    courseId?: string | null;
    dueAt?: number | null;
    recurrence?: Recurrence | null;
}

export async function createTask(input: TaskInput): Promise<Task> {
    if (input.recurrence && input.dueAt == null)
        throw new Error("a recurring task needs a due date to recur from");
    const id = newId("tsk");
    const t = now();
    await getDb().execute(
        `INSERT INTO tasks (id, title, notes, course_id, due_at, recurrence,
                            completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        [
            id,
            input.title,
            input.notes ?? null,
            input.courseId ?? null,
            input.dueAt ?? null,
            input.recurrence ?? null,
            t,
            t,
        ],
    );
    return getTask(id);
}

export async function updateTask(id: string, input: TaskInput): Promise<Task> {
    const res = await getDb().execute(
        `UPDATE tasks SET title = ?, notes = ?, course_id = ?, due_at = ?,
                          recurrence = ?, updated_at = ?
         WHERE id = ?`,
        [
            input.title,
            input.notes ?? null,
            input.courseId ?? null,
            input.dueAt ?? null,
            input.recurrence ?? null,
            now(),
            id,
        ],
    );
    if (res.rowsAffected === 0) throw new Error(`task not found: ${id}`);
    return getTask(id);
}

/** Close a task; recurring tasks spawn the next occurrence, returned here. */
export async function completeTask(id: string): Promise<Task | null> {
    const task = await getTask(id);
    await getDb().execute(
        "UPDATE tasks SET completed_at = ?, updated_at = ? WHERE id = ?",
        [now(), now(), id],
    );
    if (!task.recurrence || task.due_at == null) return null;
    return createTask({
        title: task.title,
        notes: task.notes,
        courseId: task.course_id,
        dueAt: nextDueDate(task.due_at, task.recurrence),
        recurrence: task.recurrence,
    });
}

export async function reopenTask(id: string): Promise<void> {
    await getDb().execute(
        "UPDATE tasks SET completed_at = NULL, updated_at = ? WHERE id = ?",
        [now(), id],
    );
}

export async function deleteTask(id: string): Promise<void> {
    await getDb().execute("DELETE FROM tasks WHERE id = ?", [id]);
}

export async function getTask(id: string): Promise<Task> {
    const rows = await getDb().select("SELECT * FROM tasks WHERE id = ?", [id]);
    if (!rows[0]) throw new Error(`task not found: ${id}`);
    return taskSchema.parse(rows[0]);
}

export async function listOpenTasks(
    opts: { dueBefore?: number } = {},
): Promise<Task[]> {
    const rows = opts.dueBefore
        ? await getDb().select(
              `SELECT * FROM tasks
               WHERE completed_at IS NULL AND due_at IS NOT NULL AND due_at <= ?
               ORDER BY due_at ASC`,
              [opts.dueBefore],
          )
        : await getDb().select(
              `SELECT * FROM tasks WHERE completed_at IS NULL
               ORDER BY due_at IS NULL, due_at ASC, created_at ASC`,
          );
    return rows.map((r) => taskSchema.parse(r));
}

export async function listCompletedTasks(limit = 30): Promise<Task[]> {
    const rows = await getDb().select(
        `SELECT * FROM tasks WHERE completed_at IS NOT NULL
         ORDER BY completed_at DESC LIMIT ?`,
        [limit],
    );
    return rows.map((r) => taskSchema.parse(r));
}
```

```ts
// src/db/repo/events.ts
import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { eventSchema, type CalendarEvent } from "@/lib/schemas";

export async function insertEvent(input: {
    courseId?: string | null;
    title: string;
    location?: string | null;
    startsAt: number;
    endsAt: number;
    source?: string;
}): Promise<CalendarEvent> {
    const id = newId("evt");
    await getDb().execute(
        `INSERT INTO events (id, course_id, title, location, starts_at, ends_at, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            input.courseId ?? null,
            input.title,
            input.location ?? null,
            input.startsAt,
            input.endsAt,
            input.source ?? "ics",
            now(),
        ],
    );
    const rows = await getDb().select("SELECT * FROM events WHERE id = ?", [id]);
    return eventSchema.parse(rows[0]);
}

export async function listEventsBetween(
    from: number,
    to: number,
): Promise<CalendarEvent[]> {
    const rows = await getDb().select(
        `SELECT * FROM events WHERE starts_at >= ? AND starts_at < ?
         ORDER BY starts_at ASC`,
        [from, to],
    );
    return rows.map((r) => eventSchema.parse(r));
}

/** Clear a course's imported events before re-importing a semester's ICS. */
export async function deleteEventsBySource(
    courseId: string,
    source: string,
): Promise<void> {
    await getDb().execute(
        "DELETE FROM events WHERE course_id = ? AND source = ?",
        [courseId, source],
    );
}
```

- [ ] **Step 4: Run tests, typecheck, commit**

Run: `npx vitest run src/db/repo/semester.test.ts && npm run typecheck` — Expected: PASS/clean.

```bash
git add src/db/repo/courses.ts src/db/repo/tasks.ts src/db/repo/events.ts src/db/repo/semester.test.ts
git commit -m "feat: courses, tasks (with recurrence rollover), events repos"
```
### Task 3: ICS class-schedule import

**Files:**
- Create: `src/lib/ics.ts`
- Modify: `package.json` (add `ical.js`)
- Test: `src/lib/ics.test.ts`

**Interfaces:**
- Consumes: `ical.js` (`ICAL.parse`, `ICAL.Component`, `ICAL.Event`).
- Produces: `ParsedEvent { title: string; location: string | null; startsAt: number; endsAt: number }`; `parseIcsEvents(icsText: string, range: { from: number; until: number }): ParsedEvent[]` (expands weekly RRULEs into concrete occurrences within the range); `importClassSchedule({ courseId, icsText, from, until }): Promise<number>` (clears the course's previous `ics` events, inserts, returns count).

- [ ] **Step 1: Install the dependency**

Run: `npm install ical.js`
Expected: adds `ical.js@^2` (MPL-2.0, $0, ships its own TypeScript types).

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/ics.test.ts
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { createCourse } from "@/db/repo/courses";
import { listEventsBetween } from "@/db/repo/events";
import { importClassSchedule, parseIcsEvents } from "./ics";

// A weekly MWF lecture, 4 occurrences, as university registrars export them.
const ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:ece437-lec@example.edu
SUMMARY:ECE 437 Lecture
LOCATION:EE 129
DTSTART:20260824T093000
DTEND:20260824T102000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=4
END:VEVENT
BEGIN:VEVENT
UID:onetime@example.edu
SUMMARY:Career Fair
DTSTART:20260901T100000
DTEND:20260901T160000
END:VEVENT
END:VCALENDAR`;

const FROM = new Date(2026, 7, 1).getTime();
const UNTIL = new Date(2026, 11, 20).getTime();

describe("parseIcsEvents", () => {
    it("expands recurring events into concrete occurrences", () => {
        const events = parseIcsEvents(ICS, { from: FROM, until: UNTIL });
        const lectures = events.filter((e) => e.title === "ECE 437 Lecture");
        expect(lectures).toHaveLength(4);
        expect(lectures[0]!.location).toBe("EE 129");
        // 50-minute lecture.
        expect(lectures[0]!.endsAt - lectures[0]!.startsAt).toBe(50 * 60_000);
    });

    it("includes one-off events and respects the range", () => {
        const events = parseIcsEvents(ICS, { from: FROM, until: UNTIL });
        expect(events.some((e) => e.title === "Career Fair")).toBe(true);
        const outOfRange = parseIcsEvents(ICS, {
            from: new Date(2027, 0, 1).getTime(),
            until: new Date(2027, 5, 1).getTime(),
        });
        expect(outOfRange).toHaveLength(0);
    });

    it("throws on garbage input", () => {
        expect(() =>
            parseIcsEvents("not an ics file", { from: 0, until: 1 }),
        ).toThrow();
    });
});

describe("importClassSchedule", () => {
    let db: ReturnType<typeof createTestDbClient>;
    beforeEach(() => {
        db = createTestDbClient();
        setDb(db);
    });
    afterEach(() => db.close());

    it("replaces prior imported events for the course", async () => {
        const course = await createCourse({
            code: "ECE 437",
            name: "Computer Design",
            term: "Fall 2026",
            folder: "/school/ece437",
        });
        const first = await importClassSchedule({
            courseId: course.id,
            icsText: ICS,
            from: FROM,
            until: UNTIL,
        });
        expect(first).toBe(5); // 4 lectures + career fair
        // Re-import must not duplicate.
        await importClassSchedule({
            courseId: course.id,
            icsText: ICS,
            from: FROM,
            until: UNTIL,
        });
        expect(await listEventsBetween(FROM, UNTIL)).toHaveLength(5);
    });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/lib/ics.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 4: Implement `src/lib/ics.ts`**

```ts
import ICAL from "ical.js";
import { deleteEventsBySource, insertEvent } from "@/db/repo/events";

export interface ParsedEvent {
    title: string;
    location: string | null;
    startsAt: number;
    endsAt: number;
}

/**
 * Flattens an ICS calendar into concrete occurrences inside [from, until].
 * Recurring VEVENTs (the registrar's MWF lectures) are expanded via ical.js's
 * iterator; the until-bound also caps unbounded RRULEs safely.
 */
export function parseIcsEvents(
    icsText: string,
    range: { from: number; until: number },
): ParsedEvent[] {
    const component = new ICAL.Component(ICAL.parse(icsText));
    const out: ParsedEvent[] = [];

    for (const vevent of component.getAllSubcomponents("vevent")) {
        const event = new ICAL.Event(vevent);
        const durationMs = event.duration.toSeconds() * 1000;

        if (event.isRecurring()) {
            const iterator = event.iterator();
            let next: ICAL.Time | null;
            while ((next = iterator.next())) {
                const startsAt = next.toJSDate().getTime();
                if (startsAt > range.until) break;
                if (startsAt < range.from) continue;
                out.push({
                    title: event.summary,
                    location: event.location || null,
                    startsAt,
                    endsAt: startsAt + durationMs,
                });
            }
        } else {
            const startsAt = event.startDate.toJSDate().getTime();
            if (startsAt >= range.from && startsAt <= range.until) {
                out.push({
                    title: event.summary,
                    location: event.location || null,
                    startsAt,
                    endsAt: startsAt + durationMs,
                });
            }
        }
    }
    return out.sort((a, b) => a.startsAt - b.startsAt);
}

/** Re-importable each semester: clears the course's prior ICS rows first. */
export async function importClassSchedule(opts: {
    courseId: string;
    icsText: string;
    from: number;
    until: number;
}): Promise<number> {
    const events = parseIcsEvents(opts.icsText, {
        from: opts.from,
        until: opts.until,
    });
    await deleteEventsBySource(opts.courseId, "ics");
    for (const e of events) {
        await insertEvent({
            courseId: opts.courseId,
            title: e.title,
            location: e.location,
            startsAt: e.startsAt,
            endsAt: e.endsAt,
            source: "ics",
        });
    }
    return events.length;
}
```

- [ ] **Step 5: Run tests, typecheck, commit**

Run: `npx vitest run src/lib/ics.test.ts && npm run typecheck` — Expected: PASS/clean. (If `ical.js` default-import typing complains under `verbatimModuleSyntax`, switch to `import * as ICAL from "ical.js";` — same API.)

```bash
git add package.json package-lock.json src/lib/ics.ts src/lib/ics.test.ts
git commit -m "feat: ICS class-schedule parsing + re-importable semester import"
```

### Task 4: task & event agent tools

**Files:**
- Create: `src/ai/tools/tasks.ts`
- Modify: `src/ai/tools/catalog.ts`, `src/ai/tools/index.ts`
- Test: `src/ai/tools/tasks.test.ts`

**Interfaces:**
- Consumes: tasks/events repos (Task 2), `PermissionContext.gated`, plan.md's `TOOL_CATALOG`/`buildToolSet`.
- Produces: `createTaskTools(permissions)` with `list_tasks` (read/any), `create_task` (write/any), `complete_task` (write/any), `list_events` (read/any); `taskScopeResolvers`. Catalog gains a `"tasks"` group.

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/tools/tasks.test.ts
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { createTask, listOpenTasks } from "@/db/repo/tasks";
import { insertEvent } from "@/db/repo/events";
import { PermissionContext } from "./context";
import { createTaskTools } from "./tasks";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

const opts = { toolCallId: "t", messages: [] };

function allowAll(): PermissionContext {
    const p = new PermissionContext();
    p.levelGrants = [
        { tool: "list_tasks", access: "read", scopeType: "any", scopeValue: null },
        { tool: "create_task", access: "write", scopeType: "any", scopeValue: null },
        { tool: "complete_task", access: "write", scopeType: "any", scopeValue: null },
        { tool: "list_events", access: "read", scopeType: "any", scopeValue: null },
    ];
    return p;
}

describe("task tools", () => {
    it("creates a task with a parsed due date", async () => {
        const tools = createTaskTools(allowAll());
        const result = (await tools.create_task.execute!(
            { title: "437 lab report", due: "2026-09-04T23:59" },
            opts,
        )) as { id: string; due_at: number };
        expect(result.id).toMatch(/^tsk_/);
        expect(new Date(result.due_at).getFullYear()).toBe(2026);
        expect(await listOpenTasks()).toHaveLength(1);
    });

    it("rejects unparseable due dates", async () => {
        const tools = createTaskTools(allowAll());
        await expect(
            tools.create_task.execute!(
                { title: "x", due: "next Tuesdayish" },
                opts,
            ),
        ).rejects.toThrow(/due date/);
    });

    it("lists open tasks and completes one", async () => {
        const t = await createTask({ title: "OA prep", dueAt: Date.now() });
        const tools = createTaskTools(allowAll());
        const listed = (await tools.list_tasks.execute!({}, opts)) as Array<{
            id: string;
        }>;
        expect(listed).toHaveLength(1);
        await tools.complete_task.execute!({ id: t.id }, opts);
        expect(await listOpenTasks()).toHaveLength(0);
    });

    it("write tools deny without a grant", async () => {
        const p = new PermissionContext();
        p.broker.subscribe((pending) => {
            for (const req of pending) p.broker.respond(req.id, "deny");
        });
        const tools = createTaskTools(p);
        const result = (await tools.create_task.execute!(
            { title: "nope" },
            opts,
        )) as { denied?: boolean };
        expect(result.denied).toBe(true);
    });

    it("lists events in a day window", async () => {
        await insertEvent({
            title: "Lecture",
            startsAt: Date.now() + 3_600_000,
            endsAt: Date.now() + 7_200_000,
        });
        const tools = createTaskTools(allowAll());
        const events = (await tools.list_events.execute!(
            { withinDays: 1 },
            opts,
        )) as Array<{ title: string }>;
        expect(events[0]!.title).toBe("Lecture");
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ai/tools/tasks.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/ai/tools/tasks.ts`**

```ts
import { tool } from "ai";
import { z } from "zod";
import {
    completeTask,
    createTask,
    listOpenTasks,
} from "@/db/repo/tasks";
import { listEventsBetween } from "@/db/repo/events";
import type { ResolvedScope } from "@/ai/permissions/types";
import type { PermissionContext, ScopeResolver } from "./context";
import { recurrenceSchema } from "@/lib/schemas";

const listTasksInput = z.object({
    dueWithinDays: z
        .number()
        .optional()
        .describe("Only tasks due within N days. Omit for all open tasks."),
});

const createTaskInput = z.object({
    title: z.string().describe("Short imperative title"),
    notes: z.string().optional(),
    due: z
        .string()
        .optional()
        .describe("Due date/time, ISO format like 2026-09-04T23:59"),
    recurrence: recurrenceSchema
        .optional()
        .describe("Repeat after completion; requires a due date"),
});

const completeTaskInput = z.object({
    id: z.string().describe("Task id from list_tasks"),
});

const listEventsInput = z.object({
    withinDays: z
        .number()
        .optional()
        .describe("Events starting within N days from now (default 7)"),
});

const anyScope = (access: "read" | "write"): ResolvedScope => ({
    access,
    scopeType: "any",
    scopeValue: null,
});

export const taskScopeResolvers: Record<string, ScopeResolver> = {
    list_tasks: () => anyScope("read"),
    create_task: () => anyScope("write"),
    complete_task: () => anyScope("write"),
    list_events: () => anyScope("read"),
};

function parseDue(due: string | undefined): number | null {
    if (due === undefined) return null;
    const t = new Date(due).getTime();
    if (Number.isNaN(t))
        throw new Error(`unparseable due date: "${due}" — use ISO like 2026-09-04T23:59`);
    return t;
}

export function createTaskTools(permissions: PermissionContext) {
    return {
        list_tasks: tool({
            description:
                "List the user's open tasks (title, due date, course, id), soonest due first.",
            inputSchema: listTasksInput,
            execute: permissions.gated(
                "list_tasks",
                taskScopeResolvers.list_tasks!,
                async (input: z.infer<typeof listTasksInput>) =>
                    listOpenTasks(
                        input.dueWithinDays !== undefined
                            ? {
                                  dueBefore:
                                      Date.now() +
                                      input.dueWithinDays * 86_400_000,
                              }
                            : {},
                    ),
            ),
        }),
        create_task: tool({
            description:
                "Create a task for the user (assignment, follow-up, errand). Include a due date whenever one is known.",
            inputSchema: createTaskInput,
            execute: permissions.gated(
                "create_task",
                taskScopeResolvers.create_task!,
                async (input: z.infer<typeof createTaskInput>) =>
                    createTask({
                        title: input.title,
                        notes: input.notes ?? null,
                        dueAt: parseDue(input.due),
                        recurrence: input.recurrence ?? null,
                    }),
            ),
        }),
        complete_task: tool({
            description: "Mark a task complete by id.",
            inputSchema: completeTaskInput,
            execute: permissions.gated(
                "complete_task",
                taskScopeResolvers.complete_task!,
                async (input: z.infer<typeof completeTaskInput>) => {
                    const next = await completeTask(input.id);
                    return {
                        completed: input.id,
                        nextOccurrence: next?.id ?? null,
                    };
                },
            ),
        }),
        list_events: tool({
            description:
                "List upcoming calendar events (classes, career fairs) within a day window.",
            inputSchema: listEventsInput,
            execute: permissions.gated(
                "list_events",
                taskScopeResolvers.list_events!,
                async (input: z.infer<typeof listEventsInput>) => {
                    const from = Date.now();
                    const days = input.withinDays ?? 7;
                    return listEventsBetween(from, from + days * 86_400_000);
                },
            ),
        }),
    };
}
```

- [ ] **Step 4: Register in the catalog and resolver index**

`src/ai/tools/catalog.ts` — widen the group union and append entries + factory:

```ts
// group union gains "tasks":
group: "documents" | "notes" | "web" | "tasks";

// entries appended to TOOL_CATALOG:
{ name: "list_tasks", label: "List open tasks", access: "read", group: "tasks" },
{ name: "create_task", label: "Create a task", access: "write", group: "tasks" },
{ name: "complete_task", label: "Complete a task", access: "write", group: "tasks" },
{ name: "list_events", label: "List calendar events", access: "read", group: "tasks" },

// in buildToolSet's `all`:
...createTaskTools(deps.permissions),
```

`src/ai/tools/index.ts` — add `...taskScopeResolvers` to the spread. (Task 7 of plan.md's AgentEditor renders the new group automatically — `GROUPS` there must add `"tasks"`.)

- [ ] **Step 5: Run tests, typecheck, commit**

Run: `npx vitest run src/ai/tools/tasks.test.ts src/ai/tools/catalog.test.ts && npm run typecheck` — Expected: PASS (the catalog invariant test now also covers the four new tools).

```bash
git add src/ai/tools/tasks.ts src/ai/tools/tasks.test.ts src/ai/tools/catalog.ts src/ai/tools/index.ts src/app/agents/AgentEditor.tsx
git commit -m "feat: task and event agent tools behind the permission engine"
```

### Task 5: Tasks page (agenda, quick-add, courses, ICS import)

**Files:**
- Create: `src/app/tasks/TasksPage.tsx`
- Modify: `src/app/Sidebar.tsx`, `src/app/Shell.tsx`

**Interfaces:**
- Consumes: tasks/courses/events repos, `importClassSchedule`, `isTauri()`.
- Produces: `TasksPage()`; `Page` union gains `"tasks"` (sidebar "Workspace" section, `CalendarCheck` icon, SOON stub removed).

- [ ] **Step 1: Register the page**

`src/app/Sidebar.tsx`: add `"tasks"` to the `Page` union; add `{ page: "tasks", label: "Tasks", icon: CalendarCheck }` to the Workspace section items; delete the Tasks entry from `SOON`.
`src/app/Shell.tsx`: `import { TasksPage } from "./tasks/TasksPage";` and add `tasks: TasksPage` to `PAGES`.

- [ ] **Step 2: Create `src/app/tasks/TasksPage.tsx`**

```tsx
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
import type { CalendarEvent, Course, Task } from "@/lib/schemas";

const DAY = 86_400_000;

export function TasksPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [error, setError] = useState<string | null>(null);

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
                    <h1 className="font-display text-2xl font-bold tracking-wide">
                        Tasks
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Assignments, follow-ups, and the class schedule — also
                        readable by the planner agent.
                    </p>
                </header>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <QuickAdd courses={courses} onAdd={(input) => act(() => tasksRepo.createTask(input))} />
                <TaskList tasks={tasks} courses={courses} act={act} />
                <WeekEvents events={events} courses={courses} />
                <CoursesPanel courses={courses} act={act} />
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

    const submit = async () => {
        if (!title.trim()) return;
        await onAdd({
            title: title.trim(),
            courseId: courseId || null,
            dueAt: due ? new Date(due).getTime() : null,
            recurrence: (recurrence || null) as Recurrence | null,
        });
        setTitle("");
        setDue("");
        setRecurrence("");
    };

    return (
        <div className="flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm">
                New task
                <Input
                    value={title}
                    placeholder="e.g. ECE 437 lab 3 report"
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void submit()}
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
            <Button onClick={() => void submit()} aria-label="Add task">
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
}: {
    courses: Course[];
    act: (fn: () => Promise<unknown>) => Promise<void>;
}) {
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [term, setTerm] = useState("Fall 2026");
    const [importing, setImporting] = useState<string | null>(null);
    const [importResult, setImportResult] = useState<string | null>(null);

    const addCourse = () =>
        act(async () => {
            if (!code.trim() || !name.trim())
                throw new Error("course needs a code and a name");
            const folder = `/school/${code.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
            await coursesRepo.createCourse({ code, name, term, folder });
            setCode("");
            setName("");
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
                    <Button onClick={() => void addCourse()}>Add</Button>
                </div>
            </CardContent>
        </Card>
    );
}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm test` — Expected: clean.
Manual: add a course → import a real Purdue ICS export → lectures appear in "Next 7 days"; quick-add a weekly task, complete it, the next occurrence appears; re-import doesn't duplicate.

- [ ] **Step 4: Commit**

```bash
git add src/app/tasks/ src/app/Sidebar.tsx src/app/Shell.tsx
git commit -m "feat: tasks page with agenda, quick-add, courses, ICS import"
```
### Task 6: Home becomes a Today view

**Files:**
- Modify: `src/app/home/HomePage.tsx`

**Interfaces:**
- Consumes: `listEventsBetween`, `listOpenTasks`, and (after Task 7 — see note) `listFollowUpsDue`. Until Task 7 lands, the follow-ups section is omitted; Task 9 Step 4 adds it. Review counts arrive in Task 12.
- Produces: nothing consumed later (leaf page). Keep the existing `StatTile`, `greeting`, `NeuralCore` header block.

- [ ] **Step 1: Rework the body of `HomePage`**

Keep the file's imports/header/StatTile section; replace the "Modules — coming online" section (the three `StubPanel`s and their imports) with live panels:

```tsx
// Additional imports:
import { listOpenTasks } from "@/db/repo/tasks";
import { listEventsBetween } from "@/db/repo/events";
import { Badge } from "@/components/ui/badge";
import type { CalendarEvent, Task } from "@/lib/schemas";

const DAY = 86_400_000;

function endOfToday(): number {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
}
```

Inside `HomePage`, extend the load effect and state:

```tsx
const [today, setToday] = useState<{
    events: CalendarEvent[];
    dueTasks: Task[];
} | null>(null);

// inside the existing useEffect's async body, after setStats(...):
setToday({
    events: await listEventsBetween(Date.now() - 12 * 3_600_000, endOfToday()),
    dueTasks: await listOpenTasks({ dueBefore: endOfToday() + 2 * DAY }),
});
```

Replace the stub section's JSX:

```tsx
<section>
    <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
        Today
    </h2>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card corners className="flex flex-col gap-2 p-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                schedule
            </span>
            {today?.events.length ? (
                today.events.map((e) => (
                    <div key={e.id} className="flex items-center gap-2 text-sm">
                        <span className="w-16 font-mono text-xs text-primary">
                            {new Date(e.starts_at).toLocaleTimeString(undefined, {
                                hour: "numeric",
                                minute: "2-digit",
                            })}
                        </span>
                        <span className="flex-1 truncate">{e.title}</span>
                        {e.location && (
                            <span className="font-mono text-[10px] text-muted-foreground">
                                {e.location}
                            </span>
                        )}
                    </div>
                ))
            ) : (
                <span className="text-xs text-muted-foreground">
                    No classes today.
                </span>
            )}
        </Card>
        <Card corners className="flex flex-col gap-2 p-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                due next 48h
            </span>
            {today?.dueTasks.length ? (
                today.dueTasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 truncate">{t.title}</span>
                        <Badge
                            tone={
                                (t.due_at ?? 0) < Date.now()
                                    ? "destructive"
                                    : "warning"
                            }
                        >
                            {new Date(t.due_at!).toLocaleString(undefined, {
                                weekday: "short",
                                hour: "numeric",
                            })}
                        </Badge>
                    </div>
                ))
            ) : (
                <span className="text-xs text-muted-foreground">
                    Nothing due. Suspicious — check the Tasks page.
                </span>
            )}
        </Card>
    </div>
</section>
```

Remove the now-unused `StubPanel`/`Bookmark`/`ScrollText`/`CalendarCheck` imports.

- [ ] **Step 2: Verify + commit**

Run: `npm run typecheck && npm test` — Expected: clean. Manual: with an imported schedule and a due task, Home shows both.

```bash
git add src/app/home/HomePage.tsx
git commit -m "feat: home page becomes a Today view (schedule + due tasks)"
```

---

## Milestone 2 — Internship application tracker

### Task 7: applications migration + repository

**Files:**
- Create: `src-tauri/migrations/0007_applications.sql`, `src/db/repo/applications.ts`
- Modify: `src-tauri/src/lib.rs`, `src/lib/schemas.ts`
- Test: `src/db/repo/applications.test.ts`

**Interfaces:**
- Produces (schema): `applicationStatusSchema` = `"interested"|"applied"|"oa"|"interview"|"offer"|"rejected"|"ghosted"`; `applicationSchema/Application` (`id, company, role, url, status, applied_at, next_action, next_action_at, notes, created_at, updated_at`); `applicationEventSchema/ApplicationEvent`.
- Produces (repo): `createApplication({company, role, url?, notes?})` (status `interested`), `updateApplication(id, {company, role, url?, notes?, nextAction?, nextActionAt?})`, `setApplicationStatus(id, status, note?)` (logs an `application_events` row; stamps `applied_at` on first transition to `applied`), `deleteApplication(id)`, `getApplication(id)`, `listApplications(status?)`, `listApplicationEvents(applicationId)`, `listFollowUpsDue(before: number)`.

- [ ] **Step 1: Migration `src-tauri/migrations/0007_applications.sql`**

```sql
-- Internship/job application pipeline with an append-only status history.

CREATE TABLE applications (
    id TEXT PRIMARY KEY,
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    url TEXT,
    status TEXT NOT NULL DEFAULT 'interested'
        CHECK (status IN ('interested', 'applied', 'oa', 'interview', 'offer', 'rejected', 'ghosted')),
    applied_at INTEGER,
    next_action TEXT,
    next_action_at INTEGER,
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX idx_applications_status ON applications(status, updated_at);

CREATE TABLE application_events (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    note TEXT,
    created_at INTEGER NOT NULL
);
```

Register as `version: 7, description: "applications tracker"` in `lib.rs`.

- [ ] **Step 2: Schemas in `src/lib/schemas.ts`**

```ts
export const applicationStatusSchema = z.enum([
    "interested",
    "applied",
    "oa",
    "interview",
    "offer",
    "rejected",
    "ghosted",
]);
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

export const applicationSchema = z.object({
    id: z.string(),
    company: z.string(),
    role: z.string(),
    url: z.string().nullable(),
    status: applicationStatusSchema,
    applied_at: z.number().nullable(),
    next_action: z.string().nullable(),
    next_action_at: z.number().nullable(),
    notes: z.string().nullable(),
    created_at: z.number(),
    updated_at: z.number(),
});
export type Application = z.infer<typeof applicationSchema>;

export const applicationEventSchema = z.object({
    id: z.string(),
    application_id: z.string(),
    status: z.string(),
    note: z.string().nullable(),
    created_at: z.number(),
});
export type ApplicationEvent = z.infer<typeof applicationEventSchema>;
```

- [ ] **Step 3: Write the failing tests**

```ts
// src/db/repo/applications.test.ts
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import {
    createApplication,
    getApplication,
    listApplicationEvents,
    listApplications,
    listFollowUpsDue,
    setApplicationStatus,
    updateApplication,
} from "./applications";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

describe("applications repo", () => {
    it("creates as interested and logs status transitions", async () => {
        const app = await createApplication({
            company: "Anthropic",
            role: "SWE Intern",
            url: "https://example.com/job",
        });
        expect(app.status).toBe("interested");
        expect(app.applied_at).toBeNull();

        await setApplicationStatus(app.id, "applied", "via portal");
        const applied = await getApplication(app.id);
        expect(applied.status).toBe("applied");
        expect(applied.applied_at).not.toBeNull();

        await setApplicationStatus(app.id, "oa");
        const events = await listApplicationEvents(app.id);
        expect(events.map((e) => e.status)).toEqual(["oa", "applied"]);
        // applied_at is stamped once, not on later transitions.
        expect((await getApplication(app.id)).applied_at).toBe(
            applied.applied_at,
        );
    });

    it("filters by status", async () => {
        const a = await createApplication({ company: "A", role: "r" });
        await createApplication({ company: "B", role: "r" });
        await setApplicationStatus(a.id, "applied");
        expect(await listApplications("applied")).toHaveLength(1);
        expect(await listApplications()).toHaveLength(2);
    });

    it("surfaces due follow-ups", async () => {
        const app = await createApplication({ company: "C", role: "r" });
        await updateApplication(app.id, {
            company: "C",
            role: "r",
            nextAction: "email recruiter",
            nextActionAt: Date.now() - 1000,
        });
        const due = await listFollowUpsDue(Date.now());
        expect(due).toHaveLength(1);
        expect(due[0]!.next_action).toBe("email recruiter");
    });
});
```

Run: `npx vitest run src/db/repo/applications.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 4: Implement `src/db/repo/applications.ts`**

```ts
import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import {
    applicationEventSchema,
    applicationSchema,
    type Application,
    type ApplicationEvent,
    type ApplicationStatus,
} from "@/lib/schemas";

export async function createApplication(input: {
    company: string;
    role: string;
    url?: string | null;
    notes?: string | null;
}): Promise<Application> {
    const id = newId("app");
    const t = now();
    await getDb().execute(
        `INSERT INTO applications
           (id, company, role, url, status, applied_at, next_action,
            next_action_at, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'interested', NULL, NULL, NULL, ?, ?, ?)`,
        [id, input.company, input.role, input.url ?? null, input.notes ?? null, t, t],
    );
    return getApplication(id);
}

export async function updateApplication(
    id: string,
    input: {
        company: string;
        role: string;
        url?: string | null;
        notes?: string | null;
        nextAction?: string | null;
        nextActionAt?: number | null;
    },
): Promise<Application> {
    const res = await getDb().execute(
        `UPDATE applications SET company = ?, role = ?, url = ?, notes = ?,
            next_action = ?, next_action_at = ?, updated_at = ?
         WHERE id = ?`,
        [
            input.company,
            input.role,
            input.url ?? null,
            input.notes ?? null,
            input.nextAction ?? null,
            input.nextActionAt ?? null,
            now(),
            id,
        ],
    );
    if (res.rowsAffected === 0) throw new Error(`application not found: ${id}`);
    return getApplication(id);
}

/** Status change + history row; first move to 'applied' stamps applied_at. */
export async function setApplicationStatus(
    id: string,
    status: ApplicationStatus,
    note?: string,
): Promise<Application> {
    const current = await getApplication(id);
    const appliedAt =
        status === "applied" && current.applied_at === null
            ? now()
            : current.applied_at;
    await getDb().execute(
        "UPDATE applications SET status = ?, applied_at = ?, updated_at = ? WHERE id = ?",
        [status, appliedAt, now(), id],
    );
    await getDb().execute(
        `INSERT INTO application_events (id, application_id, status, note, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [newId("ape"), id, status, note ?? null, now()],
    );
    return getApplication(id);
}

export async function deleteApplication(id: string): Promise<void> {
    await getDb().execute("DELETE FROM applications WHERE id = ?", [id]);
}

export async function getApplication(id: string): Promise<Application> {
    const rows = await getDb().select(
        "SELECT * FROM applications WHERE id = ?",
        [id],
    );
    if (!rows[0]) throw new Error(`application not found: ${id}`);
    return applicationSchema.parse(rows[0]);
}

export async function listApplications(
    status?: ApplicationStatus,
): Promise<Application[]> {
    const rows = status
        ? await getDb().select(
              "SELECT * FROM applications WHERE status = ? ORDER BY updated_at DESC",
              [status],
          )
        : await getDb().select(
              "SELECT * FROM applications ORDER BY updated_at DESC",
          );
    return rows.map((r) => applicationSchema.parse(r));
}

export async function listApplicationEvents(
    applicationId: string,
): Promise<ApplicationEvent[]> {
    const rows = await getDb().select(
        `SELECT * FROM application_events WHERE application_id = ?
         ORDER BY created_at DESC`,
        [applicationId],
    );
    return rows.map((r) => applicationEventSchema.parse(r));
}

/** Follow-ups due before `before`, excluding closed applications. */
export async function listFollowUpsDue(before: number): Promise<Application[]> {
    const rows = await getDb().select(
        `SELECT * FROM applications
         WHERE next_action_at IS NOT NULL AND next_action_at <= ?
           AND status NOT IN ('offer', 'rejected')
         ORDER BY next_action_at ASC`,
        [before],
    );
    return rows.map((r) => applicationSchema.parse(r));
}
```

- [ ] **Step 5: Run tests, typecheck, commit**

Run: `npx vitest run src/db/repo/applications.test.ts && npm run typecheck` — Expected: PASS/clean.

```bash
git add src-tauri/migrations/0007_applications.sql src-tauri/src/lib.rs src/lib/schemas.ts src/db/repo/applications.ts src/db/repo/applications.test.ts
git commit -m "feat: applications tracker schema + repo with status history"
```

### Task 8: application tools + builtin Planner agent

**Files:**
- Create: `src/ai/tools/applications.ts`
- Modify: `src/ai/tools/catalog.ts`, `src/ai/tools/index.ts`, `src/db/repo/agents.ts`
- Test: `src/ai/tools/applications.test.ts`, `src/db/repo/agents.test.ts` (one added case)

**Interfaces:**
- Produces: `createApplicationTools(permissions)` with `list_applications` (read/any), `create_application` (write/any), `update_application_status` (write/any); `applicationScopeResolvers`; catalog group `"career"`; builtin agent `agt_planner` ("Planner") with tools `["list_tasks","create_task","list_events","list_applications","search_notes"]`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/ai/tools/applications.test.ts
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import {
    createApplication,
    getApplication,
    listApplications,
} from "@/db/repo/applications";
import { PermissionContext } from "./context";
import { createApplicationTools } from "./applications";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

const opts = { toolCallId: "t", messages: [] };

function allowAll(): PermissionContext {
    const p = new PermissionContext();
    p.levelGrants = [
        { tool: "list_applications", access: "read", scopeType: "any", scopeValue: null },
        { tool: "create_application", access: "write", scopeType: "any", scopeValue: null },
        { tool: "update_application_status", access: "write", scopeType: "any", scopeValue: null },
    ];
    return p;
}

describe("application tools", () => {
    it("creates and lists applications", async () => {
        const tools = createApplicationTools(allowAll());
        await tools.create_application.execute!(
            { company: "Anthropic", role: "SWE Intern", url: "https://x.co/j" },
            opts,
        );
        const listed = (await tools.list_applications.execute!(
            {},
            opts,
        )) as Array<{ company: string; status: string }>;
        expect(listed[0]).toMatchObject({
            company: "Anthropic",
            status: "interested",
        });
        expect(await listApplications()).toHaveLength(1);
    });

    it("updates status by id", async () => {
        const app = await createApplication({ company: "A", role: "r" });
        const tools = createApplicationTools(allowAll());
        await tools.update_application_status.execute!(
            { id: app.id, status: "oa", note: "HackerRank, due Fri" },
            opts,
        );
        expect((await getApplication(app.id)).status).toBe("oa");
    });

    it("denies writes without a grant", async () => {
        const p = new PermissionContext();
        p.broker.subscribe((pending) => {
            for (const req of pending) p.broker.respond(req.id, "deny");
        });
        const tools = createApplicationTools(p);
        const result = (await tools.create_application.execute!(
            { company: "X", role: "r" },
            opts,
        )) as { denied?: boolean };
        expect(result.denied).toBe(true);
    });
});
```

Append to `src/db/repo/agents.test.ts` (the seed test's expectation changes):

```ts
it("seeds the planner agent with semester tools", async () => {
    await seedBuiltinAgents();
    const planner = await getAgent("agt_planner");
    expect(planner.is_builtin).toBe(1);
    expect(agentToolNames(planner)).toEqual([
        "list_tasks",
        "create_task",
        "list_events",
        "list_applications",
        "search_notes",
    ]);
});
```

Also update the first seed test's id list to `["agt_knowledge", "agt_planner", "agt_research"]` (sorted).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ai/tools/applications.test.ts src/db/repo/agents.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `src/ai/tools/applications.ts`**

```ts
import { tool } from "ai";
import { z } from "zod";
import {
    createApplication,
    listApplications,
    setApplicationStatus,
} from "@/db/repo/applications";
import { applicationStatusSchema } from "@/lib/schemas";
import type { ResolvedScope } from "@/ai/permissions/types";
import type { PermissionContext, ScopeResolver } from "./context";

const listInput = z.object({
    status: applicationStatusSchema
        .optional()
        .describe("Filter by pipeline stage. Omit for all."),
});

const createInput = z.object({
    company: z.string(),
    role: z.string(),
    url: z.string().optional().describe("Job posting URL"),
    notes: z.string().optional(),
});

const statusInput = z.object({
    id: z.string().describe("Application id from list_applications"),
    status: applicationStatusSchema,
    note: z.string().optional().describe("What happened (kept in history)"),
});

const anyScope = (access: "read" | "write"): ResolvedScope => ({
    access,
    scopeType: "any",
    scopeValue: null,
});

export const applicationScopeResolvers: Record<string, ScopeResolver> = {
    list_applications: () => anyScope("read"),
    create_application: () => anyScope("write"),
    update_application_status: () => anyScope("write"),
};

export function createApplicationTools(permissions: PermissionContext) {
    return {
        list_applications: tool({
            description:
                "List the user's internship/job applications with statuses, follow-ups, and ids.",
            inputSchema: listInput,
            execute: permissions.gated(
                "list_applications",
                applicationScopeResolvers.list_applications!,
                async (input: z.infer<typeof listInput>) =>
                    listApplications(input.status),
            ),
        }),
        create_application: tool({
            description:
                "Track a new internship/job application the user is interested in or has applied to.",
            inputSchema: createInput,
            execute: permissions.gated(
                "create_application",
                applicationScopeResolvers.create_application!,
                async (input: z.infer<typeof createInput>) =>
                    createApplication({
                        company: input.company,
                        role: input.role,
                        url: input.url ?? null,
                        notes: input.notes ?? null,
                    }),
            ),
        }),
        update_application_status: tool({
            description:
                "Move an application to a new pipeline stage (applied, oa, interview, offer, rejected, ghosted).",
            inputSchema: statusInput,
            execute: permissions.gated(
                "update_application_status",
                applicationScopeResolvers.update_application_status!,
                async (input: z.infer<typeof statusInput>) =>
                    setApplicationStatus(input.id, input.status, input.note),
            ),
        }),
    };
}
```

- [ ] **Step 4: Register + seed the Planner**

`src/ai/tools/catalog.ts`: widen group union with `"career"`; append entries; spread `...createApplicationTools(deps.permissions)` in `buildToolSet`:

```ts
{ name: "list_applications", label: "List applications", access: "read", group: "career" },
{ name: "create_application", label: "Track an application", access: "write", group: "career" },
{ name: "update_application_status", label: "Update application status", access: "write", group: "career" },
```

`src/ai/tools/index.ts`: spread `...applicationScopeResolvers`. `AgentEditor`'s `GROUPS` adds `"career"`.

`src/db/repo/agents.ts` — append to the `seeds` array in `seedBuiltinAgents` (and add `planner: "agt_planner"` to `BUILTIN_AGENT_IDS`):

```ts
{
    id: BUILTIN_AGENT_IDS.planner,
    name: "Planner",
    description:
        "Plans the user's week from tasks, the class schedule, and application follow-ups. Use for 'plan my day/week', workload questions, and creating follow-up tasks.",
    instructions: `You are the planner agent for a busy engineering student.
Ground every plan in real data: list_tasks and list_events first, and
list_applications when career work is in scope. Propose a concrete, realistic
schedule around fixed classes; respect due dates; batch similar work. Create
tasks only when the user asked for them (create_task), and say exactly what
you created. If a tool result reports {denied: true}, plan without that data
and say what you could not see.`,
    tools: [
        "list_tasks",
        "create_task",
        "list_events",
        "list_applications",
        "search_notes",
    ],
},
```

- [ ] **Step 5: Run tests, typecheck, commit**

Run: `npm test && npm run typecheck` — Expected: PASS (catalog invariant test covers the three new tools; existing installs get the Planner via `INSERT OR IGNORE` on next boot).

```bash
git add src/ai/tools/applications.ts src/ai/tools/applications.test.ts src/ai/tools/catalog.ts src/ai/tools/index.ts src/db/repo/agents.ts src/db/repo/agents.test.ts src/app/agents/AgentEditor.tsx
git commit -m "feat: application tools + builtin planner agent"
```

### Task 9: Applications board page

**Files:**
- Create: `src/app/applications/ApplicationsPage.tsx`
- Modify: `src/app/Sidebar.tsx`, `src/app/Shell.tsx`, `src/app/home/HomePage.tsx`

**Interfaces:**
- Consumes: applications repo (Task 7).
- Produces: `ApplicationsPage()`; `Page` union gains `"applications"` (Workspace section, `Briefcase` icon). Home gains the follow-ups panel deferred from Task 6.

- [ ] **Step 1: Register the page**

`Sidebar.tsx`: add `"applications"` to `Page`; Workspace item `{ page: "applications", label: "Applications", icon: Briefcase }` (lucide `Briefcase`).
`Shell.tsx`: add `applications: ApplicationsPage` to `PAGES` with the import.

- [ ] **Step 2: Create `src/app/applications/ApplicationsPage.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import * as appsRepo from "@/db/repo/applications";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Application, ApplicationStatus } from "@/lib/schemas";

const COLUMNS: { status: ApplicationStatus; label: string }[] = [
    { status: "interested", label: "Interested" },
    { status: "applied", label: "Applied" },
    { status: "oa", label: "OA" },
    { status: "interview", label: "Interview" },
    { status: "offer", label: "Offer" },
];
const CLOSED: ApplicationStatus[] = ["rejected", "ghosted"];
const ALL_STATUSES = [...COLUMNS.map((c) => c.status), ...CLOSED];

export function ApplicationsPage() {
    const [apps, setApps] = useState<Application[]>([]);
    const [showClosed, setShowClosed] = useState(false);
    const [editing, setEditing] = useState<Application | "new" | null>(null);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setApps(await appsRepo.listApplications());
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

    const closed = apps.filter((a) => CLOSED.includes(a.status));

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mx-auto flex max-w-6xl flex-col gap-6">
                <header className="flex items-end justify-between">
                    <div>
                        <h1 className="font-display text-2xl font-bold tracking-wide">
                            Applications
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {apps.length} tracked ·{" "}
                            {apps.filter((a) => a.status === "applied").length}{" "}
                            in flight · {closed.length} closed
                        </p>
                    </div>
                    <Button onClick={() => setEditing("new")}>
                        <Plus className="mr-1 h-3.5 w-3.5" /> Track application
                    </Button>
                </header>
                {error && <p className="text-xs text-destructive">{error}</p>}

                {editing && (
                    <ApplicationEditor
                        application={editing === "new" ? null : editing}
                        onDone={async () => {
                            setEditing(null);
                            await reload();
                        }}
                    />
                )}

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                    {COLUMNS.map((col) => (
                        <div key={col.status} className="flex flex-col gap-2">
                            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                {col.label} ·{" "}
                                {apps.filter((a) => a.status === col.status).length}
                            </div>
                            {apps
                                .filter((a) => a.status === col.status)
                                .map((a) => (
                                    <AppCard
                                        key={a.id}
                                        app={a}
                                        act={act}
                                        onEdit={() => setEditing(a)}
                                    />
                                ))}
                        </div>
                    ))}
                </div>

                <button
                    className="cursor-pointer self-start font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    onClick={() => setShowClosed((s) => !s)}
                >
                    {showClosed ? "hide" : "show"} closed ({closed.length})
                </button>
                {showClosed && (
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {closed.map((a) => (
                            <AppCard
                                key={a.id}
                                app={a}
                                act={act}
                                onEdit={() => setEditing(a)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function AppCard({
    app,
    act,
    onEdit,
}: {
    app: Application;
    act: (fn: () => Promise<unknown>) => Promise<void>;
    onEdit: () => void;
}) {
    const followUpDue =
        app.next_action_at !== null && app.next_action_at <= Date.now();
    return (
        <Card className="flex flex-col gap-2 p-3">
            <button
                onClick={onEdit}
                className="cursor-pointer text-left text-sm font-medium hover:text-primary"
            >
                {app.company}
            </button>
            <span className="text-xs text-muted-foreground">{app.role}</span>
            {app.next_action && (
                <Badge tone={followUpDue ? "warning" : "neutral"}>
                    {app.next_action}
                </Badge>
            )}
            <div className="flex items-center gap-1">
                <Select
                    aria-label={`Status of ${app.company}`}
                    value={app.status}
                    onChange={(e) =>
                        void act(() =>
                            appsRepo.setApplicationStatus(
                                app.id,
                                e.target.value as ApplicationStatus,
                            ),
                        )
                    }
                    className="flex-1 text-xs"
                >
                    {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                            {s}
                        </option>
                    ))}
                </Select>
                {app.url && (
                    <a
                        href={app.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${app.company} posting`}
                        className="p-1 text-muted-foreground hover:text-primary"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${app.company}`}
                    onClick={() =>
                        void act(() => appsRepo.deleteApplication(app.id))
                    }
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        </Card>
    );
}

function ApplicationEditor({
    application,
    onDone,
}: {
    application: Application | null;
    onDone: () => Promise<void>;
}) {
    const [company, setCompany] = useState(application?.company ?? "");
    const [role, setRole] = useState(application?.role ?? "");
    const [url, setUrl] = useState(application?.url ?? "");
    const [notes, setNotes] = useState(application?.notes ?? "");
    const [nextAction, setNextAction] = useState(application?.next_action ?? "");
    const [nextActionAt, setNextActionAt] = useState(
        application?.next_action_at
            ? new Date(application.next_action_at).toISOString().slice(0, 16)
            : "",
    );
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        setError(null);
        try {
            const fields = {
                company,
                role,
                url: url || null,
                notes: notes || null,
                nextAction: nextAction || null,
                nextActionAt: nextActionAt
                    ? new Date(nextActionAt).getTime()
                    : null,
            };
            if (application)
                await appsRepo.updateApplication(application.id, fields);
            else {
                const created = await appsRepo.createApplication(fields);
                if (fields.nextAction || fields.nextActionAt)
                    await appsRepo.updateApplication(created.id, fields);
            }
            await onDone();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    {application
                        ? `Edit ${application.company}`
                        : "Track application"}
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <div className="flex gap-3">
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Company
                        <Input
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Role
                        <Input
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                        />
                    </label>
                </div>
                <label className="flex flex-col gap-1 text-sm">
                    Posting URL
                    <Input value={url} onChange={(e) => setUrl(e.target.value)} />
                </label>
                <div className="flex gap-3">
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Next action
                        <Input
                            value={nextAction}
                            placeholder="e.g. follow up with recruiter"
                            onChange={(e) => setNextAction(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        When
                        <Input
                            type="datetime-local"
                            value={nextActionAt}
                            onChange={(e) => setNextActionAt(e.target.value)}
                        />
                    </label>
                </div>
                <label className="flex flex-col gap-1 text-sm">
                    Notes
                    <Textarea
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </label>
                <div className="flex items-center gap-3">
                    <Button onClick={() => void save()}>Save</Button>
                    <Button variant="ghost" onClick={() => void onDone()}>
                        Cancel
                    </Button>
                    {error && (
                        <span className="text-xs text-destructive">{error}</span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
```

- [ ] **Step 3: Add the follow-ups panel to Home**

In `HomePage.tsx`: import `listFollowUpsDue` from `@/db/repo/applications` and `Application` type; extend the `today` state with `followUps: Application[]` loaded via `await listFollowUpsDue(endOfToday())`; add a third card to the Today grid (make it `md:grid-cols-3`):

```tsx
<Card corners className="flex flex-col gap-2 p-4">
    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        follow-ups due
    </span>
    {today?.followUps.length ? (
        today.followUps.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">
                    {a.company} — {a.next_action}
                </span>
                <Badge tone="warning">
                    {new Date(a.next_action_at!).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                    })}
                </Badge>
            </div>
        ))
    ) : (
        <span className="text-xs text-muted-foreground">All caught up.</span>
    )}
</Card>
```

- [ ] **Step 4: Verify + commit**

Run: `npm run typecheck && npm test` — Expected: clean.
Manual: track two applications, move one to `applied` (status dropdown), set a past-due next action → it shows amber on the board and on Home. In chat, ask the Planner-enabled preset "what's my application pipeline?" → `list_applications` runs under the permission engine.

```bash
git add src/app/applications/ src/app/Sidebar.tsx src/app/Shell.tsx src/app/home/HomePage.tsx
git commit -m "feat: internship application board + home follow-ups"
```
---

## Milestone 3 — Study loop (spaced repetition)

### Task 10: flashcards migration + SM-2 + repository

**Files:**
- Create: `src-tauri/migrations/0008_flashcards.sql`, `src/lib/sm2.ts`, `src/db/repo/flashcards.ts`
- Modify: `src-tauri/src/lib.rs`, `src/lib/schemas.ts`
- Test: `src/lib/sm2.test.ts`, `src/db/repo/flashcards.test.ts`

**Interfaces:**
- Produces (pure): `Grade = 0 | 3 | 4 | 5` (Again/Hard/Good/Easy); `reviewCard(state: {ease, intervalDays, reps}, grade, now): {ease, intervalDays, reps, dueAt}`.
- Produces (schema): `flashcardSchema/Flashcard` (`id, folder, front, back, source_note_id, ease, interval_days, reps, due_at, suspended, created_at, updated_at`).
- Produces (repo): `createFlashcards(cards: {front, back}[], opts: {folder, sourceNoteId?}): Promise<number>`, `listDueFlashcards(now, limit?)`, `countDueFlashcards(now)`, `applyReview(id, grade, now?)`, `suspendFlashcard(id)`, `deleteFlashcard(id)`, `listFlashcards(folder?)`.

- [ ] **Step 1: Write the failing SM-2 test**

```ts
// src/lib/sm2.test.ts
import { describe, expect, it } from "vitest";
import { reviewCard } from "./sm2";

const DAY = 86_400_000;
const fresh = { ease: 2.5, intervalDays: 0, reps: 0 };

describe("reviewCard (SM-2)", () => {
    it("first Good = 1 day, second = 6 days, then interval * ease", () => {
        const now = 0;
        const r1 = reviewCard(fresh, 4, now);
        expect(r1.intervalDays).toBe(1);
        expect(r1.dueAt).toBe(now + 1 * DAY);

        const r2 = reviewCard(r1, 4, r1.dueAt);
        expect(r2.intervalDays).toBe(6);

        const r3 = reviewCard(r2, 4, r2.dueAt);
        expect(r3.intervalDays).toBe(Math.round(6 * r2.ease));
    });

    it("Again resets reps and requeues in 10 minutes, easing down", () => {
        const seasoned = { ease: 2.5, intervalDays: 20, reps: 5 };
        const r = reviewCard(seasoned, 0, 1_000_000);
        expect(r.reps).toBe(0);
        expect(r.intervalDays).toBe(0);
        expect(r.dueAt).toBe(1_000_000 + 10 * 60_000);
        expect(r.ease).toBeLessThan(2.5);
    });

    it("Easy grows ease, Hard shrinks it, floor at 1.3", () => {
        expect(reviewCard(fresh, 5, 0).ease).toBeGreaterThan(2.5);
        expect(reviewCard(fresh, 3, 0).ease).toBeLessThan(2.5);
        const floor = reviewCard({ ease: 1.3, intervalDays: 1, reps: 2 }, 3, 0);
        expect(floor.ease).toBe(1.3);
    });
});
```

Run: `npx vitest run src/lib/sm2.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 2: Implement `src/lib/sm2.ts`**

```ts
/** Anki-style grades: 0 Again, 3 Hard, 4 Good, 5 Easy. */
export type Grade = 0 | 3 | 4 | 5;

export interface ReviewState {
    ease: number;
    intervalDays: number;
    reps: number;
}

const DAY = 86_400_000;

/** Classic SM-2. Failures requeue in 10 minutes and reset the streak. */
export function reviewCard(
    state: ReviewState,
    grade: Grade,
    now: number,
): ReviewState & { dueAt: number } {
    if (grade < 3) {
        return {
            ease: Math.max(1.3, state.ease - 0.2),
            intervalDays: 0,
            reps: 0,
            dueAt: now + 10 * 60_000,
        };
    }
    const ease = Math.max(
        1.3,
        state.ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)),
    );
    const intervalDays =
        state.reps === 0
            ? 1
            : state.reps === 1
              ? 6
              : Math.round(state.intervalDays * ease);
    return {
        ease,
        intervalDays,
        reps: state.reps + 1,
        dueAt: now + intervalDays * DAY,
    };
}
```

Run: `npx vitest run src/lib/sm2.test.ts` — Expected: PASS.

- [ ] **Step 3: Migration + schema**

```sql
-- src-tauri/migrations/0008_flashcards.sql
-- Spaced-repetition cards. folder ties a card to a course's permission scope.

CREATE TABLE flashcards (
    id TEXT PRIMARY KEY,
    folder TEXT NOT NULL DEFAULT '/',
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    source_note_id TEXT,
    ease REAL NOT NULL DEFAULT 2.5,
    interval_days REAL NOT NULL DEFAULT 0,
    reps INTEGER NOT NULL DEFAULT 0,
    due_at INTEGER NOT NULL,
    suspended INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX idx_flashcards_due ON flashcards(suspended, due_at);
```

Register as `version: 8, description: "flashcards"`. Schema in `src/lib/schemas.ts`:

```ts
export const flashcardSchema = z.object({
    id: z.string(),
    folder: z.string(),
    front: z.string(),
    back: z.string(),
    source_note_id: z.string().nullable(),
    ease: z.number(),
    interval_days: z.number(),
    reps: z.number(),
    due_at: z.number(),
    suspended: sqlBool,
    created_at: z.number(),
    updated_at: z.number(),
});
export type Flashcard = z.infer<typeof flashcardSchema>;
```

- [ ] **Step 4: Write the failing repo test**

```ts
// src/db/repo/flashcards.test.ts
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import {
    applyReview,
    countDueFlashcards,
    createFlashcards,
    listDueFlashcards,
    suspendFlashcard,
} from "./flashcards";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

describe("flashcards repo", () => {
    it("bulk-creates cards due immediately", async () => {
        const n = await createFlashcards(
            [
                { front: "Carnot efficiency?", back: "1 - Tc/Th" },
                { front: "MESI states?", back: "Modified Exclusive Shared Invalid" },
            ],
            { folder: "/school/ece437" },
        );
        expect(n).toBe(2);
        expect(await countDueFlashcards(Date.now())).toBe(2);
    });

    it("review pushes due date out; failed cards requeue soon", async () => {
        await createFlashcards([{ front: "f", back: "b" }], { folder: "/" });
        const [card] = await listDueFlashcards(Date.now());
        const now = Date.now();

        await applyReview(card!.id, 4, now);
        expect(await countDueFlashcards(now + 60_000)).toBe(0); // 1 day away
        expect(await countDueFlashcards(now + 2 * 86_400_000)).toBe(1);

        const [again] = await listDueFlashcards(now + 2 * 86_400_000);
        await applyReview(again!.id, 0, now);
        expect(await countDueFlashcards(now + 11 * 60_000)).toBe(1); // 10 min
    });

    it("suspended cards leave the queue", async () => {
        await createFlashcards([{ front: "f", back: "b" }], { folder: "/" });
        const [card] = await listDueFlashcards(Date.now());
        await suspendFlashcard(card!.id);
        expect(await countDueFlashcards(Date.now())).toBe(0);
    });

    it("rejects empty batches", async () => {
        await expect(createFlashcards([], { folder: "/" })).rejects.toThrow(
            /at least one/,
        );
    });
});
```

Run: `npx vitest run src/db/repo/flashcards.test.ts` — Expected: FAIL.

- [ ] **Step 5: Implement `src/db/repo/flashcards.ts`**

```ts
import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { flashcardSchema, type Flashcard } from "@/lib/schemas";
import { reviewCard, type Grade } from "@/lib/sm2";
import { normalizeFolder } from "./documents";

export async function createFlashcards(
    cards: { front: string; back: string }[],
    opts: { folder: string; sourceNoteId?: string | null },
): Promise<number> {
    if (cards.length === 0)
        throw new Error("createFlashcards needs at least one card");
    const t = now();
    const folder = normalizeFolder(opts.folder);
    for (const c of cards) {
        await getDb().execute(
            `INSERT INTO flashcards
               (id, folder, front, back, source_note_id, ease, interval_days,
                reps, due_at, suspended, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 2.5, 0, 0, ?, 0, ?, ?)`,
            [newId("fc"), folder, c.front, c.back, opts.sourceNoteId ?? null, t, t, t],
        );
    }
    return cards.length;
}

export async function listDueFlashcards(
    nowMs: number,
    limit = 50,
): Promise<Flashcard[]> {
    const rows = await getDb().select(
        `SELECT * FROM flashcards
         WHERE suspended = 0 AND due_at <= ?
         ORDER BY due_at ASC LIMIT ?`,
        [nowMs, limit],
    );
    return rows.map((r) => flashcardSchema.parse(r));
}

export async function countDueFlashcards(nowMs: number): Promise<number> {
    const rows = await getDb().select<{ n: number }>(
        "SELECT COUNT(*) AS n FROM flashcards WHERE suspended = 0 AND due_at <= ?",
        [nowMs],
    );
    return rows[0]?.n ?? 0;
}

export async function applyReview(
    id: string,
    grade: Grade,
    nowMs = now(),
): Promise<Flashcard> {
    const rows = await getDb().select(
        "SELECT * FROM flashcards WHERE id = ?",
        [id],
    );
    if (!rows[0]) throw new Error(`flashcard not found: ${id}`);
    const card = flashcardSchema.parse(rows[0]);
    const next = reviewCard(
        { ease: card.ease, intervalDays: card.interval_days, reps: card.reps },
        grade,
        nowMs,
    );
    await getDb().execute(
        `UPDATE flashcards SET ease = ?, interval_days = ?, reps = ?,
            due_at = ?, updated_at = ? WHERE id = ?`,
        [next.ease, next.intervalDays, next.reps, next.dueAt, now(), id],
    );
    return flashcardSchema.parse(
        (await getDb().select("SELECT * FROM flashcards WHERE id = ?", [id]))[0],
    );
}

export async function suspendFlashcard(id: string): Promise<void> {
    await getDb().execute(
        "UPDATE flashcards SET suspended = 1, updated_at = ? WHERE id = ?",
        [now(), id],
    );
}

export async function deleteFlashcard(id: string): Promise<void> {
    await getDb().execute("DELETE FROM flashcards WHERE id = ?", [id]);
}

export async function listFlashcards(folder?: string): Promise<Flashcard[]> {
    const f = folder ? normalizeFolder(folder) : null;
    const rows =
        f && f !== "/"
            ? await getDb().select(
                  `SELECT * FROM flashcards WHERE folder = ? OR folder LIKE ?
                   ORDER BY created_at DESC`,
                  [f, `${f}/%`],
              )
            : await getDb().select(
                  "SELECT * FROM flashcards ORDER BY created_at DESC",
              );
    return rows.map((r) => flashcardSchema.parse(r));
}
```

- [ ] **Step 6: Run tests, typecheck, commit**

Run: `npm test && npm run typecheck` — Expected: PASS/clean.

```bash
git add src-tauri/migrations/0008_flashcards.sql src-tauri/src/lib.rs src/lib/schemas.ts src/lib/sm2.ts src/lib/sm2.test.ts src/db/repo/flashcards.ts src/db/repo/flashcards.test.ts
git commit -m "feat: flashcards with SM-2 spaced repetition"
```

### Task 11: `create_flashcards` agent tool

**Files:**
- Create: `src/ai/tools/flashcards.ts`
- Modify: `src/ai/tools/catalog.ts`, `src/ai/tools/index.ts`
- Test: `src/ai/tools/flashcards.test.ts`

**Interfaces:**
- Produces: `createFlashcardTools(permissions)` with `create_flashcards` (write, `doc_folder` scope on the target folder — a "Study ECE437" level can allow card creation for `/school/ece437` only); `flashcardScopeResolvers`. Catalog group: `"notes"` reused? No — group `"study"`.

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/tools/flashcards.test.ts
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { countDueFlashcards } from "@/db/repo/flashcards";
import { PermissionContext } from "./context";
import { createFlashcardTools } from "./flashcards";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

const opts = { toolCallId: "t", messages: [] };

describe("create_flashcards tool", () => {
    it("creates cards when the folder is granted", async () => {
        const p = new PermissionContext();
        p.levelGrants = [
            {
                tool: "create_flashcards",
                access: "write",
                scopeType: "doc_folder",
                scopeValue: "/school/ece437",
            },
        ];
        const tools = createFlashcardTools(p);
        const result = (await tools.create_flashcards.execute!(
            {
                folder: "/school/ece437",
                cards: [
                    { front: "What is MESI?", back: "A cache coherence protocol" },
                ],
            },
            opts,
        )) as { created: number };
        expect(result.created).toBe(1);
        expect(await countDueFlashcards(Date.now())).toBe(1);
    });

    it("asks (deny honored) outside the granted folder", async () => {
        const p = new PermissionContext();
        p.broker.subscribe((pending) => {
            for (const req of pending) p.broker.respond(req.id, "deny");
        });
        const tools = createFlashcardTools(p);
        const result = (await tools.create_flashcards.execute!(
            { folder: "/personal", cards: [{ front: "f", back: "b" }] },
            opts,
        )) as { denied?: boolean };
        expect(result.denied).toBe(true);
        expect(await countDueFlashcards(Date.now())).toBe(0);
    });
});
```

Run: `npx vitest run src/ai/tools/flashcards.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement `src/ai/tools/flashcards.ts`**

```ts
import { tool } from "ai";
import { z } from "zod";
import { createFlashcards } from "@/db/repo/flashcards";
import { normalizeFolder } from "@/db/repo/documents";
import type { PermissionContext, ScopeResolver } from "./context";

const createInput = z.object({
    folder: z
        .string()
        .describe("Course folder for the cards, e.g. /school/ece437"),
    cards: z
        .array(
            z.object({
                front: z.string().describe("Question / prompt side"),
                back: z.string().describe("Answer side — concise"),
            }),
        )
        .min(1)
        .max(50)
        .describe("The flashcards to create"),
});

export const flashcardScopeResolvers: Record<string, ScopeResolver> = {
    create_flashcards: (input) => ({
        access: "write",
        scopeType: "doc_folder",
        scopeValue: normalizeFolder(
            (input as z.infer<typeof createInput>).folder,
        ),
    }),
};

export function createFlashcardTools(permissions: PermissionContext) {
    return {
        create_flashcards: tool({
            description:
                "Create spaced-repetition flashcards from study material. Make fronts specific questions, backs short answers. File under the course folder.",
            inputSchema: createInput,
            execute: permissions.gated(
                "create_flashcards",
                flashcardScopeResolvers.create_flashcards!,
                async (input: z.infer<typeof createInput>) => ({
                    created: await createFlashcards(input.cards, {
                        folder: input.folder,
                    }),
                }),
            ),
        }),
    };
}
```

- [ ] **Step 3: Register**

`catalog.ts`: group union gains `"study"`; entry `{ name: "create_flashcards", label: "Create flashcards", access: "write", group: "study" }`; spread `...createFlashcardTools(deps.permissions)` in `buildToolSet`. `index.ts`: spread `...flashcardScopeResolvers`. `AgentEditor` `GROUPS` adds `"study"`.

- [ ] **Step 4: Run tests, typecheck, commit**

Run: `npm test && npm run typecheck` — Expected: PASS.

```bash
git add src/ai/tools/flashcards.ts src/ai/tools/flashcards.test.ts src/ai/tools/catalog.ts src/ai/tools/index.ts src/app/agents/AgentEditor.tsx
git commit -m "feat: create_flashcards tool, write-gated by course folder"
```

### Task 12: Review page + Today integration

**Files:**
- Create: `src/app/review/ReviewPage.tsx`
- Modify: `src/app/Sidebar.tsx`, `src/app/Shell.tsx`, `src/app/home/HomePage.tsx`

**Interfaces:**
- Consumes: flashcards repo (Task 10), `marked` (same rendering caveat as plan.md Task 8: mirror `MessageList.tsx`'s markdown call).
- Produces: `ReviewPage()`; `Page` union gains `"review"` (Workspace, `GraduationCap` icon). Home shows the due-card count linking the loop together.

- [ ] **Step 1: Register the page** (same pattern as Tasks 5/9: union + Workspace item + `PAGES` entry).

- [ ] **Step 2: Create `src/app/review/ReviewPage.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { marked } from "marked";
import {
    applyReview,
    countDueFlashcards,
    listDueFlashcards,
    suspendFlashcard,
} from "@/db/repo/flashcards";
import type { Grade } from "@/lib/sm2";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Flashcard } from "@/lib/schemas";

const GRADES: { grade: Grade; label: string; key: string }[] = [
    { grade: 0, label: "Again", key: "1" },
    { grade: 3, label: "Hard", key: "2" },
    { grade: 4, label: "Good", key: "3" },
    { grade: 5, label: "Easy", key: "4" },
];

export function ReviewPage() {
    const [queue, setQueue] = useState<Flashcard[]>([]);
    const [dueCount, setDueCount] = useState(0);
    const [revealed, setRevealed] = useState(false);
    const [reviewed, setReviewed] = useState(0);

    const reload = useCallback(async () => {
        setQueue(await listDueFlashcards(Date.now()));
        setDueCount(await countDueFlashcards(Date.now()));
        setRevealed(false);
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);

    const card = queue[0] ?? null;

    const grade = useCallback(
        async (g: Grade) => {
            if (!card || !revealed) return;
            await applyReview(card.id, g);
            setReviewed((n) => n + 1);
            await reload();
        },
        [card, revealed, reload],
    );

    // Keyboard-first: space reveals, 1-4 grade.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement) return;
            if (e.code === "Space") {
                e.preventDefault();
                setRevealed(true);
                return;
            }
            const g = GRADES.find((x) => x.key === e.key);
            if (g) void grade(g.grade);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [grade]);

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mx-auto flex max-w-2xl flex-col gap-6">
                <header className="flex items-end justify-between">
                    <div>
                        <h1 className="font-display text-2xl font-bold tracking-wide">
                            Review
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Space reveals · 1–4 grades. Cards come from the
                            create_flashcards tool or pipelines over your notes.
                        </p>
                    </div>
                    <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        {dueCount} due · {reviewed} done
                    </span>
                </header>

                {!card ? (
                    <Card corners className="p-8 text-center">
                        <p className="text-sm text-muted-foreground">
                            Queue clear.{" "}
                            {reviewed > 0
                                ? `${reviewed} reviewed this session.`
                                : "Ask an agent to make cards from your lecture notes."}
                        </p>
                    </Card>
                ) : (
                    <Card corners className="flex flex-col gap-4 p-6">
                        <div className="flex items-center justify-between">
                            <Badge>{card.folder}</Badge>
                            <button
                                className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                    void suspendFlashcard(card.id).then(reload)
                                }
                            >
                                suspend
                            </button>
                        </div>
                        <div
                            className="text-base"
                            dangerouslySetInnerHTML={{
                                __html: marked.parse(card.front, {
                                    async: false,
                                }),
                            }}
                        />
                        {revealed ? (
                            <>
                                <div
                                    className="border-t border-border pt-4 text-sm text-foreground/90"
                                    dangerouslySetInnerHTML={{
                                        __html: marked.parse(card.back, {
                                            async: false,
                                        }),
                                    }}
                                />
                                <div className="flex gap-2">
                                    {GRADES.map((g) => (
                                        <Button
                                            key={g.grade}
                                            variant={
                                                g.grade === 0
                                                    ? "destructive"
                                                    : g.grade === 4
                                                      ? "default"
                                                      : "outline"
                                            }
                                            className="flex-1"
                                            onClick={() => void grade(g.grade)}
                                        >
                                            {g.label}
                                            <span className="ml-1 font-mono text-[10px] opacity-60">
                                                {g.key}
                                            </span>
                                        </Button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <Button onClick={() => setRevealed(true)}>
                                Reveal (space)
                            </Button>
                        )}
                    </Card>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Due count on Home**

In `HomePage.tsx`: import `countDueFlashcards`; add `reviewDue: number` to the `today` state (`await countDueFlashcards(Date.now())`); render it as a footer line inside the "due next 48h" card:

```tsx
{today && (
    <span className="mt-1 font-mono text-[10px] uppercase tracking-wider text-primary">
        {today.reviewDue > 0
            ? `${today.reviewDue} flashcards due`
            : "reviews clear"}
    </span>
)}
```

- [ ] **Step 4: Verify + commit**

Run: `npm run typecheck && npm test` — Expected: clean.
Manual: in a Study chat, "make flashcards from my ECE 437 notes on cache coherence" → approval (write, `/school/ece437`) → cards appear; review with space/1-4; Again requeues within the session; Home shows the due count.
Automation idea to document in the commit body (uses plan.md D, no code): weekly pipeline "Knowledge: summarize this week's notes in /school → create_flashcards" under a level granting exactly those two tools.

```bash
git add src/app/review/ src/app/Sidebar.tsx src/app/Shell.tsx src/app/home/HomePage.tsx
git commit -m "feat: spaced-repetition review page with keyboard grading"
```
---

## Milestone 4 — Speed layer

### Task 13: bookmarks + snippets (Library)

**Files:**
- Create: `src-tauri/migrations/0009_library.sql`, `src/db/repo/library.ts`, `src/app/library/LibraryPage.tsx`
- Modify: `src-tauri/src/lib.rs`, `src/lib/schemas.ts`, `src/app/Sidebar.tsx`, `src/app/Shell.tsx`, `package.json`, `src-tauri/capabilities/` (opener)
- Test: `src/db/repo/library.test.ts`

**Interfaces:**
- Produces (schema): `bookmarkSchema/Bookmark` (`id, title, url, group_name, created_at`), `snippetSchema/Snippet` (`id, title, body, created_at, updated_at`).
- Produces (repo): `createBookmark({title, url, groupName?})`, `listBookmarks()` (grouped order), `deleteBookmark(id)`, `createSnippet({title, body})`, `updateSnippet(id, {title, body})`, `listSnippets()`, `deleteSnippet(id)`, `searchLibrary(query)` (LIKE match over both, for the palette).
- Produces (util): `openExternal(url)` — plugin-opener on Tauri, `window.open` on web. Palette (Task 14) consumes `searchLibrary` + `openExternal`.

- [ ] **Step 1: Migration `src-tauri/migrations/0009_library.sql`** (register as version 9, `"bookmarks + snippets"`)

```sql
CREATE TABLE bookmarks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    group_name TEXT NOT NULL DEFAULT 'General',
    created_at INTEGER NOT NULL
);

CREATE TABLE snippets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

Schemas in `src/lib/schemas.ts`:

```ts
export const bookmarkSchema = z.object({
    id: z.string(),
    title: z.string(),
    url: z.string(),
    group_name: z.string(),
    created_at: z.number(),
});
export type Bookmark = z.infer<typeof bookmarkSchema>;

export const snippetSchema = z.object({
    id: z.string(),
    title: z.string(),
    body: z.string(),
    created_at: z.number(),
    updated_at: z.number(),
});
export type Snippet = z.infer<typeof snippetSchema>;
```

- [ ] **Step 2: Failing repo test**

```ts
// src/db/repo/library.test.ts
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import {
    createBookmark,
    createSnippet,
    listBookmarks,
    searchLibrary,
} from "./library";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

describe("library repo", () => {
    it("groups bookmarks and searches across both kinds", async () => {
        await createBookmark({
            title: "Brightspace",
            url: "https://purdue.brightspace.com",
            groupName: "School",
        });
        await createSnippet({
            title: "SSH ecegrid",
            body: "ssh user@ecegrid.ecn.purdue.edu",
        });

        const grouped = await listBookmarks();
        expect(grouped[0]!.group_name).toBe("School");

        const hits = await searchLibrary("ecegrid");
        expect(hits).toHaveLength(1);
        expect(hits[0]!.kind).toBe("snippet");
        expect((await searchLibrary("bright"))[0]!.kind).toBe("bookmark");
    });
});
```

Run: `npx vitest run src/db/repo/library.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `src/db/repo/library.ts`**

```ts
import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import {
    bookmarkSchema,
    snippetSchema,
    type Bookmark,
    type Snippet,
} from "@/lib/schemas";

export async function createBookmark(input: {
    title: string;
    url: string;
    groupName?: string;
}): Promise<Bookmark> {
    const id = newId("bmk");
    await getDb().execute(
        `INSERT INTO bookmarks (id, title, url, group_name, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, input.title, input.url, input.groupName ?? "General", now()],
    );
    const rows = await getDb().select("SELECT * FROM bookmarks WHERE id = ?", [id]);
    return bookmarkSchema.parse(rows[0]);
}

export async function listBookmarks(): Promise<Bookmark[]> {
    const rows = await getDb().select(
        "SELECT * FROM bookmarks ORDER BY group_name ASC, title ASC",
    );
    return rows.map((r) => bookmarkSchema.parse(r));
}

export async function deleteBookmark(id: string): Promise<void> {
    await getDb().execute("DELETE FROM bookmarks WHERE id = ?", [id]);
}

export async function createSnippet(input: {
    title: string;
    body: string;
}): Promise<Snippet> {
    const id = newId("snp");
    const t = now();
    await getDb().execute(
        `INSERT INTO snippets (id, title, body, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, input.title, input.body, t, t],
    );
    const rows = await getDb().select("SELECT * FROM snippets WHERE id = ?", [id]);
    return snippetSchema.parse(rows[0]);
}

export async function updateSnippet(
    id: string,
    input: { title: string; body: string },
): Promise<void> {
    const res = await getDb().execute(
        "UPDATE snippets SET title = ?, body = ?, updated_at = ? WHERE id = ?",
        [input.title, input.body, now(), id],
    );
    if (res.rowsAffected === 0) throw new Error(`snippet not found: ${id}`);
}

export async function listSnippets(): Promise<Snippet[]> {
    const rows = await getDb().select(
        "SELECT * FROM snippets ORDER BY title ASC",
    );
    return rows.map((r) => snippetSchema.parse(r));
}

export async function deleteSnippet(id: string): Promise<void> {
    await getDb().execute("DELETE FROM snippets WHERE id = ?", [id]);
}

export interface LibraryHit {
    kind: "bookmark" | "snippet";
    id: string;
    title: string;
    detail: string;
}

/** Cheap LIKE search for the palette (tables are tiny; FTS is overkill). */
export async function searchLibrary(query: string): Promise<LibraryHit[]> {
    const like = `%${query.replaceAll("%", "").replaceAll("_", "")}%`;
    const bookmarks = await getDb().select<{ id: string; title: string; url: string }>(
        "SELECT id, title, url FROM bookmarks WHERE title LIKE ? OR url LIKE ? LIMIT 8",
        [like, like],
    );
    const snippets = await getDb().select<{ id: string; title: string; body: string }>(
        "SELECT id, title, body FROM snippets WHERE title LIKE ? OR body LIKE ? LIMIT 8",
        [like, like],
    );
    return [
        ...bookmarks.map((b) => ({
            kind: "bookmark" as const,
            id: b.id,
            title: b.title,
            detail: b.url,
        })),
        ...snippets.map((s) => ({
            kind: "snippet" as const,
            id: s.id,
            title: s.title,
            detail: s.body,
        })),
    ];
}
```

- [ ] **Step 4: Opener plumbing + Library page**

Install: `npm install @tauri-apps/plugin-opener` and `cd src-tauri && cargo add tauri-plugin-opener`. In `lib.rs` builder chain add `.plugin(tauri_plugin_opener::init())`. In the app capability file under `src-tauri/capabilities/`, add `"opener:default"` to `permissions`.

Create `src/lib/openExternal.ts`:

```ts
import { isTauri } from "@/lib/env";

/** Open a URL in the system browser (Tauri) or a new tab (web). */
export async function openExternal(url: string): Promise<void> {
    if (isTauri()) {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(url);
        return;
    }
    window.open(url, "_blank", "noopener");
}
```

Create `src/app/library/LibraryPage.tsx` — two sections following the established card/form patterns (this page is intentionally boring):

```tsx
import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import * as lib from "@/db/repo/library";
import { openExternal } from "@/lib/openExternal";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Bookmark, Snippet } from "@/lib/schemas";

export function LibraryPage() {
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [snippets, setSnippets] = useState<Snippet[]>([]);

    const reload = useCallback(async () => {
        setBookmarks(await lib.listBookmarks());
        setSnippets(await lib.listSnippets());
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
                <header>
                    <h1 className="font-display text-2xl font-bold tracking-wide">
                        Library
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Bookmarks and snippets — all reachable from ⌘K.
                    </p>
                </header>
                <BookmarksCard bookmarks={bookmarks} reload={reload} />
                <SnippetsCard snippets={snippets} reload={reload} />
            </div>
        </div>
    );
}

function BookmarksCard({
    bookmarks,
    reload,
}: {
    bookmarks: Bookmark[];
    reload: () => Promise<void>;
}) {
    const [title, setTitle] = useState("");
    const [url, setUrl] = useState("");
    const [group, setGroup] = useState("School");
    const groups = [...new Set(bookmarks.map((b) => b.group_name))];

    const add = async () => {
        if (!title.trim() || !url.trim()) return;
        await lib.createBookmark({ title, url, groupName: group || "General" });
        setTitle("");
        setUrl("");
        await reload();
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Bookmarks</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {groups.map((g) => (
                    <div key={g} className="flex flex-col gap-1">
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            {g}
                        </span>
                        {bookmarks
                            .filter((b) => b.group_name === g)
                            .map((b) => (
                                <div
                                    key={b.id}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <button
                                        className="flex-1 cursor-pointer truncate text-left hover:text-primary"
                                        onClick={() =>
                                            void openExternal(b.url)
                                        }
                                    >
                                        {b.title}
                                    </button>
                                    <span className="max-w-48 truncate font-mono text-[10px] text-muted-foreground">
                                        {b.url}
                                    </span>
                                    <ExternalLink
                                        aria-hidden
                                        className="h-3 w-3 text-muted-foreground"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Delete ${b.title}`}
                                        onClick={() =>
                                            void lib
                                                .deleteBookmark(b.id)
                                                .then(reload)
                                        }
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ))}
                    </div>
                ))}
                <div className="flex items-end gap-2">
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Title
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        URL
                        <Input
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                        />
                    </label>
                    <label className="flex w-32 flex-col gap-1 text-sm">
                        Group
                        <Input
                            value={group}
                            onChange={(e) => setGroup(e.target.value)}
                        />
                    </label>
                    <Button onClick={() => void add()} aria-label="Add bookmark">
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function SnippetsCard({
    snippets,
    reload,
}: {
    snippets: Snippet[];
    reload: () => Promise<void>;
}) {
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [copied, setCopied] = useState<string | null>(null);

    const add = async () => {
        if (!title.trim() || !body.trim()) return;
        await lib.createSnippet({ title, body });
        setTitle("");
        setBody("");
        await reload();
    };

    const copy = async (s: Snippet) => {
        await navigator.clipboard.writeText(s.body);
        setCopied(s.id);
        setTimeout(() => setCopied(null), 1200);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Snippets</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {snippets.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 text-sm">
                        <span className="w-40 truncate">{s.title}</span>
                        <code className="flex-1 truncate rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs">
                            {s.body}
                        </code>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Copy ${s.title}`}
                            onClick={() => void copy(s)}
                        >
                            <Copy className="h-3.5 w-3.5" />
                        </Button>
                        {copied === s.id && (
                            <span className="font-mono text-[10px] uppercase text-success">
                                copied
                            </span>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${s.title}`}
                            onClick={() =>
                                void lib.deleteSnippet(s.id).then(reload)
                            }
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                ))}
                <div className="flex items-end gap-2">
                    <label className="flex w-48 flex-col gap-1 text-sm">
                        Title
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Body
                        <Textarea
                            rows={1}
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                        />
                    </label>
                    <Button onClick={() => void add()} aria-label="Add snippet">
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
```

Register the page: `Page` union gains `"library"`; Workspace item `{ page: "library", label: "Library", icon: Bookmark }`; `PAGES` entry. Remove Bookmarks + Snippets from `SOON` (the `SOON` block and `StubPanel` usage are now empty — delete the block; keep `StubPanel` on disk for future phases).

- [ ] **Step 5: Verify + commit**

Run: `npm test && npm run typecheck` — Expected: PASS. Manual (desktop): a bookmark opens in the system browser; snippet copy works.

```bash
git add -A
git commit -m "feat: library page (bookmarks + snippets) with system opener"
```

### Task 14: global ⌘K command palette

**Files:**
- Create: `src/components/palette/CommandPalette.tsx`
- Modify: `src/app/Shell.tsx`, `package.json` (add `cmdk`)

**Interfaces:**
- Consumes: `searchNotes` + `NoteSearchHit` (existing notes repo), `listOpenTasks`, `completeTask`, `listApplications`, `searchLibrary`, `openExternal`, the `Page` union.
- Produces: `CommandPalette({ onNavigate })` mounted once in `Shell`; opens on ⌘K/Ctrl-K.

- [ ] **Step 1: Install** — `npm install cmdk` (MIT, $0).

- [ ] **Step 2: Create `src/components/palette/CommandPalette.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Command } from "cmdk";
import {
    Bookmark as BookmarkIcon,
    Briefcase,
    CheckSquare,
    FileText,
    NotebookPen,
    Navigation,
    ScrollText,
} from "lucide-react";
import { searchNotes } from "@/db/repo/notes";
import { listOpenTasks, completeTask } from "@/db/repo/tasks";
import { listApplications } from "@/db/repo/applications";
import { searchLibrary, type LibraryHit } from "@/db/repo/library";
import { openExternal } from "@/lib/openExternal";
import type { Page } from "@/app/Sidebar";
import type { Application, Task } from "@/lib/schemas";
import type { NoteSearchHit } from "@/db/repo/notes";

const NAV: { page: Page; label: string }[] = [
    { page: "home", label: "Home" },
    { page: "chat", label: "Chat" },
    { page: "agents", label: "Agents" },
    { page: "tasks", label: "Tasks" },
    { page: "applications", label: "Applications" },
    { page: "review", label: "Review" },
    { page: "notes", label: "Notes" },
    { page: "library", label: "Library" },
    { page: "presets", label: "Presets" },
    { page: "permissions", label: "Permissions" },
    { page: "settings", label: "Settings" },
];

export function CommandPalette({
    onNavigate,
}: {
    onNavigate: (page: Page) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [notes, setNotes] = useState<NoteSearchHit[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [apps, setApps] = useState<Application[]>([]);
    const [libraryHits, setLibraryHits] = useState<LibraryHit[]>([]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((o) => !o);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Fan out searches; tasks/applications are small enough to filter client-side.
    useEffect(() => {
        if (!open) return;
        const q = query.trim();
        void (async () => {
            setTasks((await listOpenTasks()).slice(0, 30));
            setApps((await listApplications()).slice(0, 30));
            if (q.length >= 2) {
                setNotes(await searchNotes(q, { limit: 6 }));
                setLibraryHits(await searchLibrary(q));
            } else {
                setNotes([]);
                setLibraryHits(await searchLibrary(""));
            }
        })();
    }, [open, query]);

    const close = () => {
        setOpen(false);
        setQuery("");
    };
    const go = (page: Page) => {
        onNavigate(page);
        close();
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-background/60 pt-[15vh]"
            onClick={close}
        >
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl">
                <Command
                    label="Command palette"
                    shouldFilter
                    className="hud-panel hud-corners overflow-hidden rounded-md border border-border"
                >
                    <Command.Input
                        autoFocus
                        value={query}
                        onValueChange={setQuery}
                        placeholder="Search notes, tasks, applications, bookmarks… (esc closes)"
                        onKeyDown={(e) => e.key === "Escape" && close()}
                        className="w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
                    />
                    <Command.List className="max-h-[50vh] overflow-y-auto p-2">
                        <Command.Empty className="p-4 text-center text-xs text-muted-foreground">
                            Nothing matches.
                        </Command.Empty>

                        <Command.Group heading="Go to">
                            {NAV.map((n) => (
                                <Item
                                    key={n.page}
                                    icon={Navigation}
                                    onSelect={() => go(n.page)}
                                >
                                    {n.label}
                                </Item>
                            ))}
                        </Command.Group>

                        {libraryHits.length > 0 && (
                            <Command.Group heading="Library">
                                {libraryHits.map((h) => (
                                    <Item
                                        key={h.id}
                                        icon={
                                            h.kind === "bookmark"
                                                ? BookmarkIcon
                                                : ScrollText
                                        }
                                        onSelect={() => {
                                            if (h.kind === "bookmark")
                                                void openExternal(h.detail);
                                            else
                                                void navigator.clipboard.writeText(
                                                    h.detail,
                                                );
                                            close();
                                        }}
                                    >
                                        {h.title}
                                        <span className="ml-2 truncate font-mono text-[10px] text-muted-foreground">
                                            {h.kind === "bookmark"
                                                ? h.detail
                                                : "copy"}
                                        </span>
                                    </Item>
                                ))}
                            </Command.Group>
                        )}

                        {tasks.length > 0 && (
                            <Command.Group heading="Tasks (enter = complete)">
                                {tasks.map((t) => (
                                    <Item
                                        key={t.id}
                                        icon={CheckSquare}
                                        onSelect={() =>
                                            void completeTask(t.id).then(close)
                                        }
                                    >
                                        {t.title}
                                    </Item>
                                ))}
                            </Command.Group>
                        )}

                        {apps.length > 0 && (
                            <Command.Group heading="Applications">
                                {apps.map((a) => (
                                    <Item
                                        key={a.id}
                                        icon={Briefcase}
                                        onSelect={() => go("applications")}
                                    >
                                        {a.company} — {a.role}
                                        <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                                            {a.status}
                                        </span>
                                    </Item>
                                ))}
                            </Command.Group>
                        )}

                        {notes.length > 0 && (
                            <Command.Group heading="Notes">
                                {notes.map((n) => (
                                    <Item
                                        key={n.id}
                                        icon={NotebookPen}
                                        onSelect={() => go("notes")}
                                    >
                                        {n.title}
                                        <span className="ml-2 truncate font-mono text-[10px] text-muted-foreground">
                                            {n.snippet}
                                        </span>
                                    </Item>
                                ))}
                            </Command.Group>
                        )}
                    </Command.List>
                </Command>
            </div>
        </div>
    );
}

function Item({
    icon: Icon,
    onSelect,
    children,
}: {
    icon: typeof FileText;
    onSelect: () => void;
    children: React.ReactNode;
}) {
    return (
        <Command.Item
            onSelect={onSelect}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
        >
            <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
            <span className="flex min-w-0 flex-1 items-baseline">{children}</span>
        </Command.Item>
    );
}
```

- [ ] **Step 3: Mount in `Shell.tsx`**

Inside `Shell`'s root div (after `<StatusBar>`): `<CommandPalette onNavigate={setPage} />` with the import. Style note: cmdk group headings need one global rule in `globals.css`:

```css
[cmdk-group-heading] {
    padding: 0.25rem 0.75rem;
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--muted-foreground);
}
```

- [ ] **Step 4: Verify + commit**

Run: `npm run typecheck && npm test` — Expected: clean.
Manual: ⌘K anywhere → type "brights" → Enter opens Brightspace; type a task name → Enter completes it; esc closes; every group renders in the HUD style.

```bash
git add src/components/palette/ src/app/Shell.tsx src/styles/globals.css package.json package-lock.json
git commit -m "feat: global command palette (cmdk)"
```

---

## Milestone 5 — Reliability & $0 ops

### Task 15: daily backups, export, and usage visibility

**Files:**
- Create: `src/lib/backup.ts`, `src/db/repo/usage.ts`
- Modify: `src/app/bootstrap.ts`, `src/app/settings/SettingsPage.tsx`, `src-tauri/capabilities/` (fs appdata read/write if not already granted)

**Interfaces:**
- Produces: `runDailyBackup(): Promise<string | null>` (Tauri only: `VACUUM INTO` a dated file under app-data `backups/`, prune to 14, return the path or null if already done/not Tauri); `exportNotesMarkdown(): Promise<Blob>` (all notes concatenated as one markdown document — works on both targets); `usageByDay(days?): Promise<{day: string; model: string; inputTokens: number; outputTokens: number}[]>`.

- [ ] **Step 1: Implement `src/lib/backup.ts`**

```ts
import { getDb } from "@/db/client";
import { isTauri } from "@/lib/env";
import { listNotes, getNote } from "@/db/repo/notes";

/**
 * One backup per calendar day, kept 14 deep. VACUUM INTO is SQLite's official
 * online-backup path — safe while the app is running, and it compacts too.
 * If the SQL layer rejects VACUUM INTO, surface the error; do not fall back
 * to copying a live db file (torn copies are worse than no backup).
 */
export async function runDailyBackup(): Promise<string | null> {
    if (!isTauri()) return null;
    const { appDataDir, join } = await import("@tauri-apps/api/path");
    const { exists, mkdir, readDir, remove } = await import(
        "@tauri-apps/plugin-fs"
    );
    const dir = await join(await appDataDir(), "backups");
    if (!(await exists(dir))) await mkdir(dir, { recursive: true });

    const stamp = new Date().toISOString().slice(0, 10);
    const target = await join(dir, `dashboard-${stamp}.db`);
    if (await exists(target)) return null; // today's backup already exists

    await getDb().execute(`VACUUM INTO '${target.replaceAll("'", "''")}'`);

    const entries = (await readDir(dir))
        .map((e) => e.name)
        .filter((n): n is string => !!n && n.startsWith("dashboard-"))
        .sort();
    for (const old of entries.slice(0, Math.max(0, entries.length - 14))) {
        await remove(await join(dir, old));
    }
    return target;
}

/** Everything-as-markdown escape hatch; also the web target's "backup". */
export async function exportNotesMarkdown(): Promise<Blob> {
    const summaries = await listNotes();
    const parts: string[] = [];
    for (const s of summaries) {
        const note = await getNote(s.id);
        parts.push(`# ${note.title}\n\n_${note.folder}_\n\n${note.body_md}\n`);
    }
    return new Blob([parts.join("\n---\n\n")], { type: "text/markdown" });
}
```

Check the app capability file under `src-tauri/capabilities/`: it must include `"fs:allow-appdata-read-recursive"` and `"fs:allow-appdata-write-recursive"` (the attachments feature likely granted these already — add if missing).

- [ ] **Step 2: Implement `src/db/repo/usage.ts`**

```ts
import { getDb } from "../client";

export interface DailyUsage {
    day: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
}

/** Token spend per day/model — makes free-tier headroom visible. */
export async function usageByDay(days = 14): Promise<DailyUsage[]> {
    const since = Date.now() - days * 86_400_000;
    return getDb().select<DailyUsage>(
        `SELECT date(created_at / 1000, 'unixepoch') AS day,
                COALESCE(model, 'unknown') AS model,
                SUM(COALESCE(input_tokens, 0)) AS inputTokens,
                SUM(COALESCE(output_tokens, 0)) AS outputTokens
         FROM chat_messages
         WHERE created_at >= ? AND (input_tokens IS NOT NULL OR output_tokens IS NOT NULL)
         GROUP BY day, model
         ORDER BY day DESC`,
        [since],
    );
}
```

- [ ] **Step 3: Wire bootstrap + Settings**

`src/app/bootstrap.ts` — at the end of `runBootstrap()`, before the return: fire-and-forget so a backup failure never blocks launch, but log it loudly:

```ts
void import("@/lib/backup").then(({ runDailyBackup }) =>
    runDailyBackup().catch((e) => console.error("daily backup failed:", e)),
);
```

`src/app/settings/SettingsPage.tsx` — append two cards following the page's existing card pattern:

**Data card**: a "Back up now" button (Tauri) calling `runDailyBackup()` and showing the returned path or "already backed up today"; an "Export notes (.md)" button on both targets:

```tsx
const blob = await exportNotesMarkdown();
const a = document.createElement("a");
a.href = URL.createObjectURL(blob);
a.download = `notes-${new Date().toISOString().slice(0, 10)}.md`;
a.click();
URL.revokeObjectURL(a.href);
```

**Usage card**: table of `usageByDay(14)` rows — `font-mono` columns day / model / in / out — with the caption "Gemini free tier resets daily; Ollama is always $0."

- [ ] **Step 4: Verify + commit**

Run: `npm test && npm run typecheck` — Expected: clean.
Manual (desktop): launch → `backups/dashboard-<today>.db` exists in the app-data dir and opens in `sqlite3` (`.tables` shows the schema); pressing "Back up now" again reports already-done; usage card shows today's chat tokens; notes export downloads.

```bash
git add src/lib/backup.ts src/db/repo/usage.ts src/app/bootstrap.ts src/app/settings/SettingsPage.tsx src-tauri/capabilities/
git commit -m "feat: daily VACUUM INTO backups, notes export, usage rollup"
```

---

## Final end-to-end verification (after Task 15)

1. `npm test && npm run typecheck` — green; `npm run eval` unaffected (router eval untouched by this plan).
2. Fresh profile: migrations 1–9 apply; Planner seeds alongside Knowledge/Research; all six new sidebar destinations render; `SOON` list is gone.
3. **The semester dry-run:** add ECE courses → import the real registrar ICS → Today shows tomorrow's classes. Quick-add "437 lab report" due Friday → amber on Today at T-48h.
4. **The application dry-run:** track 3 postings, advance one to OA with a follow-up date → board + Today follow-ups agree; ask the Planner preset "plan my week around my classes and follow-ups" → it calls `list_events`, `list_tasks`, `list_applications` under the permission engine and produces a grounded plan.
5. **The study loop:** "make flashcards from my cache-coherence notes" → approve write to `/school/ece437` → review with keyboard → Home count drops to zero.
6. **Reliability:** kill the app mid-day, relaunch — no duplicate backup; delete the db, restore yesterday's file from `backups/` by copying it over `dashboard.db`, relaunch — data intact.
7. **$0 audit:** `npm ls ical.js cmdk @tauri-apps/plugin-opener` — three free packages; Settings usage card confirms all traffic on `gemini-*`/Ollama models unless a BYOK key was deliberately configured.

## The $0 playbook (operating notes, not tasks)

- **Models:** keep `defaultProvider: google` with `gemini-2.5-flash` + `flash-lite` router (free tier), or point Ollama at a local `qwen3`/`llama3.2` for fully offline. Automations inherit these via `buildPipelineRuntime` — a scheduled digest costs $0.
- **Recommended starter automations** (built in the UI, no code): nightly "summarize today's notes → write_note to /journal"; MWF "scan saved job-posting URLs → update /career notes"; Sunday "draft my week plan from tasks + calendar → note".
- **Recommended permission levels:** "Semester" (read tasks/events/notes + write_note `/journal`), "Career" (read/write applications + fetch_url on chosen job boards), "Study ECE437" (read `/school/ece437` + create_flashcards there). Write grants stay user-created, per the architecture's hard rule.

## Execution handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks (superpowers:subagent-driven-development).
2. **Inline Execution** — task-by-task in one session with checkpoints (superpowers:executing-plans).
