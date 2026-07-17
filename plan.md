# Categories & Signal Implementation Plan — pipelines that work, a calendar-first planner, categories everywhere

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make pipelines genuinely useful (real web access via a search tool + a dev-server proxy, template tokens rendered as inline pills, a starter-template gallery, save-run-to-note), open the Planner on a calendar with 7-day/14-day/month views that shows every scheduled thing, introduce a first-class **categories** system that projects/tasks/notes/chats/courses all hang off (the Projects section becomes Categories with a Projects tab inside), relocate the flashcard Review tab into Notes where it belongs, give chat search + filters + model-generated metadata, and split the universe network into per-category spheres with an exo-sphere for overflow.

**Architecture:** Everything stays a local-first Tauri 2 + React SPA over one SQLite file. Two new migrations: `0012` adds the `categories` table, `category_id` columns on five tables, chat auto-metadata columns, a `messages_fts` table, and migrates existing courses/tasks into categories; `0013` grants the builtin Research agent the new `search_web` tool. Web access for the browser target goes through a tiny Vite dev/preview middleware (`/__proxy?url=`) because CORS + the COOP/COEP headers block cross-origin fetches there (desktop already allows `https://*/*` via plugin-http). The `{{token}}` editor is a classic transparent-textarea-over-styled-backdrop overlay, so text metrics never drift. The network sphere gets a `shell` radius multiplier per node plus wheel zoom — exo-sphere nodes sit at `shell: 1.4` and scrolling out reveals them.

**Tech Stack:** React 19, TypeScript strict, Tailwind v4, motion, lucide-react, zod, SQLite (tauri-plugin-sql / sqlite-wasm+OPFS / better-sqlite3 in tests), Vercel AI SDK. **No new dependencies.**

## Global Constraints

- **$0 budget:** no new npm packages, no services, no paid APIs. `search_web` uses the free `html.duckduckgo.com` HTML endpoint (no key).
- **Three DB clients, one schema:** every schema change is a new `src-tauri/migrations/00NN_name.sql` file **and** a new `Migration` entry in `src-tauri/src/lib.rs` (`version: NN`). The web worker (`import.meta.glob`) and vitest (`testClient.ts` reads the directory) pick the file up automatically — no other registration.
- **Migration content rule:** `ALTER TABLE … ADD COLUMN` only with NULL/constant defaults (SQLite limitation). Never rely on `PRAGMA foreign_keys` for cascades in new code — do explicit `UPDATE`/`DELETE`s (the three clients differ).
- **Perf contract (WSLg):** no SVG filters, no `backdrop-blur`, no per-frame allocations in HUD components. Canvas/SVG attribute writes inside one rAF only.
- **Schema mirror:** every new column appears in the matching zod schema in `src/lib/schemas.ts` (`z.object` is non-strict, so land the migration first, then the schema, then the repo).
- **Timestamps are milliseconds** (`now()` = `Date.now()`). All new range math uses ms.
- **Gates:** `npm run typecheck` and `npm test` must pass before every commit. UI-only steps get a manual verification step via `npm run dev` (browser target is enough; it exercises the same code). Headless browser QA is not available in this environment — flag UI checks for a human pass.
- **AI must never break the app:** metadata generation and flashcard generation are fire-and-forget — catch and log, never surface as a chat/notes error.
- **Style:** 4-space indent, double quotes, `cn()` for class merging, repos throw on missing rows, `void` prefix for fire-and-forget promises — match the file you are editing.
- Work on a branch: `git checkout -b feat/categories-signal` before Task 1.

## File Structure (what exists after the plan)

```txt
src-tauri/migrations/
  0012_categories.sql              NEW  categories, category_id cols, chat metadata, messages_fts, course backfill
  0013_search_web.sql              NEW  builtin Research agent gains search_web
src-tauri/src/lib.rs               MOD  register versions 12 & 13
vite.config.ts                     MOD  corsProxy() middleware for dev + preview
src/lib/schemas.ts                 MOD  categorySchema; new columns on 5 schemas; sessionTags()
src/lib/categories.ts              NEW  effectiveCategoryId()
src/db/repo/categories.ts          NEW  category CRUD + counts + detach-on-delete
src/db/repo/categories.test.ts     NEW
src/db/repo/{sessions,tasks,notes,projects,courses,messages}.ts  MOD
src/db/repo/messages.test.ts       NEW  FTS write + search
src/app/bootstrap.ts               MOD  messages_fts one-time backfill
src/ai/providers/appFetch.ts       MOD  wrapWebFetch (browser → /__proxy)
src/ai/tools/web.ts                MOD  search_web tool + parseDdgResults
src/ai/tools/web.test.ts           NEW  DDG parser fixtures
src/ai/tools/catalog.ts            MOD  search_web entry; web tools use wrapped fetch
src/ai/tools/notes.ts              MOD  listNotes new filter signature
src/ai/chat/metadata.ts            NEW  auto title/tags/summary via router model
src/ai/chat/metadata.test.ts       NEW
src/ai/notes/flashcardGen.ts       NEW  one-shot "make cards from this note"
src/ai/pipelines/templates.ts      NEW  starter pipeline templates
src/db/repo/agents.ts              MOD  Research seed includes search_web (fresh DBs)
src/app/Sidebar.tsx                MOD  "Projects" → "Categories" (page id: categories)
src/app/Shell.tsx                  MOD  categories routing
src/components/palette/CommandPalette.tsx  MOD  categories + review targets
src/app/categories/CategoriesPage.tsx      NEW  category cards + uncategorized projects
src/app/categories/CategoryDetail.tsx      NEW  Projects | Chats | Tasks | Notes tabs
src/app/projects/ProjectsPage.tsx  DEL  (list body lives in categories/)
src/app/projects/ProjectDetail.tsx KEEP unchanged, opened from CategoryDetail
src/app/planner/PlannerPage.tsx    MOD  calendar-first, review tab removed
src/app/planner/TasksTab.tsx       MOD  category picker + filter (courses out of the UI)
src/app/planner/CalendarTab.tsx    MOD  7d/14d/month views, unified items, filters
src/app/planner/calendarItems.ts   NEW  CalendarItem + collectCalendarItems
src/app/planner/calendarItems.test.ts NEW
src/app/notes/NotesPage.tsx        MOD  Review tab hosted here; note categories
src/app/notes/ReviewTab.tsx        MOV  from planner/ReviewTab.tsx (+ purpose copy)
src/app/agents/TemplateEditor.tsx  NEW  textarea with inline token pills
src/app/agents/PipelinesTab.tsx    MOD  TemplateEditor, template gallery
src/app/agents/AutomationsTab.tsx  MOD  TemplateEditor for input template
src/app/agents/RunHistory.tsx      MOD  "save as note" on successful runs
src/app/chat/ChatWorkspace.tsx     MOD  category sphere focus, metadata hook
src/app/chat/InstancesSidebar.tsx  MOD  search box, category filter, assign selects
src/components/hud/networkData.ts  MOD  shell field, buildCategoryUniverse
src/components/hud/networkData.test.ts MOD  category universe cases
src/components/hud/NetworkSphere.tsx   MOD  wheel zoom + shell radii
docs/architecture.md               MOD  data model + IA updates
docs/todo.md                       MOD  close out this round of notes
```

Deliberately **not** done (YAGNI):
- Bookmarks/snippets don't get their own `category_id` — they already filter by group and project, and a project carries its category. Revisit if that indirection ever bites.
- No "Uncategorized" drill-in page — unfiled items remain visible in their home sections; only the network sphere gets an "unfiled" star.
- Flashcards keep folder scoping (no `category_id`); the Review tab move + copy fixes the confusion, not a new tagging axis.
- No calendar event *creation* UI — events still come from ICS import; tasks/automations/applications are the user-authored time entries.

---

### Task 1: Migration 0012 + 0013 and schema mirror

Categories become a real table; chats get metadata columns; message text gets an FTS table; existing courses/tasks migrate into categories so nothing is lost when the tasks UI switches over. 0013 upgrades the builtin Research agent's toolset (a one-time UPDATE — the TS seed only runs `INSERT OR IGNORE`, so existing DBs never re-read it).

**Files:**
- Create: `src-tauri/migrations/0012_categories.sql`
- Create: `src-tauri/migrations/0013_search_web.sql`
- Modify: `src-tauri/src/lib.rs` (append after the `version: 11` entry)
- Modify: `src/lib/schemas.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `categories` table; `category_id` on `projects`/`tasks`/`notes`/`chat_sessions`/`courses`; `chat_sessions.auto_summary`, `chat_sessions.auto_tags_json`; `messages_fts(message_id, session_id, content)`; zod `categorySchema`/`Category`, updated `Project`/`Task`/`Note`/`ChatSession`/`Course` types; `sessionTags(session): string[]`.

- [ ] **Step 1: Write `0012_categories.sql`**

```sql
-- Categories: the universal tag every section filters by. Projects, tasks,
-- notes, chats, and courses point at this table directly; bookmarks,
-- snippets, and documents inherit a category through their project.

CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

ALTER TABLE projects ADD COLUMN category_id TEXT REFERENCES categories(id);
ALTER TABLE tasks ADD COLUMN category_id TEXT REFERENCES categories(id);
ALTER TABLE notes ADD COLUMN category_id TEXT REFERENCES categories(id);
ALTER TABLE chat_sessions ADD COLUMN category_id TEXT REFERENCES categories(id);
ALTER TABLE courses ADD COLUMN category_id TEXT REFERENCES categories(id);

-- Chat metadata the router model generates after an exchange; search and
-- filtering read these.
ALTER TABLE chat_sessions ADD COLUMN auto_summary TEXT;
ALTER TABLE chat_sessions ADD COLUMN auto_tags_json TEXT NOT NULL DEFAULT '[]';

-- Full-text search over chat message text. Standalone (no content= sync):
-- parts_json is a JSON array, so the messages repo extracts text parts in TS
-- and writes rows itself — SQL triggers can't do that portably.
CREATE VIRTUAL TABLE messages_fts USING fts5(
    message_id UNINDEXED,
    session_id UNINDEXED,
    content
);

-- Courses were the old task category. Give every course a same-named
-- category and move task assignment over, so existing data survives the
-- tasks UI switching from courses to categories.
INSERT OR IGNORE INTO categories (id, name, color, created_at, updated_at)
    SELECT 'cat_' || lower(hex(randomblob(12))), code, color, created_at, created_at
    FROM courses;
UPDATE courses SET category_id =
    (SELECT id FROM categories WHERE categories.name = courses.code);
UPDATE tasks SET category_id =
    (SELECT category_id FROM courses WHERE courses.id = tasks.course_id)
    WHERE course_id IS NOT NULL;
```

- [ ] **Step 2: Write `0013_search_web.sql`**

```sql
-- The builtin Research agent learns search_web (added to the tool catalog in
-- this release). One-time UPDATE: the TS seed is INSERT OR IGNORE, so
-- existing DBs never pick up seed changes. Scoped to is_builtin so a user
-- who renamed/duplicated it isn't touched.

UPDATE agents SET
    tools_json = '["search_web","fetch_url"]',
    description = 'Searches the web and reads pages. Use for anything that needs current outside information — news, docs, prices, or a specific URL.'
    WHERE id = 'agt_research' AND is_builtin = 1;
```

- [ ] **Step 3: Register both migrations in `src-tauri/src/lib.rs`**

Append inside `migrations()`, after the `version: 11` entry:

```rust
        Migration {
            version: 12,
            description: "categories + chat metadata + messages_fts",
            sql: include_str!("../migrations/0012_categories.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "research agent gains search_web",
            sql: include_str!("../migrations/0013_search_web.sql"),
            kind: MigrationKind::Up,
        },
```

- [ ] **Step 4: Run the suite to prove the migrations apply on the test client**

Run: `npm test`
Expected: PASS (db.test.ts applies the migrations directory; a SQL syntax error fails here).

- [ ] **Step 5: Mirror in `src/lib/schemas.ts`**

Add after `permissionGrantSchema` (order doesn't matter, keep it near the top-level entities):

```ts
export const categorySchema = z.object({
    id: z.string(),
    name: z.string(),
    color: z.string().nullable(),
    created_at: z.number(),
    updated_at: z.number(),
});
export type Category = z.infer<typeof categorySchema>;
```

Add `category_id: z.string().nullable(),` to `projectSchema`, `taskSchema`, `noteSchema`, `chatSessionSchema`, and `courseSchema`.

Add to `chatSessionSchema`:

```ts
    auto_summary: z.string().nullable(),
    auto_tags_json: z.string(),
```

Add next to `presetAgents`:

```ts
/** Model-generated tags on a chat session; [] when malformed or unset. */
export function sessionTags(session: ChatSession): string[] {
    try {
        return z.array(z.string()).parse(JSON.parse(session.auto_tags_json));
    } catch {
        return [];
    }
}
```

- [ ] **Step 6: Gates + commit**

Run: `npm run typecheck && npm test`
Expected: PASS.

```bash
git add src-tauri/migrations/0012_categories.sql src-tauri/migrations/0013_search_web.sql src-tauri/src/lib.rs src/lib/schemas.ts
git commit -m "feat: categories schema, chat metadata columns, messages FTS"
```

---

### Task 2: Data layer — categories repo, repo extensions, FTS write path

**Files:**
- Create: `src/db/repo/categories.ts`
- Create: `src/db/repo/categories.test.ts`
- Create: `src/lib/categories.ts`
- Modify: `src/db/repo/sessions.ts` (listSessions filter, setSessionCategory, setSessionMeta, deleteSession FTS cleanup)
- Modify: `src/db/repo/tasks.ts` (categoryId in TaskInput + listOpenTasks filter)
- Modify: `src/db/repo/notes.ts` (categoryId + listNotes filter object)
- Modify: `src/ai/tools/notes.ts` (adapt to the new listNotes signature)
- Modify: `src/db/repo/projects.ts` (categoryId + listProjects filter)
- Modify: `src/db/repo/courses.ts` (createCourse auto-links a same-named category)
- Modify: `src/db/repo/messages.ts` (extractTextParts, FTS insert, searchSessionIds)
- Create: `src/db/repo/messages.test.ts`
- Modify: `src/app/bootstrap.ts` (one-time messages_fts backfill)

**Interfaces:**
- Consumes: `categorySchema`, `sessionTags` from Task 1; `toFtsQuery` from `src/db/repo/documents.ts`.
- Produces (exact signatures later tasks call):
  - `createCategory(input: { name: string; color?: string | null }): Promise<Category>`
  - `getCategory(id: string): Promise<Category>` / `listCategories(): Promise<Category[]>`
  - `updateCategory(id, input: { name?: string; color?: string | null }): Promise<Category>`
  - `deleteCategory(id: string): Promise<void>` (detaches, never deletes content)
  - `categoryCounts(id: string): Promise<{ projects: number; sessions: number; tasks: number; notes: number }>`
  - `sessionsRepo.listSessions(filter?: { projectId?: string; categoryId?: string })`
  - `sessionsRepo.setSessionCategory(id, categoryId: string | null)`
  - `sessionsRepo.setSessionMeta(id, meta: { summary: string | null; tags: string[] })`
  - `tasksRepo.TaskInput` gains `categoryId?: string | null`; `listOpenTasks(opts?: { dueBefore?: number; categoryId?: string })`
  - `notesRepo.createNote/updateNote` accept `categoryId`; `listNotes(filter?: { folder?: string; categoryId?: string })`
  - `projectsRepo.createProject` gains `categoryId?: string | null`; `listProjects(filter?: { categoryId?: string })`; `setProjectCategory(id, categoryId | null)`
  - `messagesRepo.extractTextParts(partsJson: string): string`; `searchSessionIds(query: string): Promise<string[]>`
  - `effectiveCategoryId(session, projectById: Map<string, Project>): string | null` from `src/lib/categories.ts`

- [ ] **Step 1: Write failing tests — `src/db/repo/categories.test.ts`**

```ts
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import {
    categoryCounts,
    createCategory,
    deleteCategory,
    getCategory,
    listCategories,
    updateCategory,
} from "./categories";
import { createProject, getProject, listProjects } from "./projects";
import { createSession, getSession, listSessions, setSessionCategory } from "./sessions";
import { createTask, listOpenTasks } from "./tasks";
import { createNote, getNote, listNotes } from "./notes";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

describe("categories repo", () => {
    it("creates, lists, updates", async () => {
        const c = await createCategory({ name: "School", color: "#4ade80" });
        expect(c.name).toBe("School");
        expect((await listCategories()).map((x) => x.id)).toEqual([c.id]);
        const u = await updateCategory(c.id, { color: "#f87171" });
        expect(u.color).toBe("#f87171");
        expect(u.name).toBe("School");
        await expect(createCategory({ name: " " })).rejects.toThrow(/name/);
        await expect(getCategory("cat_missing")).rejects.toThrow(/not found/);
    });

    it("attaches everywhere, counts, and detaches on delete", async () => {
        const c = await createCategory({ name: "Career" });
        const p = await createProject({ name: "Job hunt", categoryId: c.id });
        const s = await createSession({ title: "resume", categoryId: c.id });
        const viaProject = await createSession({ title: "cover", projectId: p.id });
        await createTask({ title: "apply", categoryId: c.id });
        const n = await createNote({ title: "targets", categoryId: c.id });

        // A project-filed chat counts toward the project's category.
        expect(await categoryCounts(c.id)).toEqual({
            projects: 1,
            sessions: 2,
            tasks: 1,
            notes: 1,
        });
        expect((await listSessions({ categoryId: c.id })).map((x) => x.id).sort())
            .toEqual([s.id, viaProject.id].sort());
        expect((await listProjects({ categoryId: c.id })).map((x) => x.id)).toEqual([p.id]);
        expect((await listOpenTasks({ categoryId: c.id }))).toHaveLength(1);
        expect((await listNotes({ categoryId: c.id })).map((x) => x.id)).toEqual([n.id]);

        await deleteCategory(c.id);
        expect(await listCategories()).toEqual([]);
        expect((await getProject(p.id)).category_id).toBeNull();
        expect((await getSession(s.id)).category_id).toBeNull();
        expect((await getNote(n.id)).category_id).toBeNull();
    });

    it("recategorizes a session", async () => {
        const c = await createCategory({ name: "X" });
        const s = await createSession({ title: "a" });
        await setSessionCategory(s.id, c.id);
        expect((await getSession(s.id)).category_id).toBe(c.id);
        await setSessionCategory(s.id, null);
        expect((await getSession(s.id)).category_id).toBeNull();
    });
});
```

- [ ] **Step 2: Write failing tests — `src/db/repo/messages.test.ts`**

```ts
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { createSession, deleteSession } from "./sessions";
import { extractTextParts, insertMessage, searchSessionIds } from "./messages";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

const parts = (text: string) => JSON.stringify([{ type: "text", text }]);

describe("message search", () => {
    it("extracts only text parts", () => {
        expect(
            extractTextParts(
                JSON.stringify([
                    { type: "text", text: "hello" },
                    { type: "tool-fetch_url", input: { url: "https://x.dev" } },
                    { type: "text", text: "world" },
                ]),
            ),
        ).toBe("hello\nworld");
        expect(extractTextParts("not json")).toBe("");
    });

    it("indexes on insert and searches by session", async () => {
        const a = await createSession({ title: "a" });
        const b = await createSession({ title: "b" });
        await insertMessage({ sessionId: a.id, role: "user", partsJson: parts("quantum flapjacks") });
        await insertMessage({ sessionId: b.id, role: "user", partsJson: parts("regular pancakes") });

        expect(await searchSessionIds("flapjacks")).toEqual([a.id]);
        expect(await searchSessionIds("pancakes OR flapjacks; DROP")).toContain(b.id);
    });

    it("drops the index rows with the session", async () => {
        const s = await createSession({ title: "gone" });
        await insertMessage({ sessionId: s.id, role: "user", partsJson: parts("ephemeral walrus") });
        await deleteSession(s.id);
        expect(await searchSessionIds("walrus")).toEqual([]);
    });
});
```

- [ ] **Step 3: Run both to verify they fail**

Run: `npx vitest run src/db/repo/categories.test.ts src/db/repo/messages.test.ts`
Expected: FAIL — `./categories` doesn't exist; `extractTextParts`/`searchSessionIds` not exported.

- [ ] **Step 4: Create `src/db/repo/categories.ts`**

```ts
import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { categorySchema, type Category } from "@/lib/schemas";

export async function createCategory(input: {
    name: string;
    color?: string | null;
}): Promise<Category> {
    const name = input.name.trim();
    if (!name) throw new Error("category needs a name");
    const id = newId("cat");
    const t = now();
    await getDb().execute(
        `INSERT INTO categories (id, name, color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, name, input.color ?? null, t, t],
    );
    return getCategory(id);
}

export async function getCategory(id: string): Promise<Category> {
    const rows = await getDb().select("SELECT * FROM categories WHERE id = ?", [id]);
    if (!rows[0]) throw new Error(`category not found: ${id}`);
    return categorySchema.parse(rows[0]);
}

export async function listCategories(): Promise<Category[]> {
    const rows = await getDb().select("SELECT * FROM categories ORDER BY name ASC");
    return rows.map((r) => categorySchema.parse(r));
}

export async function updateCategory(
    id: string,
    input: { name?: string; color?: string | null },
): Promise<Category> {
    const cur = await getCategory(id);
    await getDb().execute(
        "UPDATE categories SET name = ?, color = ?, updated_at = ? WHERE id = ?",
        [
            input.name?.trim() || cur.name,
            input.color === undefined ? cur.color : input.color,
            now(),
            id,
        ],
    );
    return getCategory(id);
}

/**
 * Detaches everything tagged with the category, then removes it. Explicit
 * UPDATEs (not FK cascades) so tauri, wasm, and better-sqlite3 clients
 * behave the same. Content is never deleted.
 */
export async function deleteCategory(id: string): Promise<void> {
    const db = getDb();
    for (const table of ["projects", "tasks", "notes", "chat_sessions", "courses"]) {
        await db.execute(
            `UPDATE ${table} SET category_id = NULL WHERE category_id = ?`,
            [id],
        );
    }
    await db.execute("DELETE FROM categories WHERE id = ?", [id]);
}

export interface CategoryCounts {
    projects: number;
    sessions: number;
    tasks: number;
    notes: number;
}

/** Session count includes chats filed under the category's projects. */
export async function categoryCounts(id: string): Promise<CategoryCounts> {
    const rows = await getDb().select<CategoryCounts>(
        `SELECT
            (SELECT COUNT(*) FROM projects WHERE category_id = ?) AS projects,
            (SELECT COUNT(*) FROM chat_sessions WHERE category_id = ?
                OR project_id IN (SELECT id FROM projects WHERE category_id = ?)) AS sessions,
            (SELECT COUNT(*) FROM tasks WHERE category_id = ? AND completed_at IS NULL) AS tasks,
            (SELECT COUNT(*) FROM notes WHERE category_id = ?) AS notes`,
        [id, id, id, id, id],
    );
    if (!rows[0]) throw new Error(`counts query returned no row for ${id}`);
    return rows[0];
}
```

- [ ] **Step 5: Create `src/lib/categories.ts`**

```ts
import type { ChatSession, Project } from "./schemas";

/**
 * A chat's category: its own tag wins, else it inherits from its project.
 * Single source of truth for the sidebar filter and the network builder.
 */
export function effectiveCategoryId(
    session: ChatSession,
    projectById: Map<string, Project>,
): string | null {
    if (session.category_id) return session.category_id;
    if (session.project_id)
        return projectById.get(session.project_id)?.category_id ?? null;
    return null;
}
```

- [ ] **Step 6: Extend `src/db/repo/sessions.ts`**

`createSession` opts gain `categoryId?: string | null`; add `category_id` to the INSERT column list with `opts.categoryId ?? null` (the INSERT currently names 7 columns — make it 8).

Replace `listSessions` with:

```ts
export async function listSessions(filter?: {
    projectId?: string;
    categoryId?: string;
}): Promise<ChatSession[]> {
    let rows;
    if (filter?.projectId) {
        rows = await getDb().select(
            "SELECT * FROM chat_sessions WHERE project_id = ? ORDER BY updated_at DESC",
            [filter.projectId],
        );
    } else if (filter?.categoryId) {
        rows = await getDb().select(
            `SELECT * FROM chat_sessions
             WHERE category_id = ?
                OR project_id IN (SELECT id FROM projects WHERE category_id = ?)
             ORDER BY updated_at DESC`,
            [filter.categoryId, filter.categoryId],
        );
    } else {
        rows = await getDb().select(
            "SELECT * FROM chat_sessions ORDER BY updated_at DESC",
        );
    }
    return rows.map((r) => chatSessionSchema.parse(r));
}
```

Add:

```ts
export async function setSessionCategory(
    id: string,
    categoryId: string | null,
): Promise<void> {
    await getDb().execute(
        "UPDATE chat_sessions SET category_id = ?, updated_at = ? WHERE id = ?",
        [categoryId, now(), id],
    );
}

/** Model-generated metadata. Does not touch updated_at — metadata isn't activity. */
export async function setSessionMeta(
    id: string,
    meta: { summary: string | null; tags: string[] },
): Promise<void> {
    await getDb().execute(
        "UPDATE chat_sessions SET auto_summary = ?, auto_tags_json = ? WHERE id = ?",
        [meta.summary, JSON.stringify(meta.tags), id],
    );
}
```

Extend `deleteSession` (messages cascade via FK, but `messages_fts` is standalone):

```ts
export async function deleteSession(id: string): Promise<void> {
    await getDb().execute("DELETE FROM messages_fts WHERE session_id = ?", [id]);
    await getDb().execute("DELETE FROM chat_messages WHERE session_id = ?", [id]);
    await getDb().execute("DELETE FROM chat_sessions WHERE id = ?", [id]);
}
```

- [ ] **Step 7: Extend `src/db/repo/messages.ts`**

Add at the bottom, and call from `insertMessage` (after the INSERT, before `return id`):

```ts
/** Concatenated text parts of a parts_json array; "" when malformed. */
export function extractTextParts(partsJson: string): string {
    try {
        const parts = JSON.parse(partsJson) as Array<{
            type?: string;
            text?: string;
        }>;
        return parts
            .filter((p) => p.type === "text" && typeof p.text === "string")
            .map((p) => p.text)
            .join("\n");
    } catch {
        return "";
    }
}

/** Session ids with any message matching the query, newest activity first. */
export async function searchSessionIds(query: string): Promise<string[]> {
    const fts = toFtsQuery(query);
    if (!fts) return [];
    const rows = await getDb().select<{ session_id: string }>(
        "SELECT DISTINCT session_id FROM messages_fts WHERE messages_fts MATCH ?",
        [fts],
    );
    return rows.map((r) => r.session_id);
}
```

Import `toFtsQuery` from `./documents`. In `insertMessage`:

```ts
    const content = extractTextParts(opts.partsJson);
    if (content) {
        await getDb().execute(
            "INSERT INTO messages_fts (message_id, session_id, content) VALUES (?, ?, ?)",
            [id, opts.sessionId, content],
        );
    }
```

- [ ] **Step 8: Extend tasks, notes, projects, courses repos**

`tasks.ts` — `TaskInput` gains `categoryId?: string | null`; `createTask`/`updateTask` write `category_id` (add the column to both statements with `input.categoryId ?? null`); `completeTask`'s recurrence respawn passes `categoryId: task.category_id`. Replace `listOpenTasks`:

```ts
export async function listOpenTasks(
    opts: { dueBefore?: number; categoryId?: string } = {},
): Promise<Task[]> {
    const where = ["completed_at IS NULL"];
    const params: unknown[] = [];
    if (opts.dueBefore !== undefined) {
        where.push("due_at IS NOT NULL AND due_at <= ?");
        params.push(opts.dueBefore);
    }
    if (opts.categoryId !== undefined) {
        where.push("category_id = ?");
        params.push(opts.categoryId);
    }
    const rows = await getDb().select(
        `SELECT * FROM tasks WHERE ${where.join(" AND ")}
         ORDER BY due_at IS NULL, due_at ASC, created_at ASC`,
        params,
    );
    return rows.map((r) => taskSchema.parse(r));
}
```

`notes.ts` — `createNote`/`updateNote` opts gain `categoryId?: string | null` (write the column). Replace `listNotes(folder?)` with:

```ts
export async function listNotes(filter?: {
    folder?: string;
    categoryId?: string;
}): Promise<NoteSummary[]> {
    const sql =
        "SELECT id, title, folder, category_id, created_at, updated_at FROM notes";
    const where: string[] = [];
    const params: unknown[] = [];
    const normalized = filter?.folder ? normalizeFolder(filter.folder) : null;
    if (normalized !== null && normalized !== "/") {
        where.push("(folder = ? OR folder LIKE ?)");
        params.push(normalized, `${normalized}/%`);
    }
    if (filter?.categoryId !== undefined) {
        where.push("category_id = ?");
        params.push(filter.categoryId);
    }
    const rows = await getDb().select(
        `${sql}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY updated_at DESC`,
        params,
    );
    return rows.map((r) => noteSchema.omit({ body_md: true }).parse(r));
}
```

Update the one call site in `src/ai/tools/notes.ts` from `listNotes(folder)` to `listNotes(folder ? { folder } : undefined)` (grep for `listNotes(` to catch all).

`projects.ts` — `createProject` gains `categoryId?: string | null` (write the column); add `setProjectCategory(id, categoryId | null)` (same shape as `setSessionCategory`); `listProjects(filter?: { categoryId?: string })` adds `WHERE category_id = ?` when given.

`courses.ts` — at the end of `createCourse`, auto-link a same-named category so new courses keep behaving like task categories:

```ts
    // A course is also a category (migration 0012 did this for existing rows).
    await getDb().execute(
        `INSERT OR IGNORE INTO categories (id, name, color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [newId("cat"), input.code, input.color ?? null, t, t],
    );
    await getDb().execute(
        "UPDATE courses SET category_id = (SELECT id FROM categories WHERE name = ?) WHERE id = ?",
        [input.code, id],
    );
```

(Reuse the `t` timestamp already in scope; if `createCourse` names it differently, match the file.)

- [ ] **Step 9: Backfill in `src/app/bootstrap.ts`**

In `runBootstrap`, after the seed calls and before the backup import:

```ts
    // One-time backfill: messages written before migration 0012 have no FTS
    // rows. Cheap no-op on every later boot (count returns > 0).
    const ftsRows = await db.select<{ n: number }>(
        "SELECT COUNT(*) AS n FROM messages_fts",
    );
    if ((ftsRows[0]?.n ?? 0) === 0) {
        const msgs = await db.select<{
            id: string;
            session_id: string;
            parts_json: string;
        }>("SELECT id, session_id, parts_json FROM chat_messages");
        for (const m of msgs) {
            const content = extractTextParts(m.parts_json);
            if (content)
                await db.execute(
                    "INSERT INTO messages_fts (message_id, session_id, content) VALUES (?, ?, ?)",
                    [m.id, m.session_id, content],
                );
        }
    }
```

Import `extractTextParts` from `@/db/repo/messages`.

- [ ] **Step 10: Run the new tests, then the full gates**

Run: `npx vitest run src/db/repo/categories.test.ts src/db/repo/messages.test.ts`
Expected: PASS.
Run: `npm run typecheck && npm test`
Expected: PASS (existing `listNotes`/`listOpenTasks` callers still compile — the new signatures accept no-arg calls).

- [ ] **Step 11: Commit**

```bash
git add src/db/repo src/lib/categories.ts src/app/bootstrap.ts src/ai/tools/notes.ts
git commit -m "feat: categories data layer + chat message FTS write path"
```

---

### Task 3: Categories section — nav rename, CategoriesPage, CategoryDetail

The Projects nav item becomes **Categories**. The top level lists category cards (+ create) and any uncategorized projects; opening a category shows Projects | Chats | Tasks | Notes tabs, all pre-filtered. `ProjectDetail` is unchanged and opens from the Projects tab.

**Files:**
- Modify: `src/app/Sidebar.tsx` (Page union + nav item)
- Modify: `src/app/Shell.tsx` (routing)
- Modify: `src/components/palette/CommandPalette.tsx` (NAV entry)
- Create: `src/app/categories/CategoriesPage.tsx`
- Create: `src/app/categories/CategoryDetail.tsx`
- Delete: `src/app/projects/ProjectsPage.tsx`
- Keep: `src/app/projects/ProjectDetail.tsx` (imported by CategoryDetail)

**Interfaces:**
- Consumes: `categories` repo (Task 2), `listProjects({ categoryId })`, `listSessions({ categoryId })`, `listOpenTasks({ categoryId })`, `listNotes({ categoryId })`, `ProjectDetail` props `{ project, onBack, onChanged, onOpenChat }`.
- Produces: `Page` union member `"categories"` (replaces `"projects"`); `CategoriesPage({ onNavigate })`.

- [ ] **Step 1: Rename the page id**

`Sidebar.tsx`: in the `Page` union replace `| "projects"` with `| "categories"`; in `SECTIONS` replace the item with `{ page: "categories", label: "Categories", icon: Tags }` (import `Tags` from `lucide-react`, drop `FolderKanban`).

`Shell.tsx`: replace the `projects` entry in `PAGES` with `categories: () => <></>,`, swap the import to `CategoriesPage` from `./categories/CategoriesPage`, and change the special case to:

```tsx
                            ) : nav.page === "categories" ? (
                                <CategoriesPage onNavigate={setNav} />
```

`CommandPalette.tsx`: change the NAV entry to `{ target: { page: "categories" }, label: "Categories" },`.

- [ ] **Step 2: Create `src/app/categories/CategoriesPage.tsx`**

```tsx
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
}: {
    onNavigate: (t: NavTarget) => void;
}) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [counts, setCounts] = useState<Record<string, categoriesRepo.CategoryCounts>>({});
    const [looseProjects, setLooseProjects] = useState<Project[]>([]);
    const [openId, setOpenId] = useState<string | null>(null);
    const [openProjectId, setOpenProjectId] = useState<string | null>(null);
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

    const openProject = openProjectId
        ? looseProjects.find((p) => p.id === openProjectId)
        : undefined;
    if (openProject) {
        return (
            <ProjectDetail
                key={openProject.id}
                project={openProject}
                onBack={() => setOpenProjectId(null)}
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
                                    onClick={() => setOpenProjectId(p.id)}
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
```

- [ ] **Step 3: Create `src/app/categories/CategoryDetail.tsx`**

```tsx
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
                                    ).then(onBack)
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
                    <div className="flex flex-col gap-1.5">
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
```

- [ ] **Step 4: Delete `src/app/projects/ProjectsPage.tsx` and fix stragglers**

Run: `grep -rn "ProjectsPage" src/` — expect only Shell (already fixed). Delete the file.

- [ ] **Step 5: Gates + manual check + commit**

Run: `npm run typecheck && npm test`
Expected: PASS.
Manual (`npm run dev`, human pass): Categories nav item shows the new page; create a category → detail tabs render; create a project inside it; delete category leaves the project uncategorized on the top page.

```bash
git add -A src/app src/components/palette
git commit -m "feat: categories section — nav, cards page, detail tabs"
```

---

### Task 4: Tasks tab — categories replace courses in the UI

The Course select in QuickAdd becomes a Category select (with an inline "new…" creator); the filter chips and row badges read categories. `course_id` stays in the DB — migration 0012 already copied course assignments to categories.

**Files:**
- Modify: `src/app/planner/TasksTab.tsx`

**Interfaces:**
- Consumes: `listCategories`, `createCategory`, `TaskInput.categoryId`, `FilterChips`.
- Produces: no new exports.

- [ ] **Step 1: Rewrite the state + filter plumbing in `TasksTab`**

Replace the `courses` state/imports with categories:

```tsx
import * as categoriesRepo from "@/db/repo/categories";
import type { Category, Task } from "@/lib/schemas";
```

```tsx
    const [categories, setCategories] = useState<Category[]>([]);
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setTasks(await tasksRepo.listOpenTasks());
        setCategories(await categoriesRepo.listCategories());
    }, []);
```

Keep the existing stale-filter fallback effect but check `categories`/`categoryFilter`. FilterChips options become `categories.map((c) => ({ id: c.id, label: c.name, color: c.color ?? undefined }))`; the TaskList filter becomes `tasks.filter((t) => t.category_id === categoryFilter)`.

- [ ] **Step 2: Category picker with inline create in `QuickAdd`**

Replace the Course `<Select>` block with (the `"__new"` sentinel swaps the select for an input):

```tsx
            <label className="flex w-36 flex-col gap-1 text-sm">
                Category
                {creating ? (
                    <Input
                        autoFocus
                        value={newCategory}
                        placeholder="name…"
                        onChange={(e) => setNewCategory(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && newCategory.trim())
                                void onCreateCategory(newCategory).then((id) => {
                                    setCategoryId(id);
                                    setCreating(false);
                                    setNewCategory("");
                                });
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
```

`QuickAdd` props become `{ categories, onAdd, onCreateCategory }` with local state `categoryId`, `creating`, `newCategory`; `submit()` passes `categoryId: categoryId || null`. In `TasksTab`:

```tsx
            <QuickAdd
                categories={categories}
                onAdd={(input) => act(() => tasksRepo.createTask(input))}
                onCreateCategory={async (name) => {
                    const c = await categoriesRepo.createCategory({ name });
                    await reload();
                    return c.id;
                }}
            />
```

- [ ] **Step 3: Row badges show the category (colored)**

In `TaskList`, replace the `courseCode` badge with:

```tsx
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
```

where `TaskList` receives `categories` and `const categoryOf = (id: string | null) => categories.find((c) => c.id === id);`.

- [ ] **Step 4: Gates + commit**

Run: `npm run typecheck && npm test`
Expected: PASS.
Manual: add a task with a fresh category via "+ new category…", filter by it, complete it.

```bash
git add src/app/planner/TasksTab.tsx
git commit -m "feat: tasks pick and filter by category, courses leave the tasks UI"
```

---

### Task 5: Calendar-first Planner — 7d/14d/month views, everything scheduled, category filter

The Planner opens on Calendar. A new pure-ish module gathers every time-shaped thing — course events, due tasks, enabled automations' next runs, application follow-ups — into one `CalendarItem` list; the tab renders it as a day-list (7/14 days) or a month grid, filterable by category.

**Files:**
- Create: `src/app/planner/calendarItems.ts`
- Create: `src/app/planner/calendarItems.test.ts`
- Modify: `src/app/planner/CalendarTab.tsx` (full rewrite of the top half; CoursesPanel stays)
- Modify: `src/app/planner/PlannerPage.tsx` (calendar first + default)

**Interfaces:**
- Consumes: `listEventsBetween`, `listOpenTasks`, `listAutomations` (from `@/db/repo/automations`), `listApplications` (from `@/db/repo/applications`), `listCourses`, `listCategories`, `FilterChips`.
- Produces: `interface CalendarItem { id: string; kind: "event" | "task" | "automation" | "application"; title: string; at: number; endAt: number | null; color: string; categoryId: string | null; detail: string | null }` and `collectCalendarItems(from: number, to: number): Promise<CalendarItem[]>`.

- [ ] **Step 1: Failing test — `src/app/planner/calendarItems.test.ts`**

```ts
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { insertEvent } from "@/db/repo/events";
import { createTask } from "@/db/repo/tasks";
import { createCategory } from "@/db/repo/categories";
import { createApplication, updateApplication } from "@/db/repo/applications";
import { collectCalendarItems } from "./calendarItems";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

const DAY = 86_400_000;

describe("collectCalendarItems", () => {
    it("merges events, due tasks, and follow-ups, sorted by time", async () => {
        const t0 = Date.now();
        const cat = await createCategory({ name: "School", color: "#4ade80" });
        await insertEvent({ title: "Lecture", startsAt: t0 + 2 * DAY, endsAt: t0 + 2 * DAY + 3_600_000 });
        await createTask({ title: "PSet", dueAt: t0 + DAY, categoryId: cat.id });
        const app = await createApplication({ company: "ACME", role: "SWE" });
        await updateApplication(app.id, {
            company: "ACME",
            role: "SWE",
            nextAction: "follow up",
            nextActionAt: t0 + 3 * DAY,
        });

        const items = await collectCalendarItems(t0, t0 + 7 * DAY);
        expect(items.map((i) => i.kind)).toEqual(["task", "event", "application"]);
        expect(items[0]!.categoryId).toBe(cat.id);
        expect(items[0]!.color).toBe("#4ade80");
    });

    it("excludes completed tasks and out-of-range items", async () => {
        const t0 = Date.now();
        await createTask({ title: "far away", dueAt: t0 + 40 * DAY });
        const items = await collectCalendarItems(t0, t0 + 7 * DAY);
        expect(items).toEqual([]);
    });
});
```

(Signature verified against `src/db/repo/applications.ts:29` — `updateApplication` requires `company` and `role` on every call.)

- [ ] **Step 2: Verify it fails**

Run: `npx vitest run src/app/planner/calendarItems.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/app/planner/calendarItems.ts`**

```ts
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
        });
    }
    return items.sort((a, b) => a.at - b.at);
}
```

(Verified: `listAutomations()` accepts no arguments — `src/db/repo/automations.ts:114`.)

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/app/planner/calendarItems.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite `CalendarTab.tsx`'s top half**

Keep `CoursesPanel` and the `act` helper exactly as they are. Replace `WeekEvents` and the `CalendarTab` body:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Upload, Trash2 } from "lucide-react";
import * as coursesRepo from "@/db/repo/courses";
import * as categoriesRepo from "@/db/repo/categories";
import { importClassSchedule } from "@/lib/ics";
import { collectCalendarItems, type CalendarItem } from "./calendarItems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterChips } from "@/components/ui/filterChips";
import { cn } from "@/lib/utils";
import type { Category, Course } from "@/lib/schemas";

const DAY = 86_400_000;
type ViewMode = "7d" | "14d" | "month";

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
    return { from, to: from + (mode === "7d" ? 7 : 14) * DAY };
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

    const step = mode === "month" ? 30 * DAY : (mode === "7d" ? 7 : 14) * DAY;

    return (
        <div className="flex flex-col gap-4">
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-md border border-border">
                    {(["7d", "14d", "month"] as const).map((m) => (
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
                            {m === "month" ? "1 month" : `${m.slice(0, -1)} days`}
                        </button>
                    ))}
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Earlier"
                    onClick={() => setAnchor((a) => a - step)}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Later"
                    onClick={() => setAnchor((a) => a + step)}
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
            {mode === "month" ? (
                <MonthGrid from={from} items={visible} anchor={anchor} />
            ) : (
                <DayList from={from} days={mode === "7d" ? 7 : 14} items={visible} />
            )}
            <CoursesPanel courses={courses} act={act} reload={reload} />
        </div>
    );
}

function ItemChip({ item, showTime }: { item: CalendarItem; showTime: boolean }) {
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
        </div>
    );
}

function DayList({
    from,
    days,
    items,
}: {
    from: number;
    days: number;
    items: CalendarItem[];
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
                                    <ItemChip key={x.id} item={x} showTime />
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
```

Delete the old `WeekEvents` component and unused imports (`listEventsBetween`, `CalendarEvent`).

- [ ] **Step 6: Calendar becomes the Planner's front door**

In `PlannerPage.tsx`: reorder `TABS` to Calendar, Tasks, Applications (Review is removed in Task 6 — leave it last for now) and change the default:

```tsx
const TABS: { id: PlannerTab; label: string }[] = [
    { id: "calendar", label: "Calendar" },
    { id: "tasks", label: "Tasks" },
    { id: "applications", label: "Applications" },
    { id: "review", label: "Review" },
];
```

```tsx
    const [active, setActive] = useState<PlannerTab>(isTab(tab) ? tab : "calendar");
```

Also widen the calendar container: change the content div's class ternary to `active === "applications" || active === "calendar" ? "max-w-6xl" : "max-w-3xl"`.

- [ ] **Step 7: Gates + commit**

Run: `npm run typecheck && npm test`
Expected: PASS.
Manual: Planner opens on Calendar; 7d/14d/month switch; a due task, a course event, and an application follow-up all render; category chips filter them; arrows page through time.

```bash
git add src/app/planner
git commit -m "feat: calendar-first planner with 7d/14d/month views and unified schedule"
```

---

### Task 6: Review moves into Notes; notes get categories + "make flashcards"

The Review tab is a working SM2 flashcard reviewer — its problem is placement and framing, not function. It moves to Notes (where cards come from), gets purpose copy, and notes gain the category tagging + filtering everything else has. A per-note "make flashcards" button closes the loop the user sensed: review ↔ notes.

**Files:**
- Move: `src/app/planner/ReviewTab.tsx` → `src/app/notes/ReviewTab.tsx`
- Modify: `src/app/planner/PlannerPage.tsx` (drop the review tab)
- Modify: `src/app/notes/NotesPage.tsx` (host Review; category select + filter; flashcard button)
- Create: `src/ai/notes/flashcardGen.ts`
- Modify: `src/components/palette/CommandPalette.tsx` (review target → notes)

**Interfaces:**
- Consumes: `buildToolSet` from `@/ai/tools/catalog`, `PermissionContext`, `createModel` from `@/ai/providers/registry`, `appFetch`, `useRuntime` settings, `generateText`/`stepCountIs` from `ai`.
- Produces: `generateFlashcardsFromNote(opts: { note: Note; settings: Settings; permissions: PermissionContext }): Promise<number>` (count of cards created).

- [ ] **Step 1: Move the file and rehome the tab**

```bash
git mv src/app/planner/ReviewTab.tsx src/app/notes/ReviewTab.tsx
```

`PlannerPage.tsx`: remove `review` from the `PlannerTab` union, `TABS`, the import, and the render branch.

`NotesPage.tsx`: add the tab:

```tsx
type NotesTab = "notes" | "review" | "bookmarks" | "snippets";
const TABS: { id: NotesTab; label: string }[] = [
    { id: "notes", label: "Notes" },
    { id: "review", label: "Review" },
    { id: "bookmarks", label: "Bookmarks" },
    { id: "snippets", label: "Snippets" },
];
```

(update `isTab` accordingly), import `ReviewTab` from `./ReviewTab`, and render it in the non-notes branch with this blurb above it:

```tsx
{active === "review" &&
    "Flashcards made from your notes, resurfaced on a spaced-repetition schedule. Grade honestly — the schedule adapts."}
```

`CommandPalette.tsx`: change the Review NAV entry to `{ target: { page: "notes", tab: "review" }, label: "Review flashcards" },`.

- [ ] **Step 2: Purpose copy inside `ReviewTab`**

In the empty-queue Card, replace the bare "Queue clear." paragraph with:

```tsx
                    <p className="text-sm text-muted-foreground">
                        Queue clear.{" "}
                        {reviewed > 0
                            ? `${reviewed} reviewed this session.`
                            : "No cards are due. Open a note and press “Make flashcards”, or ask an agent to make cards from your notes."}
                    </p>
```

- [ ] **Step 3: Create `src/ai/notes/flashcardGen.ts`**

```ts
import { generateText, stepCountIs } from "ai";
import { createModel, type ProviderId } from "@/ai/providers/registry";
import { appFetch } from "@/ai/providers/appFetch";
import { buildToolSet } from "@/ai/tools/catalog";
import type { PermissionContext } from "@/ai/tools/context";
import type { Settings } from "@/ai/providers/keys";
import type { Note } from "@/lib/schemas";

/**
 * One-shot agent call: read the note, emit create_flashcards tool calls.
 * The write goes through the permission gate like every other tool — the
 * caller renders ApprovalCards for the broker it passed in.
 * Returns how many create_flashcards calls executed.
 */
export async function generateFlashcardsFromNote(opts: {
    note: Note;
    settings: Settings;
    permissions: PermissionContext;
}): Promise<number> {
    const model = createModel(
        {
            provider: opts.settings.defaultProvider as ProviderId,
            modelId: opts.settings.defaultModel,
        },
        { settings: opts.settings, fetch: appFetch },
    );
    const tools = buildToolSet(["create_flashcards"], {
        permissions: opts.permissions,
        fetch: appFetch,
    });
    const result = await generateText({
        model,
        tools,
        stopWhen: stepCountIs(3),
        prompt: [
            "Create concise spaced-repetition flashcards from this note using",
            `the create_flashcards tool with folder "${opts.note.folder}".`,
            "Cover each distinct fact once; fronts are questions, backs are",
            "short answers. 3-10 cards depending on density. Do not answer in",
            "prose — only call the tool.",
            "",
            `# ${opts.note.title}`,
            opts.note.body_md,
        ].join("\n"),
    });
    return result.steps.flatMap((s) => s.toolCalls).length;
}
```

Check `createModel`'s actual signature in `src/ai/providers/registry.ts` and `Settings`'s field names in `src/ai/providers/keys.ts` before writing — match them exactly (the pattern above mirrors `ChatWorkspace.tsx`'s STT call).

- [ ] **Step 4: Wire the button + categories into `NotesPage.tsx`'s `NotesTabBody`**

Additions (follow the file's existing draft/save structure):

- State: `categories` (loaded via `categoriesRepo.listCategories()` in `reloadList`), `categoryFilter: string | null`, `permissions: PermissionContext | null`, `cardsMsg: string | null`.
- `reloadList` becomes `setNotes(await notesRepo.listNotes(categoryFilter ? { categoryId: categoryFilter } : undefined))` with `categoryFilter` in its dep array.
- A `FilterChips` row above the note list (same options mapping as Tasks).
- In the editor header (next to the folder input), a category `<Select>` bound to `draft.category_id`; persisting goes through the existing save path — extend the `updateNote` call with `categoryId: draft.category_id`.
- A "Make flashcards" button in the editor toolbar:

```tsx
                <Button
                    variant="outline"
                    size="sm"
                    disabled={!draft || permissions !== null}
                    onClick={() => {
                        if (!draft) return;
                        const perms = new PermissionContext();
                        setPermissions(perms);
                        setCardsMsg(null);
                        void generateFlashcardsFromNote({
                            note: draft,
                            settings,
                            permissions: perms,
                        })
                            .then((n) => setCardsMsg(`${n} card batch created — see Review.`))
                            .catch((e: unknown) =>
                                setCardsMsg(e instanceof Error ? e.message : String(e)),
                            )
                            .finally(() => {
                                perms.broker.denyAll();
                                setPermissions(null);
                            });
                    }}
                >
                    {permissions ? "Making cards…" : "Make flashcards"}
                </Button>
```

- Render `{permissions && <ApprovalCards broker={permissions.broker} />}` and `{cardsMsg && <p className="text-xs text-muted-foreground">{cardsMsg}</p>}` near the editor. Imports: `PermissionContext` from `@/ai/tools/context`, `ApprovalCards` from `@/components/chat/ApprovalCard`, `useRuntime` from `@/app/runtime`, `generateFlashcardsFromNote`, `FilterChips`, `categoriesRepo`, `Select`.

- [ ] **Step 5: Gates + commit**

Run: `npm run typecheck && npm test`
Expected: PASS.
Manual: Notes shows a Review tab that explains itself; a note can be tagged with a category and the list filters by it; "Make flashcards" pops an approval card, then cards appear in Review.

```bash
git add -A src/app/planner src/app/notes src/ai/notes src/components/palette
git commit -m "feat: review lives in notes; note categories; make-flashcards button"
```

---

### Task 7: Real web access — search_web tool + browser-target proxy

Two gaps made "the model can't access outside websites" true in practice: there is no *search* (only `fetch_url` with an exact URL), and on the browser dev target every cross-origin fetch dies on CORS. Fix both: a `search_web` tool on the free DuckDuckGo HTML endpoint, and a Vite dev/preview middleware that proxies web-tool fetches server-side. Desktop keeps using plugin-http directly (`https://*/*` is already whitelisted in `src-tauri/capabilities/default.json`).

**Files:**
- Modify: `vite.config.ts` (corsProxy plugin)
- Modify: `src/ai/providers/appFetch.ts` (`wrapWebFetch`)
- Modify: `src/ai/tools/web.ts` (search_web + parseDdgResults)
- Create: `src/ai/tools/web.test.ts`
- Modify: `src/ai/tools/catalog.ts` (entry + wrapped fetch for web tools)
- Modify: `src/db/repo/agents.ts` (Research seed for fresh DBs — existing DBs got migration 0013)

**Interfaces:**
- Consumes: nothing new.
- Produces: tool name `search_web` (input `{ query: string }`); `parseDdgResults(html: string, limit?: number): { title: string; url: string; snippet: string }[]`; `wrapWebFetch(fetchImpl): typeof fetch`.

- [ ] **Step 1: Failing test — `src/ai/tools/web.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseDdgResults } from "./web";

const FIXTURE = `
<div class="result results_links results_links_deep web-result">
  <h2 class="result__title">
    <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Ftauri.app%2Fblog%2F&amp;rut=abc">Tauri <b>2.0</b> Release</a>
  </h2>
  <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Ftauri.app%2Fblog%2F">Tiny, fast binaries for all platforms.</a>
</div>
<div class="result">
  <h2 class="result__title">
    <a rel="nofollow" class="result__a" href="https://example.com/direct">Direct link</a>
  </h2>
</div>`;

describe("parseDdgResults", () => {
    it("decodes uddg redirects, strips tags, keeps direct hrefs", () => {
        const results = parseDdgResults(FIXTURE);
        expect(results[0]).toEqual({
            title: "Tauri 2.0 Release",
            url: "https://tauri.app/blog/",
            snippet: "Tiny, fast binaries for all platforms.",
        });
        expect(results[1]!.url).toBe("https://example.com/direct");
    });

    it("caps at the limit and survives garbage", () => {
        expect(parseDdgResults("<html>nothing here</html>")).toEqual([]);
        expect(parseDdgResults(FIXTURE, 1)).toHaveLength(1);
    });
});
```

Run: `npx vitest run src/ai/tools/web.test.ts` — Expected: FAIL (`parseDdgResults` not exported).

- [ ] **Step 2: Implement in `src/ai/tools/web.ts`**

Add:

```ts
const searchInput = z.object({
    query: z.string().describe("What to search the web for"),
});

export const SEARCH_HOST = "html.duckduckgo.com";

/** One search result parsed out of DuckDuckGo's HTML endpoint. */
export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}

const RESULT_LINK_RE =
    /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
const SNIPPET_RE = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

function stripTags(html: string): string {
    return html
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

/** DDG links route through //duckduckgo.com/l/?uddg=<encoded target>. */
function resolveDdgHref(href: string): string {
    const m = /[?&]uddg=([^&"]+)/.exec(href);
    if (m) return decodeURIComponent(m[1]!);
    return href.startsWith("//") ? `https:${href}` : href;
}

export function parseDdgResults(html: string, limit = 8): SearchResult[] {
    const links = [...html.matchAll(RESULT_LINK_RE)];
    const snippets = [...html.matchAll(SNIPPET_RE)];
    return links.slice(0, limit).map((m, i) => ({
        title: stripTags(m[2]!),
        url: resolveDdgHref(m[1]!.replace(/&amp;/g, "&")),
        snippet: snippets[i] ? stripTags(snippets[i]![1]!) : "",
    }));
}
```

Register the scope resolver and the tool inside `createWebTools`:

```ts
export const webScopeResolvers: Record<string, ScopeResolver> = {
    fetch_url: (input) => urlScope((input as z.infer<typeof fetchInput>).url),
    search_web: () => ({
        access: "read",
        scopeType: "url_domain",
        scopeValue: SEARCH_HOST,
    }),
};
```

```ts
        search_web: tool({
            description:
                "Search the web and return result titles, URLs, and snippets. Follow up with fetch_url on the most promising results.",
            inputSchema: searchInput,
            execute: permissions.gated(
                "search_web",
                webScopeResolvers.search_web!,
                async ({ query }: z.infer<typeof searchInput>) => {
                    const res = await fetchImpl(
                        `https://${SEARCH_HOST}/html/?q=${encodeURIComponent(query)}`,
                        { headers: { accept: "text/html" } },
                    );
                    if (!res.ok)
                        return `Search failed: HTTP ${res.status} ${res.statusText}`;
                    const results = parseDdgResults(await res.text());
                    if (results.length === 0)
                        return "No results found. Try different keywords.";
                    return results
                        .map((r) => `- ${r.title}\n  ${r.url}\n  ${r.snippet}`)
                        .join("\n");
                },
            ),
        }),
```

- [ ] **Step 3: The browser-target proxy — `vite.config.ts`**

Add above `defineConfig` (Node's global `fetch` does the outbound call; same handler serves dev and preview):

```ts
import type { Plugin, Connect } from "vite";

// The browser target can't fetch cross-origin (CORS + this server's COEP
// header). Web tools route through /__proxy?url= instead; the dev server
// fetches server-side and replies same-origin. Desktop never hits this —
// plugin-http exits via Rust.
function corsProxy(): Plugin {
    const handler: Connect.NextHandleFunction = (req, res, next) => {
        const url = new URL(req.url ?? "", "http://localhost").searchParams.get("url");
        if (!url) return next();
        let target: URL;
        try {
            target = new URL(url);
        } catch {
            res.statusCode = 400;
            return res.end("invalid url");
        }
        if (target.protocol !== "http:" && target.protocol !== "https:") {
            res.statusCode = 400;
            return res.end("http(s) only");
        }
        void fetch(target, { headers: { accept: "text/html, text/plain, application/json" }, redirect: "follow" })
            .then(async (r) => {
                res.statusCode = r.status;
                res.setHeader("content-type", r.headers.get("content-type") ?? "text/plain");
                res.end(Buffer.from(await r.arrayBuffer()));
            })
            .catch((e: unknown) => {
                res.statusCode = 502;
                res.end(`proxy fetch failed: ${e instanceof Error ? e.message : String(e)}`);
            });
    };
    return {
        name: "cors-proxy",
        configureServer(server) {
            server.middlewares.use("/__proxy", handler);
        },
        configurePreviewServer(server) {
            server.middlewares.use("/__proxy", handler);
        },
    };
}
```

Add `corsProxy()` to the `plugins` array.

- [ ] **Step 4: Route web tools through it — `appFetch.ts` + `catalog.ts`**

Append to `src/ai/providers/appFetch.ts`:

```ts
/**
 * Fetch for *web tools* (arbitrary sites). Desktop: plugin-http, no CORS.
 * Browser: rewritten through the dev server's /__proxy middleware, because
 * arbitrary sites don't send CORS headers.
 */
export function wrapWebFetch(fetchImpl: typeof globalThis.fetch): typeof globalThis.fetch {
    if (isTauri()) return fetchImpl;
    return (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        return fetchImpl(`/__proxy?url=${encodeURIComponent(url)}`, init);
    };
}
```

In `src/ai/tools/catalog.ts`: import `wrapWebFetch` and change the web-tools spread to `...createWebTools(deps.permissions, wrapWebFetch(deps.fetch)),`. Add the catalog entry:

```ts
    { name: "search_web", label: "Search the web", access: "read", group: "web" },
```

- [ ] **Step 5: Fresh-DB seed — `src/db/repo/agents.ts`**

Update the Research seed (existing DBs were handled by migration 0013 — keep the two texts identical):

```ts
            description:
                "Searches the web and reads pages. Use for anything that needs current outside information — news, docs, prices, or a specific URL.",
            instructions: RESEARCH_INSTRUCTIONS,
            tools: ["search_web", "fetch_url"],
```

And extend `RESEARCH_INSTRUCTIONS` (keep the existing denial guidance) with a first line: `Start broad with search_web, then fetch_url the most promising results. Prefer primary sources.`

- [ ] **Step 6: Gates + commit**

Run: `npx vitest run src/ai/tools/web.test.ts` — Expected: PASS.
Run: `npm run typecheck && npm test` — Expected: PASS.
Manual: in `npm run dev`, a Research-preset chat asked "what's new in React this month?" produces a `search_web` approval card, then results, then `fetch_url` follow-ups — no CORS errors in the console.

```bash
git add vite.config.ts src/ai/providers/appFetch.ts src/ai/tools src/db/repo/agents.ts
git commit -m "feat: search_web tool + browser-target CORS proxy — agents reach the web"
```

---

### Task 8: Template tokens as inline pills — TemplateEditor

Kill the raw `{{input}}` look. A transparent textarea sits over a styled backdrop that renders the same text with tokens as colored pills (braces dimmed to near-invisible). Text metrics are identical because the backdrop renders the *same characters* — only colors/background differ — so the caret never drifts. Unknown tokens render red before the run can fail on them.

**Files:**
- Create: `src/app/agents/TemplateEditor.tsx`
- Modify: `src/app/agents/PipelinesTab.tsx` (steps use it)
- Modify: `src/app/agents/AutomationsTab.tsx` (input template uses it)

**Interfaces:**
- Consumes: `TemplateChips` (already exported from PipelinesTab).
- Produces: `TemplateEditor({ value, onChange, knownTokens, placeholder, rows? })` — `knownTokens: string[]` are bare names (`"input"`, `"prev"`, `"step1"`, `"date"`).

- [ ] **Step 1: Create `src/app/agents/TemplateEditor.tsx`**

```tsx
import { useRef } from "react";
import { cn } from "@/lib/utils";

const TOKEN_SPLIT = /(\{\{\s*[a-zA-Z0-9_]+\s*\}\})/g;
const TOKEN_NAME = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/;

/**
 * A textarea whose {{tokens}} read as inline pills. Overlay technique: the
 * textarea's text is transparent (caret stays visible) above a backdrop
 * rendering the identical characters with styling. Identical font, padding,
 * and wrapping keep the two in register; scroll is synced on every scroll
 * event. Unknown tokens show red — they throw at run time.
 */
export function TemplateEditor({
    value,
    onChange,
    knownTokens,
    placeholder,
    rows = 2,
    taRef,
}: {
    value: string;
    onChange: (v: string) => void;
    knownTokens: string[];
    placeholder?: string;
    rows?: number;
    /** Exposes the textarea for caret-position token insertion. */
    taRef?: (el: HTMLTextAreaElement | null) => void;
}) {
    const backdropRef = useRef<HTMLDivElement>(null);
    const known = new Set(knownTokens);

    const shared =
        "w-full whitespace-pre-wrap break-words rounded-md px-3 py-2 font-mono text-sm leading-relaxed";

    return (
        <div className="relative">
            <div
                ref={backdropRef}
                aria-hidden
                className={cn(
                    shared,
                    "pointer-events-none absolute inset-0 overflow-hidden border border-transparent text-foreground",
                )}
            >
                {value.split(TOKEN_SPLIT).map((seg, i) => {
                    const name = TOKEN_NAME.exec(seg)?.[1];
                    if (!name) return <span key={i}>{seg}</span>;
                    const ok = known.has(name);
                    return (
                        <span
                            key={i}
                            className={cn(
                                "rounded-sm",
                                ok
                                    ? "bg-primary/20 text-primary"
                                    : "bg-destructive/20 text-destructive",
                            )}
                        >
                            <span className="opacity-30">{"{{"}</span>
                            {seg.slice(2, -2)}
                            <span className="opacity-30">{"}}"}</span>
                        </span>
                    );
                })}
                {/* Trailing newline keeps backdrop height == textarea height. */}
                {"\n"}
            </div>
            <textarea
                ref={taRef}
                rows={rows}
                value={value}
                placeholder={placeholder}
                spellCheck={false}
                onChange={(e) => onChange(e.target.value)}
                onScroll={(e) => {
                    if (backdropRef.current)
                        backdropRef.current.scrollTop = e.currentTarget.scrollTop;
                }}
                className={cn(
                    shared,
                    "relative resize-y border border-border bg-transparent text-transparent placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring",
                )}
                style={{ caretColor: "var(--foreground)" }}
            />
        </div>
    );
}
```

Note: if the project's `Textarea` in `ui/input.tsx` applies different padding/font classes, copy *its* exact classes into `shared` so the swap is visually seamless.

- [ ] **Step 2: Use it in `PipelinesTab.tsx`**

Replace the step `<Textarea …>` with:

```tsx
                        <TemplateEditor
                            taRef={(el) => {
                                taRefs.current[i] = el;
                            }}
                            rows={2}
                            placeholder="What should this agent do? e.g. Summarize the key points of {{prev}}"
                            value={s.promptTemplate}
                            onChange={(v) => setStep(i, { promptTemplate: v })}
                            knownTokens={[
                                "input",
                                "date",
                                ...(i > 0 ? ["prev"] : []),
                                ...steps.slice(0, i).map((_, j) => `step${j + 1}`),
                            ]}
                        />
```

(`insertToken` keeps working — it drives the same textarea through `taRefs`.) Drop the now-unused `Textarea` import if nothing else uses it.

- [ ] **Step 3: Use it in `AutomationsTab.tsx`**

Find the input-template field (grep `input_template` / `inputTemplate`) and swap its textarea/input for `TemplateEditor` with `knownTokens={["date"]}` (automation inputs render before the run, where only `{{date}}` exists — confirm against `src/ai/automations/` template vars and match).

- [ ] **Step 4: Gates + commit**

Run: `npm run typecheck && npm test` — Expected: PASS.
Manual: tokens render as pills while typing; caret/selection align at every wrap; a typo'd `{{stepp1}}` shows red; insert chips still land at the caret.

```bash
git add src/app/agents
git commit -m "feat: template tokens render as inline pills in pipeline/automation editors"
```

---

### Task 9: Pipelines people actually reach for — starter templates + save-run-to-note

A blank multi-step editor invites nobody. Ship four one-click templates built on the (now web-capable) builtin agents, and let any successful manual run be kept as a note.

**Files:**
- Create: `src/ai/pipelines/templates.ts`
- Modify: `src/app/agents/PipelinesTab.tsx` (gallery)
- Modify: `src/app/agents/RunHistory.tsx` (save as note)

**Interfaces:**
- Consumes: `BUILTIN_AGENT_IDS` from `@/db/repo/agents`, `createPipeline`/`setPipelineSteps` from `@/db/repo/pipelines`, `createNote` from `@/db/repo/notes`, `listStepRuns`.
- Produces: `PIPELINE_TEMPLATES: PipelineTemplate[]`; `instantiateTemplate(t: PipelineTemplate): Promise<Pipeline>`; `RunHistory` props become `{ runs, pipelineName }`.

- [ ] **Step 1: Create `src/ai/pipelines/templates.ts`**

```ts
import { BUILTIN_AGENT_IDS } from "@/db/repo/agents";
import { createPipeline, setPipelineSteps } from "@/db/repo/pipelines";
import type { Pipeline } from "@/lib/schemas";

export interface PipelineTemplate {
    name: string;
    description: string;
    /** Suggested run input, shown as the input placeholder after creation. */
    exampleInput: string;
    steps: { agentId: string; promptTemplate: string }[];
}

/**
 * Starter pipelines on the builtin agents only — instantiating one must
 * never depend on user-created agents. Users edit them like any pipeline.
 */
export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
    {
        name: "Morning brief",
        description: "Search today's news on a topic and distill a 5-bullet brief.",
        exampleInput: "AI hardware",
        steps: [
            {
                agentId: BUILTIN_AGENT_IDS.research,
                promptTemplate:
                    "Search the web for the latest news about {{input}} (today is {{date}}). Read the two most substantial results and report the concrete developments with their source URLs.",
            },
            {
                agentId: BUILTIN_AGENT_IDS.planner,
                promptTemplate:
                    "Condense this into a 5-bullet morning brief. Each bullet: one development, why it matters, source URL.\n\n{{prev}}",
            },
        ],
    },
    {
        name: "Page watch",
        description: "Fetch a page and summarize what actually matters on it.",
        exampleInput: "https://news.ycombinator.com",
        steps: [
            {
                agentId: BUILTIN_AGENT_IDS.research,
                promptTemplate:
                    "Fetch {{input}} and summarize the most noteworthy items for an engineer — skip fluff, keep links.",
            },
        ],
    },
    {
        name: "Job scout",
        description: "Search openings, then cross-check against applications you already track.",
        exampleInput: "embedded software internship summer 2027",
        steps: [
            {
                agentId: BUILTIN_AGENT_IDS.research,
                promptTemplate:
                    "Search the web for current job postings matching: {{input}}. List company, role, location, and posting URL for up to 8 real openings.",
            },
            {
                agentId: BUILTIN_AGENT_IDS.planner,
                promptTemplate:
                    "Compare these openings against my tracked applications (list_applications). Which are new? Recommend the top 3 to apply to and why.\n\n{{step1}}",
            },
        ],
    },
    {
        name: "Study sheet",
        description: "Pull everything you have on a topic into one revision sheet.",
        exampleInput: "pipelined CPU hazards",
        steps: [
            {
                agentId: BUILTIN_AGENT_IDS.knowledge,
                promptTemplate:
                    "Search my documents and notes for everything about {{input}}. Quote the key definitions, formulas, and examples you find, citing which note/document each came from.",
            },
            {
                agentId: BUILTIN_AGENT_IDS.planner,
                promptTemplate:
                    "Turn this into a one-page revision sheet: core concepts first, then worked examples, then a self-quiz of 5 questions.\n\n{{prev}}",
            },
        ],
    },
];

export async function instantiateTemplate(t: PipelineTemplate): Promise<Pipeline> {
    const pipeline = await createPipeline({ name: t.name, description: t.description });
    await setPipelineSteps(pipeline.id, t.steps.map((s) => ({
        agentId: s.agentId,
        promptTemplate: s.promptTemplate,
    })));
    return pipeline;
}
```

Verify `setPipelineSteps`'s draft shape in `src/db/repo/pipelines.ts` (PipelinesTab passes `{ agentId, promptTemplate }` drafts today) and `BUILTIN_AGENT_IDS`'s exact member names; match them.

- [ ] **Step 2: Gallery in `PipelinesTab.tsx`**

Below the pipelines list, above the New-pipeline button (only when the editor is closed):

```tsx
            {!editing && (
                <div className="flex flex-col gap-2">
                    <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                        Start from a template
                    </h2>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {PIPELINE_TEMPLATES.map((t) => (
                            <button
                                key={t.name}
                                className="cursor-pointer rounded-md border border-border p-3 text-left transition-colors hover:border-primary/40"
                                onClick={() =>
                                    void instantiateTemplate(t).then(async (p) => {
                                        setRunInput(t.exampleInput);
                                        await reload();
                                        setEditing(p);
                                    })
                                }
                            >
                                <div className="text-sm">{t.name}</div>
                                <div className="text-xs text-muted-foreground">
                                    {t.description}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
```

- [ ] **Step 3: Save-run-to-note in `RunHistory.tsx`**

Change the signature to `RunHistory({ runs, pipelineName }: { runs: PipelineRun[]; pipelineName: string })` (update the call in PipelinesTab: `<RunHistory runs={runs} pipelineName={p.name} />`). Inside `RunRow` (also given `pipelineName`), for successful expanded runs add:

```tsx
                    {run.status === "success" && steps.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="self-start"
                            disabled={saved}
                            onClick={() => {
                                const last = steps[steps.length - 1];
                                if (!last?.output) return;
                                void createNote({
                                    title: `${pipelineName} — ${new Date(run.started_at).toLocaleDateString()}`,
                                    folder: "/pipelines",
                                    bodyMd: last.output,
                                }).then(() => setSaved(true));
                            }}
                        >
                            {saved ? "Saved to /pipelines" : "Save as note"}
                        </Button>
                    )}
```

with `const [saved, setSaved] = useState(false);` and `import { createNote } from "@/db/repo/notes";`.

- [ ] **Step 4: Gates + commit**

Run: `npm run typecheck && npm test` — Expected: PASS.
Manual: instantiate "Page watch", run it against a URL, expand the run, save it as a note, find it in Notes under /pipelines.

```bash
git add src/ai/pipelines/templates.ts src/app/agents
git commit -m "feat: pipeline starter templates + save-run-to-note"
```

---

### Task 10: Chat auto-metadata — title, tags, summary from the router model

After the first real exchange, a cheap model names the chat, tags it (≤3), and writes a one-line summary. Search and filters read the tags; the sidebar details show the summary. Failure is silent — metadata must never break chat.

**Files:**
- Create: `src/ai/chat/metadata.ts`
- Create: `src/ai/chat/metadata.test.ts`
- Modify: `src/app/chat/ChatWorkspace.tsx` (hook after a completed exchange)

**Interfaces:**
- Consumes: `createModel`, `appFetch`, `sessionsRepo.setSessionMeta`, `sessionsRepo.renameSession`, `extractTextParts`.
- Produces: `maybeGenerateSessionMeta(opts: { session: ChatSession; preset: Preset; settings: Settings; texts: string[] }): Promise<boolean>` — true when metadata was written.

- [ ] **Step 1: Failing test — `src/ai/chat/metadata.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseMetaJson, isDefaultTitle } from "./metadata";

describe("chat metadata", () => {
    it("recognizes default titles", () => {
        expect(isDefaultTitle("Research chat", "Research")).toBe(true);
        expect(isDefaultTitle("New chat", "Research")).toBe(true);
        expect(isDefaultTitle("GPU price hunt", "Research")).toBe(false);
    });

    it("parses fenced or bare JSON, clamps tags to 3", () => {
        const bare = parseMetaJson(
            '{"title":"GPU hunt","tags":["gpu","shopping","prices","extra"],"summary":"Comparing GPU prices."}',
        );
        expect(bare).toEqual({
            title: "GPU hunt",
            tags: ["gpu", "shopping", "prices"],
            summary: "Comparing GPU prices.",
        });
        const fenced = parseMetaJson('```json\n{"title":"T","tags":[],"summary":"S"}\n```');
        expect(fenced?.title).toBe("T");
        expect(parseMetaJson("no json here")).toBeNull();
    });
});
```

Run: `npx vitest run src/ai/chat/metadata.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 2: Create `src/ai/chat/metadata.ts`**

```ts
import { generateText } from "ai";
import { z } from "zod";
import { createModel, type ProviderId } from "@/ai/providers/registry";
import { appFetch } from "@/ai/providers/appFetch";
import * as sessionsRepo from "@/db/repo/sessions";
import type { Settings } from "@/ai/providers/keys";
import type { ChatSession, Preset } from "@/lib/schemas";

const metaSchema = z.object({
    title: z.string().min(1).max(60),
    tags: z.array(z.string().min(1).max(24)),
    summary: z.string().min(1).max(200),
});
export type SessionMeta = z.infer<typeof metaSchema>;

/** "Research chat" / "New chat" — the names sessions are born with. */
export function isDefaultTitle(title: string, presetName: string): boolean {
    return title === "New chat" || title === `${presetName} chat`;
}

/** Tolerates ```json fences and prose around the object; null when hopeless. */
export function parseMetaJson(raw: string): SessionMeta | null {
    const match = /\{[\s\S]*\}/.exec(raw);
    if (!match) return null;
    try {
        const parsed = metaSchema.parse(JSON.parse(match[0]));
        return { ...parsed, tags: parsed.tags.slice(0, 3) };
    } catch {
        return null;
    }
}

/**
 * Names, tags, and summarizes a session from its first exchange, on the
 * preset's router model (cheap). No-ops unless the title is still a default.
 * Never throws — metadata is decoration, not a dependency.
 */
export async function maybeGenerateSessionMeta(opts: {
    session: ChatSession;
    preset: Preset;
    settings: Settings;
    /** Plain text of the conversation so far (user + assistant turns). */
    texts: string[];
}): Promise<boolean> {
    if (!isDefaultTitle(opts.session.title, opts.preset.name)) return false;
    if (opts.texts.length < 2) return false;
    try {
        const model = createModel(
            {
                provider: opts.preset.provider as ProviderId,
                modelId: opts.preset.router_model ?? opts.preset.model,
            },
            { settings: opts.settings, fetch: appFetch },
        );
        const excerpt = opts.texts.join("\n---\n").slice(0, 4000);
        const result = await generateText({
            model,
            prompt: [
                "Summarize this chat for a session list. Reply with ONLY a JSON object:",
                '{"title": "<max 6 words>", "tags": ["<1-3 lowercase topic tags>"], "summary": "<one sentence>"}',
                "",
                excerpt,
            ].join("\n"),
        });
        const meta = parseMetaJson(result.text);
        if (!meta) return false;
        await sessionsRepo.renameSession(opts.session.id, meta.title);
        await sessionsRepo.setSessionMeta(opts.session.id, {
            summary: meta.summary,
            tags: meta.tags,
        });
        return true;
    } catch (e) {
        console.warn("session metadata generation failed:", e);
        return false;
    }
}
```

- [ ] **Step 3: Hook it in `ChatWorkspace.tsx`**

`ActiveChatView` needs a way to tell the workspace an exchange finished; add an `onExchangeDone(messages: UIMessage[])` prop, called from an effect watching `status`:

```tsx
    const prevStatus = useRef(status);
    useEffect(() => {
        if (prevStatus.current === "streaming" && status === "ready")
            onExchangeDone(messages);
        prevStatus.current = status;
    }, [status, messages, onExchangeDone]);
```

In `ChatWorkspace`, pass it down:

```tsx
                    <ActiveChatView
                        key={active.session.id}
                        active={active}
                        onExchangeDone={(msgs) => {
                            const texts = msgs
                                .map((m) =>
                                    m.parts
                                        .filter((p) => p.type === "text")
                                        .map((p) => (p as { text: string }).text)
                                        .join("\n"),
                                )
                                .filter(Boolean);
                            void maybeGenerateSessionMeta({
                                session: active.session,
                                preset: active.preset,
                                settings,
                                texts,
                            }).then(async (wrote) => {
                                if (wrote) setSessions(await sessionsRepo.listSessions());
                            });
                        }}
                    />
```

(If the installed AI SDK's idle status string is `"awaiting_message"` rather than `"ready"`, match whatever `useChat` actually reports — check the `status` union the compiler shows.)

- [ ] **Step 4: Gates + commit**

Run: `npx vitest run src/ai/chat/metadata.test.ts` — Expected: PASS.
Run: `npm run typecheck && npm test` — Expected: PASS.
Manual: a fresh chat renames itself after the first reply; a renamed-by-hand chat is left alone.

```bash
git add src/ai/chat src/app/chat/ChatWorkspace.tsx
git commit -m "feat: chats auto-name, tag, and summarize themselves via the router model"
```

---

### Task 11: Chat sidebar — search, category filter, file-to chips

Search across titles, tags, and full message text (the Task 2 FTS); filter by category; assign a chat's project/category right from its expanded details.

**Files:**
- Modify: `src/app/chat/InstancesSidebar.tsx`
- Modify: `src/app/chat/ChatWorkspace.tsx` (load categories, pass through, refresh on change)

**Interfaces:**
- Consumes: `searchSessionIds`, `sessionTags`, `effectiveCategoryId`, `listCategories`, `setSessionProject`, `setSessionCategory`, `FilterChips`, `Select`.
- Produces: `InstancesSidebar` gains props `categories: Category[]` and `onFiled: () => void` (workspace reloads sessions after an assign).

- [ ] **Step 1: Load + pass categories in `ChatWorkspace`**

Add `const [categories, setCategories] = useState<Category[]>([]);`, load `await listCategories()` in the boot effect (import from `@/db/repo/categories`), and pass `categories={categories}` and `onFiled={() => void sessionsRepo.listSessions().then(setSessions)}` to `InstancesSidebar`.

- [ ] **Step 2: Search + filter state in `InstancesSidebar`**

```tsx
    const [query, setQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
    const [contentHits, setContentHits] = useState<Set<string> | null>(null);

    // Debounced full-text pass over message content; title/tag matching is local.
    useEffect(() => {
        const q = query.trim();
        if (!q) {
            setContentHits(null);
            return;
        }
        const handle = setTimeout(() => {
            void searchSessionIds(q).then((ids) => setContentHits(new Set(ids)));
        }, 200);
        return () => clearTimeout(handle);
    }, [query]);

    const projectById = useMemo(
        () => new Map(projects.map((p) => [p.id, p])),
        [projects],
    );
    const q = query.trim().toLowerCase();
    const visible = sessions.filter((s) => {
        if (
            categoryFilter &&
            effectiveCategoryId(s, projectById) !== categoryFilter
        )
            return false;
        if (!q) return true;
        if (s.title.toLowerCase().includes(q)) return true;
        if (sessionTags(s).some((t) => t.toLowerCase().includes(q))) return true;
        return contentHits?.has(s.id) ?? false;
    });
```

Use `visible` (not `sessions`) to build `groups`/`unfiled`. Render above the preset buttons:

```tsx
            <div className="flex flex-col gap-2 px-2 pb-2">
                <Input
                    value={query}
                    placeholder="Search chats…"
                    onChange={(e) => setQuery(e.target.value)}
                    className="h-8 text-xs"
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
            </div>
```

- [ ] **Step 3: Expanded details — summary, tags, file-to selects**

In the expanded block add (before the Color row):

```tsx
                        {s.auto_summary && (
                            <p className="text-left text-muted-foreground">
                                {s.auto_summary}
                            </p>
                        )}
                        {sessionTags(s).length > 0 && (
                            <Detail label="Tags">
                                <div className="flex flex-wrap justify-end gap-1">
                                    {sessionTags(s).map((t) => (
                                        <span
                                            key={t}
                                            className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[9px]"
                                        >
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </Detail>
                        )}
                        <Detail label="Project">
                            <Select
                                className="h-6 w-32 text-[10px]"
                                value={s.project_id ?? ""}
                                onChange={(e) =>
                                    void setSessionProject(s.id, e.target.value || null).then(onFiled)
                                }
                            >
                                <option value="">—</option>
                                {projects.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </Select>
                        </Detail>
                        <Detail label="Category">
                            <Select
                                className="h-6 w-32 text-[10px]"
                                value={s.category_id ?? ""}
                                onChange={(e) =>
                                    void setSessionCategory(s.id, e.target.value || null).then(onFiled)
                                }
                            >
                                <option value="">
                                    {s.project_id ? "inherit from project" : "—"}
                                </option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </Select>
                        </Detail>
```

Imports: `Input`, `Select`, `FilterChips`, `searchSessionIds` from `@/db/repo/messages`, `setSessionProject`/`setSessionCategory` from `@/db/repo/sessions`, `sessionTags` from `@/lib/schemas`, `effectiveCategoryId` from `@/lib/categories`, `Category` type.

- [ ] **Step 4: Gates + commit**

Run: `npm run typecheck && npm test` — Expected: PASS.
Manual: search finds a chat by a word that only appears in its messages; category chips filter; filing a chat under a project moves it into the project group.

```bash
git add src/app/chat
git commit -m "feat: chat search, category filters, and file-to controls in the sidebar"
```

---

### Task 12: Universe network — category spheres with an exo-sphere

The opening sphere shows one star per category (plus "unfiled"); clicking a category dives into its own sphere — projects and chats inside, with older chats pushed to an outer exo-shell you reach by scrolling out. With zero categories the existing universe (recent chats + archive star) still renders, so untitled chats stay visible.

**Files:**
- Modify: `src/components/hud/networkData.ts` (shell field, `buildCategoryUniverse`)
- Modify: `src/components/hud/networkData.test.ts`
- Modify: `src/components/hud/NetworkSphere.tsx` (wheel zoom + shell radii)
- Modify: `src/app/chat/ChatWorkspace.tsx` (focus state + breadcrumb)

**Interfaces:**
- Consumes: `effectiveCategoryId`, `Category` type.
- Produces: `NetworkNode.shell?: number`; `NodeKind` gains `"category"`; `buildCategoryUniverse(opts: { categories; projects; sessions; documents; presets; agents; focusCategoryId: string | null }): Network` where `focusCategoryId` `null` = top level and the sentinel `"unfiled"` = the unfiled group.

- [ ] **Step 1: Failing tests — extend `networkData.test.ts`**

```ts
describe("buildCategoryUniverse", () => {
    const cat = (id: string, name: string): Category => ({
        id, name, color: "#22d3ee", created_at: 0, updated_at: 0,
    });
    const session = (id: string, over: Partial<ChatSession> = {}): ChatSession => ({
        id, title: id, preset_id: null, permission_level_id: null,
        project_id: null, category_id: null, color: null,
        compaction_summary: null, auto_summary: null, auto_tags_json: "[]",
        created_at: 0, updated_at: 0, ...over,
    });

    it("top level: one star per category plus unfiled", () => {
        const net = buildCategoryUniverse({
            categories: [cat("cat_a", "School")],
            projects: [],
            sessions: [session("ses_1", { category_id: "cat_a" }), session("ses_2")],
            documents: [], presets: [], agents: [],
            focusCategoryId: null,
        });
        const kinds = net.nodes.map((n) => n.kind);
        expect(kinds.filter((k) => k === "category")).toHaveLength(2); // School + unfiled
        expect(net.nodes.find((n) => n.id === "category:cat_a")!.meta.foot).toContain("1 chat");
    });

    it("focused: newest chats inner, overflow on the exo shell", () => {
        const sessions = Array.from({ length: 12 }, (_, i) =>
            session(`ses_${i}`, { category_id: "cat_a", updated_at: 100 - i }),
        );
        const net = buildCategoryUniverse({
            categories: [cat("cat_a", "School")],
            projects: [], sessions, documents: [], presets: [], agents: [],
            focusCategoryId: "cat_a",
        });
        const chats = net.nodes.filter((n) => n.kind === "session");
        expect(chats).toHaveLength(12);
        expect(chats.filter((n) => (n.shell ?? 1) > 1)).toHaveLength(12 - 8);
        // Newest stay inner.
        expect(chats.find((n) => n.id === "session:ses_0")!.shell ?? 1).toBe(1);
    });

    it("focused unfiled shows only unfiled sessions", () => {
        const net = buildCategoryUniverse({
            categories: [cat("cat_a", "School")],
            projects: [],
            sessions: [session("ses_a", { category_id: "cat_a" }), session("ses_b")],
            documents: [], presets: [], agents: [],
            focusCategoryId: "unfiled",
        });
        expect(net.nodes.filter((n) => n.kind === "session").map((n) => n.id))
            .toEqual(["session:ses_b"]);
    });
});
```

Match the existing test file's fixture helpers/imports; if it already has a `session` factory, extend it with the two new columns instead of redefining. Run to verify FAIL.

- [ ] **Step 2: Implement in `networkData.ts`**

Extend the types:

```ts
export type NodeKind =
    | "session" | "agent" | "tool" | "doc" | "project" | "archive" | "category";
```

Add to `NetworkNode`:

```ts
    /** Radius multiplier: 1 = main sphere, >1 = exo-sphere (older overflow). */
    shell?: number;
```

Add the builder (below `buildUniverseNetwork`):

```ts
export const CATEGORY_INNER = 8;
export const EXO_SHELL = 1.4;
export const UNFILED_ID = "unfiled";

/**
 * Category-first universe. Top level (focusCategoryId null): one star per
 * category plus an "unfiled" star when untagged chats exist. Focused on a
 * category (or the "unfiled" sentinel): its projects as stars with their
 * chats/files clustered, direct chats as stars — newest CATEGORY_INNER on
 * the main sphere, the rest pushed to the exo-shell (shell EXO_SHELL),
 * reachable by zooming out.
 */
export function buildCategoryUniverse(opts: {
    categories: Category[];
    projects: Project[];
    sessions: ChatSession[];
    documents: Pick<Document, "id" | "title" | "project_id">[];
    presets: Preset[];
    agents: AgentDef[];
    focusCategoryId: string | null;
}): Network {
    const presetById = new Map(opts.presets.map((p) => [p.id, p]));
    const agentsById = new Map(opts.agents.map((a) => [a.id, a]));
    const projectById = new Map(opts.projects.map((p) => [p.id, p]));
    const net: Network = { nodes: [], edges: [] };
    const catOf = (s: ChatSession) => effectiveCategoryId(s, projectById);

    if (opts.focusCategoryId === null) {
        const unfiled = opts.sessions.filter((s) => catOf(s) === null);
        const stars = opts.categories.length + (unfiled.length > 0 ? 1 : 0);
        const units = fibonacciSphere(Math.max(1, stars));
        let slot = 0;
        for (const c of opts.categories) {
            const chats = opts.sessions.filter((s) => catOf(s) === c.id).length;
            const projects = opts.projects.filter((p) => p.category_id === c.id).length;
            net.nodes.push({
                id: `category:${c.id}`,
                kind: "category",
                label: c.name,
                color: c.color ?? "var(--primary)",
                unit: units[slot++]!,
                r: PROJECT_R + 0.4,
                primary: true,
                meta: {
                    title: c.name,
                    subtitle: "Click to open this category's sphere.",
                    foot: `${chats} chat${chats === 1 ? "" : "s"} · ${projects} project${projects === 1 ? "" : "s"}`,
                },
                payload: { categoryId: c.id },
            });
        }
        if (unfiled.length > 0) {
            net.nodes.push({
                id: `category:${UNFILED_ID}`,
                kind: "category",
                label: "unfiled",
                color: ARCHIVE_COLOR,
                unit: units[slot++]!,
                r: PROJECT_R,
                primary: true,
                meta: {
                    title: `${unfiled.length} unfiled chats`,
                    subtitle: "Chats without a category. Click to open.",
                },
                payload: { categoryId: UNFILED_ID },
            });
        }
        return net;
    }

    const focusId = opts.focusCategoryId;
    const projects = opts.projects.filter(
        (p) => focusId !== UNFILED_ID && p.category_id === focusId,
    );
    const projectIds = new Set(projects.map((p) => p.id));
    const direct = opts.sessions
        .filter((s) =>
            focusId === UNFILED_ID
                ? catOf(s) === null
                : catOf(s) === focusId && !projectIds.has(s.project_id ?? ""),
        )
        .sort((a, b) => b.updated_at - a.updated_at);
    const inner = direct.slice(0, CATEGORY_INNER);
    const exo = direct.slice(CATEGORY_INNER);

    const hubUnits = fibonacciSphere(Math.max(1, projects.length + inner.length));
    let slot = 0;

    for (const project of projects) {
        const unit = hubUnits[slot++]!;
        const hubId = `project:${project.id}`;
        const color = project.color ?? "var(--primary)";
        const docs = opts.documents
            .filter((d) => d.project_id === project.id)
            .slice(0, PROJECT_DOC_SAT);
        const sessions = opts.sessions
            .filter((s) => s.project_id === project.id)
            .slice(0, PROJECT_SESSION_SAT);
        net.nodes.push({
            id: hubId,
            kind: "project",
            label: project.name,
            color,
            unit,
            r: PROJECT_R,
            primary: true,
            meta: {
                title: project.name,
                subtitle: project.description ?? "project",
                foot: `${sessions.length} chats · ${docs.length} files`,
            },
            payload: { project },
        });
        docs.forEach((doc, i) => {
            const dUnit = satelliteUnit(unit, i, docs.length, TOOL_SPREAD);
            const id = `${hubId}:doc:${doc.id}`;
            net.nodes.push({
                id, kind: "doc", label: doc.title, color, unit: dUnit,
                r: TOOL_R, parentId: hubId, primary: false,
                meta: { title: doc.title, subtitle: `file · ${project.name}` },
            });
            net.edges.push({ a: hubId, b: id });
        });
        sessions.forEach((s, i) => {
            const sUnit = satelliteUnit(unit, i, sessions.length, AGENT_SPREAD);
            const preset = s.preset_id ? presetById.get(s.preset_id) : undefined;
            const id = `session:${s.id}`;
            net.nodes.push({
                id, kind: "session", label: s.title,
                color: sessionColor(s, preset, agentsById),
                unit: sUnit, r: AGENT_R, parentId: hubId, primary: true,
                meta: {
                    title: s.title,
                    subtitle: preset ? preset.name : "no preset",
                    foot: `updated ${relativeTime(s.updated_at)}`,
                },
                payload: s,
            });
            net.edges.push({ a: hubId, b: id });
        });
    }

    for (const s of inner) {
        const unit = hubUnits[slot++]!;
        const preset = s.preset_id ? presetById.get(s.preset_id) : undefined;
        net.nodes.push({
            id: `session:${s.id}`,
            kind: "session",
            label: s.title,
            color: sessionColor(s, preset, agentsById),
            unit,
            r: HUB_R,
            primary: true,
            meta: {
                title: s.title,
                subtitle: preset ? preset.name : "no preset",
                foot: `updated ${relativeTime(s.updated_at)}`,
            },
            payload: s,
        });
    }

    // Overflow: older chats orbit outside the chart circle — scroll out.
    const exoUnits = fibonacciSphere(Math.max(1, exo.length));
    exo.forEach((s, i) => {
        const preset = s.preset_id ? presetById.get(s.preset_id) : undefined;
        net.nodes.push({
            id: `session:${s.id}`,
            kind: "session",
            label: s.title,
            color: sessionColor(s, preset, agentsById),
            unit: exoUnits[i]!,
            r: AGENT_R,
            shell: EXO_SHELL,
            primary: true,
            meta: {
                title: s.title,
                subtitle: preset ? preset.name : "no preset",
                foot: `exo-sphere · updated ${relativeTime(s.updated_at)}`,
            },
            payload: s,
        });
    });

    return net;
}
```

Imports: add `Category` to the type import from `@/lib/schemas` and `effectiveCategoryId` from `@/lib/categories`.

- [ ] **Step 3: Run the networkData tests**

Run: `npx vitest run src/components/hud/networkData.test.ts` — Expected: PASS.

- [ ] **Step 4: Shell radii + wheel zoom in `NetworkSphere.tsx`**

Add next to the orientation refs:

```ts
    const zoomRef = useRef(1);
    const wrapRef = useRef<HTMLDivElement>(null);
```

In `draw()`, replace the projection line with:

```ts
                const p = projectQuat(
                    node.unit,
                    orient,
                    RADIUS * zoomRef.current * (node.shell ?? 1),
                );
```

and after the existing opacity math add `if ((node.shell ?? 1) > 1) op *= 0.6;`.

Add a non-passive wheel listener (React's `onWheel` can't `preventDefault`):

```ts
    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            zoomRef.current = Math.min(
                1.1,
                Math.max(0.55, zoomRef.current * (e.deltaY > 0 ? 0.92 : 1.08)),
            );
            lastInteractionRef.current = performance.now();
            if (reduced) draw();
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [reduced, draw]);
```

Put `ref={wrapRef}` on the wrapper div, and seed positions with the same multiplier: `projectQuat(n.unit, INITIAL_ORIENT, RADIUS * (n.shell ?? 1))`.

- [ ] **Step 5: Focus state + breadcrumb in `ChatWorkspace.tsx`**

```tsx
    const [sphereFocus, setSphereFocus] = useState<string | null>(null);
```

Replace the `network` memo: when `categories.length > 0`, use `buildCategoryUniverse({ categories, projects, sessions, documents: docs, presets, agents, focusCategoryId: sphereFocus })`; else keep the existing `buildUniverseNetwork` / `buildAgentTypeNetwork` fallbacks (untitled chats stay directly visible when no categories exist). Add `categories` and `sphereFocus` to the dep array.

In `openFromNode`, before the other branches:

```ts
            if (node.kind === "category") {
                setSphereFocus((node.payload as { categoryId: string }).categoryId);
                return;
            }
```

Under the sphere (inside the standing-by block), a breadcrumb:

```tsx
                        {sphereFocus && (
                            <button
                                className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                                onClick={() => setSphereFocus(null)}
                            >
                                ← all categories
                            </button>
                        )}
```

And update the hint copy: when `sphereFocus` is set and the category has overflow, say "Scroll out to reach the exo-sphere.": simplest is to always render `Hover a node or row to link them · click to open · scroll to zoom.` when sessions exist.

- [ ] **Step 6: Gates + commit**

Run: `npm run typecheck && npm test` — Expected: PASS.
Manual: with 2+ categories the opening sphere shows category stars; clicking one dives in; with >8 direct chats the older ones sit outside the ring and scrolling out reveals them; breadcrumb returns; with zero categories the old universe renders.

```bash
git add src/components/hud src/app/chat/ChatWorkspace.tsx
git commit -m "feat: category spheres with exo-shell overflow and wheel zoom"
```

---

### Task 13: Docs, final gates, human QA list

**Files:**
- Modify: `docs/architecture.md` (data model: categories/auto-metadata/messages_fts; repo layout: categories section; agent topology: search_web)
- Modify: `docs/todo.md` (record this round: what shipped, what was deliberately skipped)

- [ ] **Step 1: Update `docs/architecture.md`**

In the data-model block add:

```txt
categories         id, name UNIQUE, color, timestamps — the universal tag;
                   projects/tasks/notes/chat_sessions/courses carry category_id
messages_fts       FTS5 (message_id, session_id, content) — written by the
                   messages repo from extracted text parts, backfilled at boot
chat_sessions      + category_id, auto_summary, auto_tags_json (router-model metadata)
```

Update the repo-layout section (`projects/` page → `categories/`), and the Research agent line to mention `search_web` (DuckDuckGo HTML, $0) plus the browser-target `/__proxy` middleware.

- [ ] **Step 2: Update `docs/todo.md`**

Append a dated section listing this plan's items as done, and carry forward the deliberate skips from "Deliberately not done" above.

- [ ] **Step 3: Full gates**

Run: `npm run typecheck && npm test`
Expected: PASS, zero skips beyond the usual live-model evals.

- [ ] **Step 4: Human QA checklist (headless browser QA is unavailable here)**

Post this list for a manual `npm run dev` pass:
1. Pipelines: template gallery → "Morning brief" → run → search_web approval → results; pills render in the step editor; save a run as a note.
2. Planner opens on Calendar; 7d/14d/month switch; task + event + follow-up visible; category chips filter.
3. Tasks: create with "+ new category…"; filter chips.
4. Notes: Review tab reviews cards; "Make flashcards" on a note; category filter.
5. Categories page: create/open/delete; project created inside a category; chats/tasks/notes tabs populated.
6. Chat: auto-title after first reply; sidebar search hits message text; category chips; file-to selects.
7. Sphere: category stars → drill in → scroll out to exo-sphere → breadcrumb back.

- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "docs: record categories/signal architecture and close out the notes round"
```

---

## Self-Review (performed while writing)

**Spec coverage against the notes:**
- *"model can't access outside websites"* → Task 7 (search_web + CORS proxy; desktop capability already allowed `https://*/*`, verified).
- *"{{input}} UI confusing / {{}} as text looks weird / inline block"* → Task 8 (overlay pill editor, unknown tokens red).
- *"unique uses… want to consistently use it"* → Task 9 (template gallery, save-run-to-note) + Task 7 making Research genuinely capable.
- *"planner… initially appear with the calendar"* → Task 5 Step 6.
- *"visual modes 7/14/month"* → Task 5 (`rangeFor`, DayList, MonthGrid).
- *"tasks and other scheduled things in the calendar"* → Task 5 `collectCalendarItems` (events, tasks, automations, application follow-ups).
- *"tasks optional categories… overall categories system which projects inherit from"* → Tasks 1–4 (categories table is the root; projects point at it; courses migrated).
- *"filtering by categories in calendar and tasks"* → Tasks 4 & 5 FilterChips.
- *"review section unclear → functional or remove; more related to notes; notes inherit categories"* → Task 6 (it was functional — moved to Notes, explained, note categories added, note→flashcards loop closed).
- *"projects section → categories, projects tab inherits a category"* → Task 3.
- *"everything, including chats, filterable by category/project"* → Tasks 2 (queries), 3 (per-category tabs), 11 (chat sidebar); bookmarks/snippets inherit via project (recorded as deliberate).
- *"chat search, filtering, generated metadata"* → Tasks 10 & 11 (FTS from Task 2).
- *"network split by category, initial sphere shows categories, untitled chats when none, exo-sphere overflow, scroll out"* → Task 12.

**Placeholder scan:** every code step contains the code. `updateApplication`, `listAutomations`, `BUILTIN_AGENT_IDS`, and `setPipelineSteps` were verified against the live repos while writing. The remaining spots where the engineer must reconcile with a live signature (`createModel`/`Settings` field names, the `useChat` status union, automation template vars, the `Textarea` base classes) name the exact file to check rather than saying "handle appropriately".

**Type consistency:** `listOpenTasks(opts)` / `listNotes(filter)` / `listSessions(filter)` object signatures are used identically in Tasks 2, 3, 5, 6; `effectiveCategoryId(session, projectById)` is used in Tasks 11 and 12 with the same `Map<string, Project>`; `CategoryCounts` fields match between repo and CategoriesPage; `buildCategoryUniverse` option names match between implementation (Task 12 Step 2), tests (Step 1), and ChatWorkspace (Step 5); `setSessionMeta({ summary, tags })` matches Task 10's call; `wrapWebFetch` is defined in Task 7 Step 4 and consumed in the same step's catalog change.
