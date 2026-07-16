# HUGH Overhaul Implementation Plan — everything in `docs/todo.md`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the two visual defects, de-duplicate the permission dropdown, restructure the app into four comprehensible sections (Agents-with-chat, Projects, Notes-with-library, Planner-with-courses), add Projects (files + project chats + project bookmarks + automations + their own star on the network), make the network sphere scale past ~10 chats via an archive layer, add chat rename/recolor, and add category filtering to bookmarks/snippets/tasks.

**Architecture:** Everything stays a local-first Tauri 2 + React SPA over one SQLite file. Schema changes are two new migrations (`0010` collapses the duplicate "Ask everything" level into `NULL`; `0011` adds `projects` plus `project_id`/`color`/`group_name` columns). New data flows through the existing repo pattern (typed SQL + zod row parsing). The UI overhaul is a re-hosting exercise: existing page bodies become tabs inside three section pages, navigated by a `NavTarget { page, tab }` that the sidebar and ⌘K palette both use. The network sphere gets a new pure builder (`buildUniverseNetwork`) that renders project stars with document satellites and folds old chats into one expandable "archive" star, so node count stays bounded no matter how many chats exist.

**Tech Stack:** React 19, TypeScript strict, Tailwind v4, motion, lucide-react, zod, SQLite (tauri-plugin-sql / sqlite-wasm+OPFS / better-sqlite3 in tests), Vercel AI SDK. **No new dependencies.**

## Global Constraints

- **$0 budget:** no new npm packages, no services, no paid APIs. Every task below uses only dependencies already in `package.json`.
- **Three DB clients, one schema:** every schema change is a new `src-tauri/migrations/00NN_name.sql` file **and** a new `Migration` entry in `src-tauri/src/lib.rs` (`version: NN`). The web worker (`import.meta.glob`) and vitest (`testClient.ts` reads the directory) pick the file up automatically — no other registration.
- **Migration content rule:** `ALTER TABLE … ADD COLUMN` only with NULL/constant defaults (SQLite limitation). Never rely on `PRAGMA foreign_keys` for cascades in new code — do explicit `UPDATE`s (the three clients differ).
- **Perf contract (WSLg):** no SVG filters, no `backdrop-blur`, no per-frame allocations in HUD components. Canvas/SVG attribute writes inside one rAF only.
- **Schema mirror:** every new column appears in the matching zod schema in `src/lib/schemas.ts` (`z.object` is non-strict, so land the migration first, then the schema, then the repo).
- **Gates:** `npm run typecheck` and `npm test` must pass before every commit. UI-only steps get a manual verification step via `npm run dev` (browser target is enough; it exercises the same code).
- **Copy voice:** plain language first, observatory flavor second. Remove student-specific copy from general surfaces ("classes", "ECE 437", "assignments") — courses remain a feature, scoped to the Planner → Calendar tab.
- **Style:** 4-space indent, double quotes, `cn()` for class merging, repos throw on missing rows, `void` prefix for fire-and-forget promises — match the file you are editing.
- Work on a branch: `git checkout -b feat/todo-overhaul` before Task 1.

## File Structure (what exists after the plan)

```txt
src-tauri/migrations/
  0010_permission_cleanup.sql      NEW  kill duplicate "Ask everything" level
  0011_projects.sql                NEW  projects + project_id/color/group_name cols
src-tauri/src/lib.rs               MOD  register versions 10 & 11
src/lib/schemas.ts                 MOD  projectSchema; new columns on 5 schemas
src/db/repo/projects.ts            NEW  project CRUD + counts
src/db/repo/projects.test.ts       NEW
src/db/repo/{sessions,library,documents,automations,permissions,presets}.ts  MOD
src/components/ui/tabs.tsx         NEW  shared TabBar (extracted from AgentsPage)
src/components/ui/filterChips.tsx  NEW  category filter row
src/components/PermissionLevelSelect.tsx  NEW  the only place "no level" renders
src/components/chat/Composer.tsx   MOD  aligned, auto-growing input
src/components/hud/GridBackground.tsx  MOD  halo + tapered-spike stars
src/components/hud/NetworkSphere.tsx   MOD  tapered diamond spikes
src/components/hud/networkData.ts      MOD  buildUniverseNetwork, archive layer
src/components/hud/networkData.test.ts NEW
src/app/Shell.tsx                  MOD  NavTarget state, new PAGES
src/app/Sidebar.tsx                MOD  4-section IA
src/app/components/palette/CommandPalette.tsx  MOD  NavTarget entries
src/app/agents/AgentsPage.tsx      MOD  Chat|Roster|Pipelines|Automations tabs
src/app/agents/PipelinesTab.tsx    MOD  template chips, plain-language copy
src/app/agents/AutomationsTab.tsx  MOD  PermissionLevelSelect, project select
src/app/chat/ChatWorkspace.tsx     MOV  from ChatPage.tsx; project-aware
src/app/chat/InstancesSidebar.tsx  MOD  rename/recolor, project grouping, "Chats"
src/app/notes/NotesPage.tsx        MOD  Notes|Bookmarks|Snippets tabs
src/app/notes/BookmarksTab.tsx     NEW  from LibraryPage, + filters/edit/project
src/app/notes/SnippetsTab.tsx      NEW  from LibraryPage, + groups/filters/edit
src/app/planner/PlannerPage.tsx    NEW  Tasks|Calendar|Applications|Review tabs
src/app/planner/TasksTab.tsx       MOV  from tasks/TasksPage.tsx (tasks half)
src/app/planner/CalendarTab.tsx    NEW  WeekEvents + CoursesPanel (other half)
src/app/planner/ApplicationsTab.tsx MOV from applications/ApplicationsPage.tsx
src/app/planner/ReviewTab.tsx      MOV  from review/ReviewPage.tsx
src/app/projects/ProjectsPage.tsx  NEW  list/create/open
src/app/projects/ProjectDetail.tsx NEW  files, chats, bookmarks, automations
src/app/library/                   DEL  (content lives in notes/ tabs)
src/app/tasks/, src/app/applications/, src/app/review/  DEL (moved to planner/)
```

Deliberately **not** done (YAGNI): `notes.project_id` (projects group chats/files/bookmarks/automations only — the todo doesn't ask for project notes), tags on tasks (courses already are the category), FTS on bookmarks/snippets (tables are tiny; LIKE search stays).

---

### Task 1: Composer input alignment + auto-grow

The bug: icon buttons are `h-9` (36px) but the textarea is `rows={2}` with `py-1.5`, inside an `items-end` row — so the placeholder's first line floats above the buttons' text baseline. Fix by making the textarea exactly one 36px line when empty (matching `h-9`), growing with content like every modern chat input.

**Files:**
- Modify: `src/components/chat/Composer.tsx` (imports, ~line 1; textarea block, lines 185–210)

**Interfaces:**
- Consumes: nothing new.
- Produces: no API change — `Composer` props are untouched.

- [ ] **Step 1: Add the auto-size effect**

In `Composer.tsx`, change the react import (line 1) and add a ref + effect after the existing `recorderRef` declaration (line 42):

```tsx
import { useEffect, useRef, useState } from "react";
```

```tsx
    const taRef = useRef<HTMLTextAreaElement>(null);

    // One line (36px = h-9, matching the icon buttons) when empty; grows with
    // content up to max-h-40, then scrolls. Runs on every text change,
    // including the post-send reset to "".
    useEffect(() => {
        const ta = taRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
    }, [text]);
```

- [ ] **Step 2: Update the textarea element**

Replace the opening of the `<textarea>` (lines 185–187):

```tsx
                    <textarea
                        rows={2}
                        className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-50"
```

with:

```tsx
                    <textarea
                        ref={taRef}
                        rows={1}
                        className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-50"
```

(`py-2` = 8px×2 + `leading-5` = 20px → 36px total, identical to the `h-9` buttons; the surrounding `items-end` row now bottom-aligns everything on the same 36px baseline and keeps buttons pinned to the bottom as the textarea grows.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 4: Manual verify**

Run: `npm run dev`, open a chat. Verify: (a) empty composer — placeholder text sits on the same baseline as the send-button icon; (b) typing 10 lines grows the box to ~160px then scrolls inside; (c) sending resets to one line.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/Composer.tsx
git commit -m "fix: align composer input with buttons, auto-grow with content"
```

---

### Task 2: Star rendering — soft halos and tapered spikes

The todo: stars are "just two lines" and the lines are "too obvious". Two renderers draw the two-line cross: the canvas star field (`GridBackground.tsx:47-56`) and the sphere's diffraction spikes (`NetworkSphere.tsx:349-365`). Replace both with a soft radial halo + four *tapered* spikes (thin triangles that fade by geometry — wide at the core, vanishing at the tip). No filters, still zero per-frame cost for the background.

**Files:**
- Modify: `src/components/hud/GridBackground.tsx:47-56`
- Modify: `src/components/hud/NetworkSphere.tsx` (spike markup lines 349–365, spike updates in `draw()` lines 133–144)

**Interfaces:** none — both are self-contained renderers.

- [ ] **Step 1: Rewrite the bright-star branch in GridBackground**

Replace lines 45–56 (`// The brightest few get a fine diffraction cross …` through the `ctx.stroke();` and its closing brace) with:

```ts
            // The brightest few get a soft halo + four tapered diffraction
            // spikes — thin triangles that fade by shape instead of hard
            // stroked lines.
            if (mag > 0.97) {
                const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
                halo.addColorStop(0, "oklch(0.9 0.03 85 / 0.3)");
                halo.addColorStop(1, "oklch(0.9 0.03 85 / 0)");
                ctx.fillStyle = halo;
                ctx.beginPath();
                ctx.arc(x, y, r * 5, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = "oklch(0.9 0.03 85 / 0.14)";
                const len = r * 7;
                const half = r * 0.35;
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
                    ctx.beginPath();
                    ctx.moveTo(x - dy * half, y + dx * half);
                    ctx.lineTo(x + dy * half, y - dx * half);
                    ctx.lineTo(x + dx * len, y + dy * len);
                    ctx.closePath();
                    ctx.fill();
                }
            }
```

Also update the component doc comment (lines 3–8): change "two faint great-circle graticule arcs" sentence's neighbor "a static star field (drawn once to canvas)" to "a static star field (drawn once to canvas; bright stars get soft halos + tapered spikes)".

- [ ] **Step 2: Replace the sphere's two-line spikes with tapered diamonds**

In `NetworkSphere.tsx`, the spike `<g>` (lines 350–365) currently strokes two lines. Replace the JSX with fill-based tapered diamonds (a classic four-point star made of two thin crossing diamonds):

```tsx
                {/* Diffraction spikes — primary stars only, positioned by the rAF loop.
                    Two thin diamonds = a tapered four-point star; fill-based, no strokes. */}
                {nodes.map((n, i) =>
                    n.primary ? (
                        <g
                            key={`spike-${n.id}`}
                            ref={(el) => {
                                spikeEls.current[i] = el;
                            }}
                            transform={`translate(${seed[i]!.cx} ${seed[i]!.cy}) scale(${n.r * 3.2})`}
                            fill={n.color}
                            fillOpacity={(0.35 + 0.65 * seed[i]!.depth) * 0.45}
                        >
                            <path d="M -1 0 L 0 0.07 L 1 0 L 0 -0.07 Z" />
                            <path d="M 0 -1 L 0.07 0 L 0 1 L -0.07 0 Z" />
                        </g>
                    ) : null,
                )}
```

- [ ] **Step 3: Update the spike writes in `draw()`**

Replace the spike block inside `draw()` (lines 133–144):

```ts
                const spike = spikeEls.current[i];
                if (spike) {
                    const len = node.r * rScale * 3.2;
                    spike.setAttribute(
                        "transform",
                        `translate(${p.cx} ${p.cy}) scale(${len})`,
                    );
                    // Softer than the star body; vanishes with depth like everything else.
                    spike.setAttribute("fill-opacity", String(op * 0.45));
                }
```

(The `stroke-opacity` and `stroke-width` writes are gone — fills need neither.)

- [ ] **Step 4: Typecheck + manual verify**

Run: `npm run typecheck` → exit 0.
Run: `npm run dev` → background stars: bright ones read as glowing points with subtle rays, no hard crosses; Chat page sphere: primary nodes show soft four-point stars that still scale/fade with rotation and hover.

- [ ] **Step 5: Commit**

```bash
git add src/components/hud/GridBackground.tsx src/components/hud/NetworkSphere.tsx
git commit -m "art: soften stars — halos + tapered spikes replace two-line crosses"
```

---

### Task 3: Kill the duplicate "Ask everything" (root cause)

Root cause: "no permissions" has **two representations** — `permission_level_id = NULL` (hardcoded `<option value="">Ask everything</option>` in `ChatPage.tsx:273`, `PipelinesTab.tsx:110`, `PresetsPage.tsx:285`) *and* a seeded builtin row `lvl_ask_everything` with zero grants (behaviorally identical in the engine). Every dropdown that renders both shows the duplicate. Fix: NULL becomes the *only* representation — migrate the builtin row away, stop seeding it, and route all four dropdowns through one shared component so this can't regress.

**Files:**
- Create: `src-tauri/migrations/0010_permission_cleanup.sql`
- Create: `src/components/PermissionLevelSelect.tsx`
- Modify: `src-tauri/src/lib.rs` (append migration 10)
- Modify: `src/db/repo/permissions.ts:12-39` (drop the askEverything constant + seed)
- Modify: `src/db/repo/presets.ts:39` (`permissionLevelId: null`)
- Modify: `src/app/chat/ChatPage.tsx:244-282` (LevelDropdown), `src/app/agents/PipelinesTab.tsx:104-117`, `src/app/agents/AutomationsTab.tsx:350-369`, `src/app/presets/PresetsPage.tsx:273-292`
- Test: `src/db/db.test.ts:200-250` (seed + builtin-delete assertions)

**Interfaces:**
- Consumes: `PermissionLevel` from `@/lib/schemas`, `Select` from `@/components/ui/select`.
- Produces: `PermissionLevelSelect({ levels, value, onChange, nullLabel?, className, "aria-label"? })` where `value: string | null`, `onChange: (levelId: string | null) => void`, `nullLabel` defaults to `"Ask everything"`. `BUILTIN_LEVELS` shrinks to `{ readDocuments }` — later tasks must not reference `askEverything`.

- [ ] **Step 1: Write the failing test**

In `src/db/db.test.ts`, find the seed assertion around line 209 (it asserts `"Ask everything"` is among seeded levels) and the builtin-delete test at line 245 (`permissions.deleteLevel(permissions.BUILTIN_LEVELS.askEverything)`). Change them to:

```ts
        // seed test: only Read documents is a builtin row now; "Ask everything" is NULL
        expect(levels.map((l) => l.name)).toEqual(["Read documents"]);
```

```ts
        await expect(
            permissions.deleteLevel(permissions.BUILTIN_LEVELS.readDocuments),
        ).rejects.toThrow(/built-in/);
```

(Adapt to the surrounding test's exact shape — the intent: seeding produces exactly one builtin level named "Read documents", and deleting a builtin still throws.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/db/db.test.ts`
Expected: FAIL — seeded levels still include "Ask everything", and `BUILTIN_LEVELS.askEverything` still typechecks.

- [ ] **Step 3: Create the migration**

Create `src-tauri/migrations/0010_permission_cleanup.sql`:

```sql
-- "Ask everything" existed twice: as permission_level_id = NULL and as a
-- seeded builtin row with zero grants. Dropdowns listed both. NULL is the
-- single representation from now on.

UPDATE presets SET permission_level_id = NULL WHERE permission_level_id = 'lvl_ask_everything';
UPDATE chat_sessions SET permission_level_id = NULL WHERE permission_level_id = 'lvl_ask_everything';
UPDATE automations SET permission_level_id = NULL WHERE permission_level_id = 'lvl_ask_everything';
DELETE FROM permission_grants WHERE level_id = 'lvl_ask_everything';
DELETE FROM permission_levels WHERE id = 'lvl_ask_everything';
```

Append to `src-tauri/src/lib.rs` inside the `vec![…]` (after version 9):

```rust
        Migration {
            version: 10,
            description: "collapse Ask-everything level into NULL",
            sql: include_str!("../migrations/0010_permission_cleanup.sql"),
            kind: MigrationKind::Up,
        },
```

- [ ] **Step 4: Stop seeding it**

In `src/db/repo/permissions.ts`:
- Change the constant (lines 12–16) to:

```ts
/** Stable ids so seeding is idempotent and presets can reference them. */
export const BUILTIN_LEVELS = {
    readDocuments: "lvl_read_documents",
} as const;
```

- In `seedBuiltinLevels()`, delete the first `INSERT OR IGNORE` block (lines 20–29, the one inserting `BUILTIN_LEVELS.askEverything, "Ask everything", …`). Keep the readDocuments insert and its grants.

In `src/db/repo/presets.ts:39` change `permissionLevelId: BUILTIN_LEVELS.askEverything,` to `permissionLevelId: null,`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (the migration runs in testClient automatically; if any other test references `askEverything`, switch it to `readDocuments` or `null` following the same intent).

- [ ] **Step 6: Create the shared dropdown**

Create `src/components/PermissionLevelSelect.tsx`:

```tsx
import { Select } from "@/components/ui/select";
import type { PermissionLevel } from "@/lib/schemas";

/**
 * The one place "no permission level" (null) is rendered as an option.
 * Levels come from the DB; the null option is synthetic — so "Ask everything"
 * can never appear twice again.
 */
export function PermissionLevelSelect({
    levels,
    value,
    onChange,
    nullLabel = "Ask everything",
    className,
    "aria-label": ariaLabel,
}: {
    levels: PermissionLevel[];
    value: string | null;
    onChange: (levelId: string | null) => void;
    /** Automations deny instead of asking — callers override the null copy. */
    nullLabel?: string;
    className?: string;
    "aria-label"?: string;
}) {
    return (
        <Select
            className={className}
            aria-label={ariaLabel}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
        >
            <option value="">{nullLabel}</option>
            {levels.map((l) => (
                <option key={l.id} value={l.id}>
                    {l.name}
                </option>
            ))}
        </Select>
    );
}
```

- [ ] **Step 7: Replace the four dropdowns**

1. `src/app/chat/ChatPage.tsx` — in `LevelDropdown` (lines 268–279), replace the `<Select>…</Select>` with:

```tsx
            <PermissionLevelSelect
                className="h-8 font-mono text-xs normal-case tracking-normal"
                levels={levels}
                value={levelId || null}
                onChange={(id) => void change(id ?? "")}
            />
```

(keep `change` accepting a string: `const change = async (value: string) => …` already maps `"" → null`.) Add the import, remove the now-unused `Select` import if nothing else uses it.

2. `src/app/agents/PipelinesTab.tsx:106-116` — replace the `<Select>` block with:

```tsx
                    <PermissionLevelSelect
                        levels={levels}
                        value={levelId || null}
                        onChange={(id) => setLevelId(id ?? "")}
                    />
```

3. `src/app/agents/AutomationsTab.tsx:353-368` — replace with:

```tsx
                        <PermissionLevelSelect
                            levels={levels}
                            value={form.permissionLevelId}
                            nullLabel="None (deny all tool calls)"
                            onChange={(id) =>
                                setForm({ ...form, permissionLevelId: id })
                            }
                        />
```

4. `src/app/presets/PresetsPage.tsx:276-291` — replace with:

```tsx
                        <PermissionLevelSelect
                            levels={levels}
                            value={form.permissionLevelId}
                            nullLabel="Ask everything (no level)"
                            onChange={(id) =>
                                setForm({ ...form, permissionLevelId: id })
                            }
                        />
```

In each file remove the `Select` import when it becomes unused.

- [ ] **Step 8: Verify**

Run: `npm run typecheck && npm test` → both pass.
Run: `npm run dev` → chat header permission dropdown lists "Ask everything" exactly once, followed by "Read documents" (+ any custom levels). An existing session that had the old builtin level selected shows "Ask everything".

- [ ] **Step 9: Commit**

```bash
git add src-tauri/migrations/0010_permission_cleanup.sql src-tauri/src/lib.rs \
  src/db/repo/permissions.ts src/db/repo/presets.ts src/db/db.test.ts \
  src/components/PermissionLevelSelect.tsx src/app/chat/ChatPage.tsx \
  src/app/agents/PipelinesTab.tsx src/app/agents/AutomationsTab.tsx \
  src/app/presets/PresetsPage.tsx
git commit -m "fix: collapse duplicate Ask-everything level into NULL, shared level select"
```

---

### Task 4: Projects data layer (migration, schema, repo)

**Files:**
- Create: `src-tauri/migrations/0011_projects.sql`
- Create: `src/db/repo/projects.ts`
- Test: `src/db/repo/projects.test.ts`
- Modify: `src-tauri/src/lib.rs` (append migration 11), `src/lib/schemas.ts`

**Interfaces:**
- Produces (used by every later task):
  - `projectSchema` / `type Project = { id; name; description: string|null; color: string|null; created_at; updated_at }`
  - `chatSessionSchema` gains `project_id: string|null`, `color: string|null`
  - `documentSchema`, `bookmarkSchema`, `automationSchema` gain `project_id: string|null`
  - `snippetSchema` gains `group_name: string`
  - Repo: `createProject({name, description?, color?})`, `getProject(id)`, `listProjects()`, `updateProject(id, {name?, description?, color?})`, `deleteProject(id)`, `projectCounts(id): Promise<ProjectCounts>` with `ProjectCounts = { sessions: number; documents: number; bookmarks: number; automations: number }`

- [ ] **Step 1: Write the failing test**

Create `src/db/repo/projects.test.ts`:

```ts
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb, getDb } from "@/db/client";
import {
    createProject,
    deleteProject,
    getProject,
    listProjects,
    projectCounts,
    updateProject,
} from "./projects";
import { createSession, getSession, listSessions } from "./sessions";
import { createBookmark, listBookmarks } from "./library";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

describe("projects repo", () => {
    it("creates, lists, and updates projects", async () => {
        const p = await createProject({ name: "Thesis", color: "#22d3ee" });
        expect(p.name).toBe("Thesis");
        expect(p.color).toBe("#22d3ee");
        expect((await listProjects()).map((x) => x.id)).toEqual([p.id]);

        const updated = await updateProject(p.id, { description: "senior design" });
        expect(updated.description).toBe("senior design");
        expect(updated.name).toBe("Thesis");
    });

    it("rejects empty names and missing ids", async () => {
        await expect(createProject({ name: "  " })).rejects.toThrow(/name/);
        await expect(getProject("prj_missing")).rejects.toThrow(/not found/);
    });

    it("counts grouped rows and unfiles them on delete", async () => {
        const p = await createProject({ name: "Job hunt" });
        const s = await createSession({ title: "resume chat", projectId: p.id });
        await createBookmark({
            title: "Greenhouse",
            url: "https://greenhouse.io",
            projectId: p.id,
        });
        await getDb().execute(
            "INSERT INTO documents (id, title, mime_type, folder, content_text, created_at, project_id) VALUES ('doc_1', 'Resume', 'application/pdf', '/projects/job-hunt', 'text', 0, ?)",
            [p.id],
        );

        expect(await projectCounts(p.id)).toEqual({
            sessions: 1,
            documents: 1,
            bookmarks: 1,
            automations: 0,
        });

        await deleteProject(p.id);
        expect(await listProjects()).toEqual([]);
        // Grouped rows survive, unfiled.
        expect((await getSession(s.id)).project_id).toBeNull();
        expect((await listBookmarks())[0]!.project_id).toBeNull();
        expect(await listSessions()).toHaveLength(1);
    });
});
```

(This test also drives the Task 5 signatures `createSession({projectId})` / `createBookmark({projectId})` — implement the minimal column pass-through here, full filters in Task 5.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/db/repo/projects.test.ts`
Expected: FAIL — module `./projects` does not exist.

- [ ] **Step 3: Create the migration + register it**

Create `src-tauri/migrations/0011_projects.sql`:

```sql
-- Projects group chats, files (documents), bookmarks, and automations.
-- Also: per-chat custom color, snippet groups for category filtering.

CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

ALTER TABLE chat_sessions ADD COLUMN project_id TEXT REFERENCES projects(id);
ALTER TABLE chat_sessions ADD COLUMN color TEXT;
ALTER TABLE documents ADD COLUMN project_id TEXT REFERENCES projects(id);
ALTER TABLE bookmarks ADD COLUMN project_id TEXT REFERENCES projects(id);
ALTER TABLE automations ADD COLUMN project_id TEXT REFERENCES projects(id);
ALTER TABLE snippets ADD COLUMN group_name TEXT NOT NULL DEFAULT 'General';
```

Append to `src-tauri/src/lib.rs`:

```rust
        Migration {
            version: 11,
            description: "projects + project_id/color/group columns",
            sql: include_str!("../migrations/0011_projects.sql"),
            kind: MigrationKind::Up,
        },
```

- [ ] **Step 4: Mirror in schemas.ts**

Add after `snippetSchema` (end of file):

```ts
export const projectSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    color: z.string().nullable(),
    created_at: z.number(),
    updated_at: z.number(),
});
export type Project = z.infer<typeof projectSchema>;
```

And add the new columns to existing schemas:
- `chatSessionSchema`: `project_id: z.string().nullable(),` and `color: z.string().nullable(),` (after `permission_level_id`)
- `documentSchema`, `bookmarkSchema`, `automationSchema`: `project_id: z.string().nullable(),`
- `snippetSchema`: `group_name: z.string(),`

- [ ] **Step 5: Write the repo**

Create `src/db/repo/projects.ts`:

```ts
import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { projectSchema, type Project } from "@/lib/schemas";

export async function createProject(input: {
    name: string;
    description?: string | null;
    color?: string | null;
}): Promise<Project> {
    const name = input.name.trim();
    if (!name) throw new Error("project needs a name");
    const id = newId("prj");
    const t = now();
    await getDb().execute(
        `INSERT INTO projects (id, name, description, color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, name, input.description ?? null, input.color ?? null, t, t],
    );
    return getProject(id);
}

export async function getProject(id: string): Promise<Project> {
    const rows = await getDb().select("SELECT * FROM projects WHERE id = ?", [id]);
    if (!rows[0]) throw new Error(`project not found: ${id}`);
    return projectSchema.parse(rows[0]);
}

export async function listProjects(): Promise<Project[]> {
    const rows = await getDb().select(
        "SELECT * FROM projects ORDER BY updated_at DESC",
    );
    return rows.map((r) => projectSchema.parse(r));
}

export async function updateProject(
    id: string,
    input: { name?: string; description?: string | null; color?: string | null },
): Promise<Project> {
    const cur = await getProject(id);
    await getDb().execute(
        "UPDATE projects SET name = ?, description = ?, color = ?, updated_at = ? WHERE id = ?",
        [
            input.name?.trim() || cur.name,
            input.description === undefined ? cur.description : input.description,
            input.color === undefined ? cur.color : input.color,
            now(),
            id,
        ],
    );
    return getProject(id);
}

/**
 * Unfiles everything the project grouped, then removes it. Explicit UPDATEs
 * (not FK cascades) so tauri, wasm, and better-sqlite3 clients behave the same.
 */
export async function deleteProject(id: string): Promise<void> {
    const db = getDb();
    for (const table of ["chat_sessions", "documents", "bookmarks", "automations"]) {
        await db.execute(
            `UPDATE ${table} SET project_id = NULL WHERE project_id = ?`,
            [id],
        );
    }
    await db.execute("DELETE FROM projects WHERE id = ?", [id]);
}

export interface ProjectCounts {
    sessions: number;
    documents: number;
    bookmarks: number;
    automations: number;
}

export async function projectCounts(id: string): Promise<ProjectCounts> {
    const rows = await getDb().select<ProjectCounts>(
        `SELECT
            (SELECT COUNT(*) FROM chat_sessions WHERE project_id = ?) AS sessions,
            (SELECT COUNT(*) FROM documents WHERE project_id = ?) AS documents,
            (SELECT COUNT(*) FROM bookmarks WHERE project_id = ?) AS bookmarks,
            (SELECT COUNT(*) FROM automations WHERE project_id = ?) AS automations`,
        [id, id, id, id],
    );
    if (!rows[0]) throw new Error(`counts query returned no row for ${id}`);
    return rows[0];
}
```

Minimal pass-throughs the test needs (full versions in Task 5):
- `src/db/repo/sessions.ts` `createSession` opts gain `projectId?: string | null`; the INSERT becomes `INSERT INTO chat_sessions (id, title, preset_id, permission_level_id, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)` with `opts.projectId ?? null` as the fifth param.
- `src/db/repo/library.ts` `createBookmark` input gains `projectId?: string | null`; INSERT becomes `INSERT INTO bookmarks (id, title, url, group_name, project_id, created_at) VALUES (?, ?, ?, ?, ?, ?)` with `input.projectId ?? null`.

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: PASS — new suite green, all existing suites still green (schema additions are non-breaking; `z.object` tolerates the new columns everywhere else).

- [ ] **Step 7: Commit**

```bash
git add src-tauri/migrations/0011_projects.sql src-tauri/src/lib.rs \
  src/lib/schemas.ts src/db/repo/projects.ts src/db/repo/projects.test.ts \
  src/db/repo/sessions.ts src/db/repo/library.ts
git commit -m "feat: projects table + project/color/group columns + projects repo"
```

---

### Task 5: Repo extensions (sessions, library, documents, automations)

**Files:**
- Modify: `src/db/repo/sessions.ts`, `src/db/repo/library.ts`, `src/db/repo/documents.ts:5-32`, `src/db/repo/automations.ts`
- Test: `src/db/repo/library.test.ts`, `src/db/repo/projects.test.ts` (extend)

**Interfaces:**
- Produces (exact signatures later tasks call):
  - `sessions`: `setSessionColor(id: string, color: string | null): Promise<void>`, `setSessionProject(id: string, projectId: string | null): Promise<void>`, `listSessions(filter?: { projectId?: string }): Promise<ChatSession[]>` (no filter → all sessions; `projectId` → only that project's)
  - `library`: `listBookmarks(filter?: { projectId?: string | null }): Promise<Bookmark[]>` (`null` → unfiled only; `string` → that project; omitted → all), `updateBookmark(id: string, input: { title: string; url: string; groupName: string; projectId: string | null }): Promise<void>`, `createSnippet({ title, body, groupName? })`, `updateSnippet(id, { title, body, groupName })`
  - `documents`: `insertDocument` opts gain `projectId?: string | null`; new `listProjectDocuments(projectId: string): Promise<Document[]>` (metadata only, `'' AS content_text` like `listDocuments`)
  - `automations`: `listAutomations` gains optional `{ projectId?: string }` filter; `createAutomation`/update accept `projectId?: string | null` (follow the file's existing input shape)

- [ ] **Step 1: Write the failing tests**

Extend `src/db/repo/library.test.ts` with:

```ts
    it("filters bookmarks by project and edits in place", async () => {
        const kept = await createBookmark({
            title: "Docs",
            url: "https://a.dev",
        });
        await updateBookmark(kept.id, {
            title: "API Docs",
            url: "https://a.dev/api",
            groupName: "Reference",
            projectId: null,
        });
        const all = await listBookmarks();
        expect(all[0]!.title).toBe("API Docs");
        expect(all[0]!.group_name).toBe("Reference");
    });

    it("snippets carry groups", async () => {
        const s = await createSnippet({
            title: "greeting",
            body: "hello",
            groupName: "Email",
        });
        expect(s.group_name).toBe("Email");
        await updateSnippet(s.id, { title: "greeting", body: "hi", groupName: "Chat" });
        expect((await listSnippets())[0]!.group_name).toBe("Chat");
    });
```

Extend `src/db/repo/projects.test.ts` with:

```ts
    it("filters sessions by project and recolors them", async () => {
        const p = await createProject({ name: "P" });
        const inProj = await createSession({ title: "a", projectId: p.id });
        await createSession({ title: "b" });

        expect((await listSessions({ projectId: p.id })).map((s) => s.id)).toEqual([
            inProj.id,
        ]);
        expect(await listSessions()).toHaveLength(2);

        await setSessionColor(inProj.id, "#f472b6");
        expect((await getSession(inProj.id)).color).toBe("#f472b6");
        await setSessionProject(inProj.id, null);
        expect(await listSessions({ projectId: p.id })).toEqual([]);
    });
```

(Add the new imports at the top of each test file.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/db/repo/library.test.ts src/db/repo/projects.test.ts`
Expected: FAIL — `updateBookmark`, `setSessionColor`, etc. don't exist.

- [ ] **Step 3: Implement**

`src/db/repo/sessions.ts` — replace `listSessions` and append:

```ts
export async function listSessions(filter?: {
    projectId?: string;
}): Promise<ChatSession[]> {
    const rows = filter?.projectId
        ? await getDb().select(
              "SELECT * FROM chat_sessions WHERE project_id = ? ORDER BY updated_at DESC",
              [filter.projectId],
          )
        : await getDb().select(
              "SELECT * FROM chat_sessions ORDER BY updated_at DESC",
          );
    return rows.map((r) => chatSessionSchema.parse(r));
}

export async function setSessionColor(
    id: string,
    color: string | null,
): Promise<void> {
    await getDb().execute(
        "UPDATE chat_sessions SET color = ?, updated_at = ? WHERE id = ?",
        [color, now(), id],
    );
}

export async function setSessionProject(
    id: string,
    projectId: string | null,
): Promise<void> {
    await getDb().execute(
        "UPDATE chat_sessions SET project_id = ?, updated_at = ? WHERE id = ?",
        [projectId, now(), id],
    );
}
```

`src/db/repo/library.ts` — replace `listBookmarks`, add `updateBookmark`, extend snippets:

```ts
export async function listBookmarks(filter?: {
    /** null → unfiled only; string → that project's; omitted → all. */
    projectId?: string | null;
}): Promise<Bookmark[]> {
    let rows;
    if (filter?.projectId === undefined) {
        rows = await getDb().select(
            "SELECT * FROM bookmarks ORDER BY group_name ASC, title ASC",
        );
    } else if (filter.projectId === null) {
        rows = await getDb().select(
            "SELECT * FROM bookmarks WHERE project_id IS NULL ORDER BY group_name ASC, title ASC",
        );
    } else {
        rows = await getDb().select(
            "SELECT * FROM bookmarks WHERE project_id = ? ORDER BY group_name ASC, title ASC",
            [filter.projectId],
        );
    }
    return rows.map((r) => bookmarkSchema.parse(r));
}

export async function updateBookmark(
    id: string,
    input: {
        title: string;
        url: string;
        groupName: string;
        projectId: string | null;
    },
): Promise<void> {
    const res = await getDb().execute(
        "UPDATE bookmarks SET title = ?, url = ?, group_name = ?, project_id = ? WHERE id = ?",
        [input.title, input.url, input.groupName || "General", input.projectId, id],
    );
    if (res.rowsAffected === 0) throw new Error(`bookmark not found: ${id}`);
}
```

Snippets: `createSnippet` input gains `groupName?: string` (INSERT gains `group_name` with `input.groupName ?? "General"`); `updateSnippet` input gains `groupName: string` (SET adds `group_name = ?`); `listSnippets` ORDER BY becomes `group_name ASC, title ASC`.

`src/db/repo/documents.ts` — `insertDocument` opts gain `projectId?: string | null`; add `project_id` to the INSERT column list with `opts.projectId ?? null`. Append:

```ts
/** Metadata-only listing for a project's Files panel. */
export async function listProjectDocuments(projectId: string): Promise<Document[]> {
    const rows = await getDb().select(
        `SELECT id, title, source_name, mime_type, folder, '' AS content_text,
                byte_size, page_count, project_id, created_at
         FROM documents WHERE project_id = ? ORDER BY created_at DESC`,
        [projectId],
    );
    return rows.map((r) => documentSchema.parse(r));
}
```

(Also add `project_id` to the column list in the existing `listDocuments` SELECT at line 46 so its rows still parse.)

`src/db/repo/automations.ts` — mirror the pattern: create/update inputs gain `projectId?: string | null` (column `project_id` in INSERT/UPDATE), `listAutomations` gains optional `{ projectId?: string }` WHERE filter, matching the file's existing conventions.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/repo/sessions.ts src/db/repo/library.ts src/db/repo/documents.ts \
  src/db/repo/automations.ts src/db/repo/library.test.ts src/db/repo/projects.test.ts
git commit -m "feat: project filters + colors + bookmark/snippet editing in repos"
```

---

### Task 6: Chat customization — rename + recolor

`renameSession`/`setSessionColor` exist; give them UI in the instances sidebar, and make every color consumer honor the stored color.

**Files:**
- Modify: `src/components/hud/networkData.ts:82-100` (`sessionColor` signature), `src/app/chat/InstancesSidebar.tsx`, `src/app/chat/ChatPage.tsx`

**Interfaces:**
- Produces: `sessionColor(session: ChatSession, preset: Preset | undefined, agentsById: Map<string, AgentDef>): string` — stored `session.color` wins, then single-specialist hue, then orchestrator.
- `InstancesSidebar` gains props `onRename: (session: ChatSession, title: string) => void` and `onRecolor: (session: ChatSession, color: string | null) => void`.

- [ ] **Step 1: Update `sessionColor`**

In `networkData.ts` replace the function (lines 83–91):

```ts
/** A session's identity color: user-chosen, else its lone specialist, else orchestrator. */
export function sessionColor(
    session: ChatSession,
    preset: Preset | undefined,
    agentsById: Map<string, AgentDef>,
): string {
    if (session.color) return session.color;
    if (!preset) return "var(--primary)";
    const ids = safeAgents(preset);
    const def = ids.length === 1 ? agentsById.get(ids[0]!) : undefined;
    return def ? agentInfo(def).color : ORCHESTRATOR;
}
```

Update its two call sites: `buildSessionNetwork` (line 199: `color: sessionColor(session, preset, agentsById),`) and both uses in `InstancesSidebar.tsx` (lines 105–110 and 157: pass the session first). Import `ChatSession` type where needed.

- [ ] **Step 2: Add rename + recolor UI to the sidebar**

In `InstancesSidebar.tsx`:
- Add props `onRename` and `onRecolor` (signatures above) to the component's prop type and destructuring.
- Add state: `const [renamingId, setRenamingId] = useState<string | null>(null);` and `const [draftTitle, setDraftTitle] = useState("");`
- Add a constant above the component:

```ts
/** Swatches for user recoloring — the agent identity hues plus neutrals. */
export const SESSION_COLORS = [
    "#22d3ee", "#a78bfa", "#f472b6", "#fb923c",
    "#facc15", "#4ade80", "#60a5fa", "#f87171",
] as const;
```

- In the row (next to the existing delete `IconButton`, line ~224), add:

```tsx
                                        <IconButton
                                            label="Rename chat"
                                            onClick={() => {
                                                setRenamingId(s.id);
                                                setDraftTitle(s.title);
                                            }}
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </IconButton>
```

(import `Pencil` from lucide-react.)

- When `renamingId === s.id`, render this instead of the title button (the `<button onClick={() => onOpen(s)}>` block, lines 189–201):

```tsx
                                <input
                                    autoFocus
                                    value={draftTitle}
                                    onChange={(e) => setDraftTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            onRename(s, draftTitle.trim() || s.title);
                                            setRenamingId(null);
                                        }
                                        if (e.key === "Escape") setRenamingId(null);
                                    }}
                                    onBlur={() => {
                                        onRename(s, draftTitle.trim() || s.title);
                                        setRenamingId(null);
                                    }}
                                    className="min-w-0 flex-1 rounded-sm border border-primary/40 bg-transparent px-1 py-0.5 text-xs focus-visible:outline-none"
                                />
```

- In the expanded details panel (after the "Updated" `<Detail>`, line ~292), add an appearance row:

```tsx
                                    <Detail label="Color">
                                        <div className="flex flex-wrap justify-end gap-1">
                                            {SESSION_COLORS.map((c) => (
                                                <button
                                                    key={c}
                                                    aria-label={`Set color ${c}`}
                                                    onClick={() => onRecolor(s, c)}
                                                    className={cn(
                                                        "h-3.5 w-3.5 cursor-pointer rounded-full border border-transparent hover:scale-110",
                                                        s.color === c &&
                                                            "ring-1 ring-foreground/60",
                                                    )}
                                                    style={{ background: c }}
                                                />
                                            ))}
                                            <button
                                                aria-label="Automatic color"
                                                onClick={() => onRecolor(s, null)}
                                                className="rounded-sm px-1 font-mono text-[9px] uppercase text-muted-foreground hover:text-foreground"
                                            >
                                                auto
                                            </button>
                                        </div>
                                    </Detail>
```

- [ ] **Step 3: Wire the callbacks in ChatPage**

In `ChatPage.tsx` add next to `deleteInstance`:

```ts
    const renameInstance = useCallback(
        async (session: ChatSession, title: string) => {
            if (title === session.title) return;
            await sessionsRepo.renameSession(session.id, title);
            setSessions(await sessionsRepo.listSessions());
            setActive((cur) =>
                cur?.session.id === session.id
                    ? { ...cur, session: { ...cur.session, title } }
                    : cur,
            );
        },
        [],
    );

    const recolorInstance = useCallback(
        async (session: ChatSession, color: string | null) => {
            await sessionsRepo.setSessionColor(session.id, color);
            setSessions(await sessionsRepo.listSessions());
        },
        [],
    );
```

and pass `onRename={(s, t) => void renameInstance(s, t)}` and `onRecolor={(s, c) => void recolorInstance(s, c)}` to `<InstancesSidebar …>`.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm test` → pass.
Run: `npm run dev` → rename a chat (Enter commits, Escape cancels), pick a swatch (dot, sphere node, and collapsed-rail dot all adopt it), "auto" reverts to the preset-derived hue.

- [ ] **Step 5: Commit**

```bash
git add src/components/hud/networkData.ts src/app/chat/InstancesSidebar.tsx src/app/chat/ChatPage.tsx
git commit -m "feat: rename and recolor chats from the instances sidebar"
```

---

### Task 7: FilterChips component + task category filter

**Files:**
- Create: `src/components/ui/filterChips.tsx`
- Modify: `src/app/tasks/TasksPage.tsx` (task list filtering; also de-studentify its copy while here)

**Interfaces:**
- Produces: `FilterChips({ options, active, onChange, allLabel? })` with `options: { id: string; label: string; color?: string }[]`, `active: string | null`, `onChange: (id: string | null) => void`. Renders nothing when `options.length === 0` (so single-category users never see chrome).

- [ ] **Step 1: Create the component**

`src/components/ui/filterChips.tsx`:

```tsx
import { cn } from "@/lib/utils";

export interface FilterOption {
    id: string;
    label: string;
    color?: string;
}

/**
 * One-tap category filter row: "All" plus one chip per option.
 * Renders nothing when there are no options — no chrome for empty categories.
 */
export function FilterChips({
    options,
    active,
    onChange,
    allLabel = "All",
}: {
    options: FilterOption[];
    active: string | null;
    onChange: (id: string | null) => void;
    allLabel?: string;
}) {
    if (options.length === 0) return null;
    const chip = (selected: boolean, color?: string) =>
        cn(
            "cursor-pointer rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-ring",
            selected
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            selected && color && "text-[inherit]",
        );
    return (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter">
            <button className={chip(active === null)} onClick={() => onChange(null)}>
                {allLabel}
            </button>
            {options.map((o) => (
                <button
                    key={o.id}
                    className={chip(active === o.id, o.color)}
                    style={
                        active === o.id && o.color
                            ? {
                                  color: o.color,
                                  borderColor: `color-mix(in oklab, ${o.color} 50%, transparent)`,
                                  background: `color-mix(in oklab, ${o.color} 12%, transparent)`,
                              }
                            : undefined
                    }
                    onClick={() => onChange(active === o.id ? null : o.id)}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Apply to tasks**

In `TasksPage.tsx`:
- Add state `const [courseFilter, setCourseFilter] = useState<string | null>(null);` in `TasksPage`.
- Between `<QuickAdd …/>` and `<TaskList …/>` insert:

```tsx
                <FilterChips
                    options={courses.map((c) => ({
                        id: c.id,
                        label: c.code,
                        color: c.color ?? undefined,
                    }))}
                    active={courseFilter}
                    onChange={setCourseFilter}
                />
```

- Pass filtered tasks: `<TaskList tasks={courseFilter ? tasks.filter((t) => t.course_id === courseFilter) : tasks} …/>`.
- Copy de-studentification in the same file: header subtitle `"Assignments, follow-ups, and the class schedule — also readable by the planner agent."` → `"Everything with a deadline — also readable by the planner agent."`; QuickAdd placeholder `"e.g. ECE 437 lab 3 report"` → `"e.g. Ship the quarterly report"`; wrap the Course `<label>` in `{courses.length > 0 && (…)}` so users with no courses never see it.

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm test` → pass.
Run: `npm run dev` → with ≥1 course: chips appear, clicking filters, clicking again clears; with 0 courses: no chips, no Course select.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/filterChips.tsx src/app/tasks/TasksPage.tsx
git commit -m "feat: FilterChips component + course filter on tasks, general-audience copy"
```

---

### Task 8: Notes section — Notes | Bookmarks | Snippets tabs (+ NavTarget plumbing)

Two things land here because the second needs the first consumer: (a) the shared `TabBar` + `NavTarget` navigation pattern, (b) the Library merge into Notes with filtering and editing.

**Files:**
- Create: `src/components/ui/tabs.tsx`, `src/app/notes/BookmarksTab.tsx`, `src/app/notes/SnippetsTab.tsx`
- Modify: `src/app/notes/NotesPage.tsx`, `src/app/Sidebar.tsx` (Page/NavTarget types), `src/app/Shell.tsx`, `src/components/palette/CommandPalette.tsx`
- Delete: `src/app/library/LibraryPage.tsx`

**Interfaces:**
- Produces:
  - `src/components/ui/tabs.tsx`: `TabBar<T extends string>({ tabs, active, onSelect }: { tabs: { id: T; label: string }[]; active: T; onSelect: (t: T) => void })` — exact JSX of `AgentsPage.tsx`'s local `TabBar` (lines 49–69), generic over the id type.
  - `Sidebar.tsx`: `export interface NavTarget { page: Page; tab?: string }` and `Page` loses `"library"`.
  - `Shell.tsx`: nav state is `useState<NavTarget>({ page: "home" })`; `CommandPalette` prop becomes `onNavigate: (t: NavTarget) => void`; section pages accept `tab?: string`.
  - `NotesPage({ tab }: { tab?: string })` with tabs `"notes" | "bookmarks" | "snippets"`; syncs via `useEffect` when the `tab` prop changes.

- [ ] **Step 1: Extract the shared TabBar**

Create `src/components/ui/tabs.tsx` by lifting `TabBar` from `AgentsPage.tsx:49-69` verbatim, made generic:

```tsx
import { cn } from "@/lib/utils";

export function TabBar<T extends string>({
    tabs,
    active,
    onSelect,
}: {
    tabs: { id: T; label: string }[];
    active: T;
    onSelect: (t: T) => void;
}) {
    return (
        <div className="flex gap-1 border-b border-border">
            {tabs.map((t) => (
                <button
                    key={t.id}
                    onClick={() => onSelect(t.id)}
                    aria-current={active === t.id ? "page" : undefined}
                    className={cn(
                        "cursor-pointer border-b-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-ring",
                        active === t.id
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                >
                    {t.label}
                </button>
            ))}
        </div>
    );
}
```

Update `AgentsPage.tsx` to import it and delete its local copy (its call site changes from `tab=`/`onSelect=` to `tabs={TABS} active={tab} onSelect={setTab}`).

- [ ] **Step 2: Introduce NavTarget**

In `Sidebar.tsx`: remove `"library"` from `Page`; add `export interface NavTarget { page: Page; tab?: string }`. Remove the Library nav item (line 52) and the now-unused `Bookmark` icon import.

In `Shell.tsx`:

```tsx
    const [nav, setNav] = useState<NavTarget>({ page: "home" });
```

- Remove `library: LibraryPage` from `PAGES` and its import; delete `src/app/library/LibraryPage.tsx` (`git rm`).
- Render with tab pass-through — replace `const Active = PAGES[page];` and the `<Active />` usage:

```tsx
    const Active = PAGES[nav.page];
    …
                        <motion.div key={nav.page} …>
                            {nav.page === "notes" ? (
                                <NotesPage tab={nav.tab} />
                            ) : (
                                <Active />
                            )}
                        </motion.div>
```

- `Sidebar` gets `onNavigate={(p) => setNav({ page: p })}`; `CommandPalette` gets `onNavigate={setNav}`.

In `CommandPalette.tsx`: change `NAV` to `{ target: NavTarget; label: string }[]`, replacing the `library` row:

```ts
const NAV: { target: NavTarget; label: string }[] = [
    { target: { page: "home" }, label: "Home" },
    { target: { page: "chat" }, label: "Chat" },
    { target: { page: "agents" }, label: "Agents" },
    { target: { page: "notes" }, label: "Notes" },
    { target: { page: "notes", tab: "bookmarks" }, label: "Bookmarks" },
    { target: { page: "notes", tab: "snippets" }, label: "Snippets" },
    { target: { page: "tasks" }, label: "Tasks" },
    { target: { page: "applications" }, label: "Applications" },
    { target: { page: "review" }, label: "Review" },
    { target: { page: "presets" }, label: "Presets" },
    { target: { page: "permissions" }, label: "Permissions" },
    { target: { page: "settings" }, label: "Settings" },
];
```

and update `go`/`onSelect` accordingly (`onNavigate(n.target)`).

- [ ] **Step 3: Build the Bookmarks and Snippets tabs**

Create `src/app/notes/BookmarksTab.tsx`: move `BookmarksCard` from `LibraryPage.tsx` and upgrade it:
- Load `projects` via `listProjects()` alongside bookmarks (`useEffect` + `reload`).
- Above the list: `<FilterChips options={filterOptions} active={filter} onChange={setFilter} />` where `filterOptions` = each distinct `group_name` (`id: `grp:${g}``) followed by each project (`id: `prj:${p.id}``, `color: p.color ?? undefined`).
- Filter predicate:

```ts
    const visible = bookmarks.filter((b) => {
        if (!filter) return true;
        if (filter.startsWith("grp:")) return b.group_name === filter.slice(4);
        return b.project_id === filter.slice(4);
    });
```

- Each row gains a `Pencil` icon button that swaps the row into edit mode (Inputs for title/url/group + a project `<Select>` of `projects` with a "No project" option), committing via `lib.updateBookmark(b.id, { title, url, groupName, projectId })` on save. A bookmark with a `project_id` shows the project name as a small colored chip.
- The add form (title/url/group inputs, unchanged behavior) gains a project `<Select>` (default "No project") passed to `createBookmark`; the default group state `"School"` becomes `"General"`.

Create `src/app/notes/SnippetsTab.tsx`: move `SnippetsCard` similarly:
- Add form gains a `Group` input (default `"General"`) → `createSnippet({ title, body, groupName })`.
- `<FilterChips>` over distinct `group_name`s.
- Pencil button → inline edit (title/body/group) committing via `updateSnippet(s.id, { title, body, groupName })`.

Both files keep the observatory look: reuse `Card`, `Input`, `Button`, mono uppercase group headers, exactly as in `LibraryPage.tsx`.

- [ ] **Step 4: Tab-ify NotesPage**

Rework `NotesPage.tsx`'s outer shell (the note list/editor split stays exactly as-is, it just becomes the `"notes"` tab):

```tsx
type NotesTab = "notes" | "bookmarks" | "snippets";
const TABS: { id: NotesTab; label: string }[] = [
    { id: "notes", label: "Notes" },
    { id: "bookmarks", label: "Bookmarks" },
    { id: "snippets", label: "Snippets" },
];
const isTab = (t: string | undefined): t is NotesTab =>
    t === "notes" || t === "bookmarks" || t === "snippets";

export function NotesPage({ tab }: { tab?: string }) {
    const [active, setActive] = useState<NotesTab>(isTab(tab) ? tab : "notes");
    useEffect(() => {
        if (isTab(tab)) setActive(tab);
    }, [tab]);

    return (
        <div className="flex h-full flex-col">
            <div className="px-6 pt-4">
                <TabBar tabs={TABS} active={active} onSelect={setActive} />
            </div>
            {active === "notes" ? (
                <div className="min-h-0 flex-1">{/* existing list+editor JSX */}</div>
            ) : (
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                    <div className="mx-auto flex max-w-3xl flex-col gap-6">
                        {active === "bookmarks" ? <BookmarksTab /> : <SnippetsTab />}
                    </div>
                </div>
            )}
        </div>
    );
}
```

(The former `LibraryPage` header copy "all reachable from ⌘K" moves into a one-line `<p>` above the cards in each tab.)

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm test` → pass (palette search of library items still works — `searchLibrary` is untouched; update the palette's library-hit navigation, if it navigated to the `library` page, to `{ page: "notes", tab: hit.kind === "bookmark" ? "bookmarks" : "snippets" }`).
Run: `npm run dev` → Notes shows three tabs; ⌘K "Bookmarks" lands on the right tab; add/edit/delete/filter bookmarks and snippets all work; Library is gone from the sidebar.

- [ ] **Step 6: Commit**

```bash
git add -A src/app/notes src/app/library src/components/ui/tabs.tsx \
  src/app/Sidebar.tsx src/app/Shell.tsx src/components/palette/CommandPalette.tsx \
  src/app/agents/AgentsPage.tsx
git commit -m "feat: fold Library into Notes as Bookmarks/Snippets tabs with filters"
```

---

### Task 9: Planner section — Tasks | Calendar | Applications | Review

One deadline-oriented section replaces three top-level pages; courses live inside the Calendar tab (still fully functional, no longer "out of the box" prominent).

**Files:**
- Create: `src/app/planner/PlannerPage.tsx`, `src/app/planner/CalendarTab.tsx`
- Move: `git mv src/app/tasks/TasksPage.tsx src/app/planner/TasksTab.tsx`, `git mv src/app/applications/ApplicationsPage.tsx src/app/planner/ApplicationsTab.tsx`, `git mv src/app/review/ReviewPage.tsx src/app/planner/ReviewTab.tsx` (then `rmdir` the empty dirs)
- Modify: `src/app/Shell.tsx`, `src/app/Sidebar.tsx`, `src/components/palette/CommandPalette.tsx`, `src/app/home/HomePage.tsx` (copy)

**Interfaces:**
- Produces: `PlannerPage({ tab }: { tab?: string })` with tabs `"tasks" | "calendar" | "applications" | "review"`. Tab components export `TasksTab()`, `CalendarTab()`, `ApplicationsTab()`, `ReviewTab()` — each is the old page body **without** its own `h-full overflow-y-auto p-6` wrapper and `<header>` (PlannerPage owns scroll + header).
- `Page` becomes `"home" | "chat" | "agents" | "notes" | "planner" | "presets" | "permissions" | "settings"` (this task removes `tasks`/`applications`/`review`).

- [ ] **Step 1: Split TasksTab / CalendarTab**

In the moved `TasksTab.tsx`:
- Rename the export to `TasksTab`; delete the outer `<div className="h-full overflow-y-auto p-6">`/`max-w-3xl` wrapper and `<header>` — return a `<div className="flex flex-col gap-6">` containing error line, `QuickAdd`, `FilterChips`, `TaskList`.
- Move `WeekEvents` (lines 223–268) and `CoursesPanel` (lines 270–415) plus their imports (`listEventsBetween`, `coursesRepo`, `importClassSchedule`, `Upload`, `Card*`) into the new `CalendarTab.tsx`:

```tsx
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
```

- `TasksTab` keeps loading courses (QuickAdd's optional Course select + chips need them) but drops the events load.
- Copy changes while splitting: `WeekEvents` empty text `"No events. Import a class schedule below."` → `"No events this week. Import a schedule below."`; `CoursesPanel` subtitle stays (it explains the folder-scope mechanic) but retitle the card `"Courses & schedules"`.

- [ ] **Step 2: Tab-ify Applications and Review**

In the moved `ApplicationsTab.tsx` / `ReviewTab.tsx`: rename exports to `ApplicationsTab` / `ReviewTab`, strip each file's outer scroll wrapper + `<header>` block (keep everything else byte-identical).

- [ ] **Step 3: Create PlannerPage**

`src/app/planner/PlannerPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { TabBar } from "@/components/ui/tabs";
import { TasksTab } from "./TasksTab";
import { CalendarTab } from "./CalendarTab";
import { ApplicationsTab } from "./ApplicationsTab";
import { ReviewTab } from "./ReviewTab";

type PlannerTab = "tasks" | "calendar" | "applications" | "review";
const TABS: { id: PlannerTab; label: string }[] = [
    { id: "tasks", label: "Tasks" },
    { id: "calendar", label: "Calendar" },
    { id: "applications", label: "Applications" },
    { id: "review", label: "Review" },
];
const isTab = (t: string | undefined): t is PlannerTab =>
    TABS.some((x) => x.id === t);

export function PlannerPage({ tab }: { tab?: string }) {
    const [active, setActive] = useState<PlannerTab>(isTab(tab) ? tab : "tasks");
    useEffect(() => {
        if (isTab(tab)) setActive(tab);
    }, [tab]);

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
                <header>
                    <h1 className="font-display text-2xl font-semibold tracking-wide">
                        Planner
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Deadlines, schedules, applications, and reviews — one
                        ephemeris for everything time-shaped.
                    </p>
                </header>
                <TabBar tabs={TABS} active={active} onSelect={setActive} />
                {active === "tasks" && <TasksTab />}
                {active === "calendar" && <CalendarTab />}
                {active === "applications" && <ApplicationsTab />}
                {active === "review" && <ReviewTab />}
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Rewire Shell/Sidebar/palette**

- `Sidebar.tsx`: `Page` drops `tasks | applications | review`, gains `planner`. Workspace section items become Notes (`NotebookPen`) and Planner (`CalendarCheck`); drop the `Briefcase`/`GraduationCap` imports.
- `Shell.tsx`: `PAGES` swaps the three entries for `planner: PlannerPage`; the tab pass-through conditional gains `nav.page === "planner" ? <PlannerPage tab={nav.tab} /> :`.
- `CommandPalette.tsx` `NAV` rows for tasks/applications/review become:

```ts
    { target: { page: "planner", tab: "tasks" }, label: "Tasks" },
    { target: { page: "planner", tab: "calendar" }, label: "Calendar" },
    { target: { page: "planner", tab: "applications" }, label: "Applications" },
    { target: { page: "planner", tab: "review" }, label: "Review" },
```

- `HomePage.tsx` copy: `"No classes today."` (line 158) → `"Nothing scheduled today."`; `"Nothing due. Suspicious — check the Tasks page."` → `"Nothing due. Suspicious — check the Planner."`.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm test` → pass.
Run: `npm run dev` → Planner shows four tabs; ⌘K "Calendar" deep-links; ICS import, flashcard review, application pipeline all behave as before; sidebar has 3+3+3 entries max.

- [ ] **Step 6: Commit**

```bash
git add -A src/app/planner src/app/tasks src/app/applications src/app/review \
  src/app/Shell.tsx src/app/Sidebar.tsx src/components/palette/CommandPalette.tsx \
  src/app/home/HomePage.tsx
git commit -m "feat: Planner section — tasks, calendar+courses, applications, review as tabs"
```

---

### Task 10: Agents section — Chat becomes the first tab

**Files:**
- Move: `git mv src/app/chat/ChatPage.tsx src/app/chat/ChatWorkspace.tsx`
- Modify: `src/app/agents/AgentsPage.tsx`, `src/app/chat/InstancesSidebar.tsx` (copy), `src/app/Shell.tsx`, `src/app/Sidebar.tsx`, `src/components/palette/CommandPalette.tsx`

**Interfaces:**
- Produces: `ChatWorkspace({ initialSessionId }: { initialSessionId?: string | null })` (renamed from `ChatPage`; new optional prop opens that session on mount). `AgentsPage({ tab, sessionId }: { tab?: string; sessionId?: string | null })` with tabs `"chat" | "roster" | "pipelines" | "automations"`, default `"chat"`. `NavTarget` gains `sessionId?: string`. `Page` drops `"chat"`.

- [ ] **Step 1: Rename and extend ChatWorkspace**

In the moved file: rename the exported function `ChatPage` → `ChatWorkspace`, add the prop, and after `openSession` is defined add:

```tsx
    // Deep link (e.g. "open this project chat" from the Projects page).
    useEffect(() => {
        if (!initialSessionId) return;
        void sessionsRepo
            .getSession(initialSessionId)
            .then(openSession)
            .catch((e: unknown) =>
                setError(e instanceof Error ? e.message : String(e)),
            );
    }, [initialSessionId, openSession]);
```

- [ ] **Step 2: Restructure AgentsPage around tabs**

Replace the top of `AgentsPage.tsx`:

```tsx
type Tab = "chat" | "roster" | "pipelines" | "automations";
const TABS: { id: Tab; label: string }[] = [
    { id: "chat", label: "Chat" },
    { id: "roster", label: "Roster" },
    { id: "pipelines", label: "Pipelines" },
    { id: "automations", label: "Automations" },
];
const isTab = (t: string | undefined): t is Tab => TABS.some((x) => x.id === t);

export function AgentsPage({
    tab,
    sessionId,
}: {
    tab?: string;
    sessionId?: string | null;
}) {
    const [active, setActive] = useState<Tab>(isTab(tab) ? tab : "chat");
    useEffect(() => {
        if (isTab(tab)) setActive(tab);
    }, [tab]);

    return (
        <div className="flex h-full flex-col">
            <div className="px-6 pt-4">
                <TabBar tabs={TABS} active={active} onSelect={setActive} />
            </div>
            {active === "chat" ? (
                <div className="min-h-0 flex-1">
                    <ChatWorkspace initialSessionId={sessionId} />
                </div>
            ) : (
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                    <div className="mx-auto flex max-w-4xl flex-col gap-6">
                        <header>
                            <h1 className="font-display text-2xl font-semibold tracking-wide">
                                Agents
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {TAB_BLURBS[active]}
                            </p>
                        </header>
                        {active === "roster" && <RosterTab />}
                        {active === "pipelines" && <PipelinesTab />}
                        {active === "automations" && <AutomationsTab />}
                    </div>
                </div>
            )}
        </div>
    );
}

const TAB_BLURBS: Record<Exclude<Tab, "chat">, string> = {
    roster: "Your specialists. Each one is just instructions + a set of tools + a model — edit anything, or duplicate a builtin to start from a working example.",
    pipelines:
        "Chain agents into a sequence of steps. Each step sends a prompt to one agent; a step can reuse what earlier steps produced.",
    automations:
        "Put a pipeline on a schedule. Every tool call still passes the permission engine — nothing runs silently.",
};
```

- [ ] **Step 3: Remove the standalone chat page**

- `Sidebar.tsx`: drop `"chat"` from `Page` and remove the Chat nav item (Agents is now the second Command entry). Remove the unused `MessageSquare` import (keep the `icon: typeof Network`-style typing valid — use `Network` in the `NavItem` interface annotation if `MessageSquare` was referenced there).
- `Shell.tsx`: remove `chat: ChatPage` and its import; render `nav.page === "agents" ? <AgentsPage tab={nav.tab} sessionId={nav.sessionId} /> : …`. Add `sessionId?: string` to `NavTarget` in `Sidebar.tsx`.
- `CommandPalette.tsx`: `{ target: { page: "chat" }, label: "Chat" }` → `{ target: { page: "agents", tab: "chat" }, label: "Chat" }`; `{ target: { page: "agents" }, label: "Agents" }` → `{ target: { page: "agents", tab: "roster" }, label: "Agent roster" }`; add `{ target: { page: "agents", tab: "pipelines" }, label: "Pipelines" }` and `{ target: { page: "agents", tab: "automations" }, label: "Automations" }`.

- [ ] **Step 4: Humanize the chat sidebar copy**

In `InstancesSidebar.tsx`: panel heading `"Agents"` (line 124) → `"Chats"`; collapse/expand button labels `"… agents panel"` → `"… chats panel"`; empty text `"No agents yet. Start one from a preset above."` → `"No chats yet. Start one from a preset above."`; delete button label `"Delete agent"` → `"Delete chat"`. In `ChatWorkspace` the empty-state hint `"Start an agent from a preset in the sidebar."` → `"Start a chat from a preset in the sidebar."`.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm test` → pass.
Run: `npm run dev` → Agents opens on the Chat tab with the full-height chat workspace (sidebar + sphere); Roster/Pipelines/Automations tabs scroll independently; ⌘K "Chat" works; no dead "chat" page remains.

- [ ] **Step 6: Commit**

```bash
git add -A src/app/chat src/app/agents src/app/Shell.tsx src/app/Sidebar.tsx \
  src/components/palette/CommandPalette.tsx
git commit -m "feat: chat lives inside the Agents section as its first tab"
```

---

### Task 11: Projects UI — list page + detail (files, chats, bookmarks, automations)

**Files:**
- Create: `src/app/projects/ProjectsPage.tsx`, `src/app/projects/ProjectDetail.tsx`
- Modify: `src/app/Sidebar.tsx` (add `"projects"` to `Page` + a Workspace nav item with the `FolderKanban` icon), `src/app/Shell.tsx` (PAGES entry + pass `onNavigate` to ProjectsPage), `src/app/agents/AutomationsTab.tsx` (project select in the form)

**Interfaces:**
- Consumes: everything from Tasks 4–5; `ingestPdf` from `@/ai/multimodal/pdf`; `insertDocument`, `listProjectDocuments`, and `deleteDocument` (exists at `documents.ts:91`) from the documents repo.
- Produces: `ProjectsPage({ onNavigate }: { onNavigate: (t: NavTarget) => void })`. `ProjectDetail({ project, onBack, onChanged, onOpenChat }: { project: Project; onBack: () => void; onChanged: () => Promise<void>; onOpenChat: (sessionId: string) => void })`. Project documents live in folder `` `/projects/${slug}` `` where `slug` = project name lowercased, non-alphanumerics → `-` (this makes the existing `doc_folder` permission scoping and `search_documents` folder filters work on project files for free).

- [ ] **Step 1: ProjectsPage (list + create)**

```tsx
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
```

(`Card` extends `HTMLAttributes<HTMLDivElement>` and spreads all props — `onClick` and `style` pass through as written.)

- [ ] **Step 2: ProjectDetail**

`src/app/projects/ProjectDetail.tsx` — one scrollable column with: identity header (editable name via the NotesPage transparent-Input pattern, description input, `SESSION_COLORS` swatch row calling `updateProject`), then four cards:

1. **Files** — hidden `<input type="file" accept="application/pdf,.md,.txt" multiple>` + "Upload" button. Handler:

```tsx
    const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const folder = `/projects/${slug}`;

    const upload = async (files: FileList | null) => {
        if (!files) return;
        setError(null);
        try {
            for (const file of Array.from(files)) {
                if (file.type === "application/pdf") {
                    await ingestPdf({
                        data: new Uint8Array(await file.arrayBuffer()),
                        fileName: file.name,
                        folder,
                        projectId: project.id,
                    });
                } else {
                    await insertDocument({
                        title: file.name,
                        contentText: await file.text(),
                        mimeType: file.type || "text/plain",
                        folder,
                        sourceName: file.name,
                        byteSize: file.size,
                        projectId: project.id,
                    });
                }
            }
            await refreshDocs();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };
```

`ingestPdf` (`src/ai/multimodal/pdf.ts:12`) already accepts `folder?: string`; add `projectId?: string | null` to its options and pass `projectId: opts.projectId ?? null` in its `insertDocument` call (line 22). File rows list title + size + delete button (`deleteDocument`).

2. **Chats** — `listSessions({ projectId: project.id })` rows (title + relative time, click → `onOpenChat(s.id)`), plus a "New chat" row: preset `<Select>` (from `listPresets()`) + Button:

```tsx
    const newChat = async (preset: Preset) => {
        const session = await sessionsRepo.createSession({
            title: `${project.name} · ${preset.name}`,
            presetId: preset.id,
            permissionLevelId: preset.permission_level_id,
            projectId: project.id,
        });
        onOpenChat(session.id);
    };
```

3. **Bookmarks** — `listBookmarks({ projectId: project.id })` + the same add-row as BookmarksTab (project preset to this project, no project select).

4. **Automations** — `listAutomations({ projectId: project.id })` read-only rows (name, schedule, enabled badge) + hint text: `"Create or edit automations in Agents → Automations and assign them to this project."`

Footer: two-step delete button (same `confirmingId` pattern as `InstancesSidebar`) calling `deleteProject` then `onBack()` + `onChanged()`.

- [ ] **Step 3: Wire into Shell/Sidebar/palette + automations form**

- `Sidebar.tsx`: add `"projects"` to `Page`; Workspace section gets `{ page: "projects", label: "Projects", icon: FolderKanban }` first.
- `Shell.tsx`: add `projects` to `PAGES` (any placeholder value is fine since the conditional handles it) and render `nav.page === "projects" ? <ProjectsPage onNavigate={setNav} /> : …`.
- `CommandPalette.tsx`: add `{ target: { page: "projects" }, label: "Projects" }` after Home.
- `AutomationsTab.tsx` form: below the permission level select, add a project `<Select>` fed by `listProjects()` (`"No project"` → null) writing `form.projectId`, passed through to the create/update repo calls.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm test` → pass.
Run: `npm run dev` → create a project; upload a PDF and a .md file (rows appear; the knowledge agent can `search_documents` them, scoped by the `/projects/<slug>` folder); start a project chat (lands in Agents → Chat with the session open); add a project bookmark (visible under Notes → Bookmarks when filtering by the project chip); delete the project (chats/bookmarks survive, unfiled).

- [ ] **Step 5: Commit**

```bash
git add -A src/app/projects src/app/Sidebar.tsx src/app/Shell.tsx \
  src/components/palette/CommandPalette.tsx src/app/agents/AutomationsTab.tsx \
  src/ai/multimodal/pdf.ts
git commit -m "feat: Projects section — files, project chats, bookmarks, automations"
```

---

### Task 12: Universe network — project stars + archive layer

The scaling fix from the todo: the sphere currently hard-caps at `MAX_SESSIONS = 10` and silently drops the rest. New model: **project hubs** (with session + document satellites) + the **most recent unfiled sessions** as their own stars + one **archive star** holding everything older, expandable in place.

**Files:**
- Modify: `src/components/hud/networkData.ts` (new builder, kinds, remove `buildSessionNetwork`), `src/app/chat/ChatWorkspace.tsx` (data loading + archive toggle)
- Test: `src/components/hud/networkData.test.ts` (new)

**Interfaces:**
- Produces:
  - `NodeKind` becomes `"session" | "agent" | "tool" | "doc" | "project" | "archive"` (drop unused `"note"`).
  - `buildUniverseNetwork(opts: { projects: Project[]; sessions: ChatSession[]; documents: Pick<Document, "id" | "title" | "project_id">[]; presets: Preset[]; agents: AgentDef[]; expanded: boolean }): Network`
  - Node payloads: project hub → `{ project: Project }`; session node → the `ChatSession`; archive hub → `{ archive: true, count: number }`.
  - Layout constants: `RECENT_HUBS = 8`, `PROJECT_SESSION_SAT = 6`, `PROJECT_DOC_SAT = 5`, `ARCHIVE_SAT = 24`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/hud/networkData.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildUniverseNetwork } from "./networkData";
import type { AgentDef, ChatSession, Preset, Project } from "@/lib/schemas";

function session(id: string, over: Partial<ChatSession> = {}): ChatSession {
    return {
        id,
        title: id,
        preset_id: null,
        permission_level_id: null,
        compaction_summary: null,
        project_id: null,
        color: null,
        created_at: 0,
        updated_at: 0,
        ...over,
    };
}

function project(id: string, name: string): Project {
    return {
        id,
        name,
        description: null,
        color: "#22d3ee",
        created_at: 0,
        updated_at: 0,
    };
}

const base = {
    presets: [] as Preset[],
    agents: [] as AgentDef[],
    documents: [] as { id: string; title: string; project_id: string | null }[],
};

describe("buildUniverseNetwork", () => {
    it("makes one hub per project with doc satellites in its cluster", () => {
        const p = project("prj_1", "Thesis");
        const net = buildUniverseNetwork({
            ...base,
            projects: [p],
            documents: [{ id: "doc_1", title: "spec.pdf", project_id: "prj_1" }],
            sessions: [session("ses_1", { project_id: "prj_1" })],
            expanded: false,
        });
        const hub = net.nodes.find((n) => n.kind === "project");
        expect(hub).toBeDefined();
        expect(hub!.label).toBe("Thesis");
        const doc = net.nodes.find((n) => n.kind === "doc");
        expect(doc!.parentId).toBe(hub!.id);
        const ses = net.nodes.find((n) => n.kind === "session");
        expect(ses!.parentId).toBe(hub!.id);
    });

    it("collapses old unfiled sessions into one archive star", () => {
        const sessions = Array.from({ length: 12 }, (_, i) =>
            session(`ses_${i}`, { updated_at: 100 - i }),
        );
        const net = buildUniverseNetwork({
            ...base,
            projects: [],
            sessions,
            expanded: false,
        });
        const hubs = net.nodes.filter((n) => n.kind === "session" && n.primary);
        expect(hubs).toHaveLength(8); // RECENT_HUBS newest
        const archive = net.nodes.find((n) => n.kind === "archive");
        expect(archive).toBeDefined();
        expect((archive!.payload as { count: number }).count).toBe(4);
    });

    it("expands the archive into session satellites", () => {
        const sessions = Array.from({ length: 12 }, (_, i) =>
            session(`ses_${i}`, { updated_at: 100 - i }),
        );
        const net = buildUniverseNetwork({
            ...base,
            projects: [],
            sessions,
            expanded: true,
        });
        const archive = net.nodes.find((n) => n.kind === "archive")!;
        const archived = net.nodes.filter(
            (n) => n.kind === "session" && n.parentId === archive.id,
        );
        expect(archived).toHaveLength(4);
    });

    it("omits the archive star when everything fits", () => {
        const net = buildUniverseNetwork({
            ...base,
            projects: [],
            sessions: [session("ses_1")],
            expanded: false,
        });
        expect(net.nodes.find((n) => n.kind === "archive")).toBeUndefined();
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/hud/networkData.test.ts`
Expected: FAIL — `buildUniverseNetwork` is not exported.

- [ ] **Step 3: Implement the builder**

In `networkData.ts`: update `NodeKind`, add imports (`Project`, `Document`), add constants, and replace `buildSessionNetwork` (delete it — ChatWorkspace is its only consumer) with:

```ts
export const RECENT_HUBS = 8;
const PROJECT_SESSION_SAT = 6;
const PROJECT_DOC_SAT = 5;
const ARCHIVE_SAT = 24;
const PROJECT_R = HUB_R + 0.5;
const ARCHIVE_COLOR = "var(--muted-foreground)";

/**
 * The full chat universe: one star per project (sessions + files clustered
 * around it), the newest unfiled sessions as their own stars, and everything
 * older folded into a single expandable "archive" star — so the globe stays
 * readable at any chat count.
 */
export function buildUniverseNetwork(opts: {
    projects: Project[];
    sessions: ChatSession[];
    documents: Pick<Document, "id" | "title" | "project_id">[];
    presets: Preset[];
    agents: AgentDef[];
    expanded: boolean;
}): Network {
    const presetById = new Map(opts.presets.map((p) => [p.id, p]));
    const agentsById = new Map(opts.agents.map((a) => [a.id, a]));
    const net: Network = { nodes: [], edges: [] };

    const filed = opts.sessions.filter((s) => s.project_id !== null);
    const unfiled = opts.sessions.filter((s) => s.project_id === null);
    const recent = unfiled.slice(0, RECENT_HUBS);
    const archived = unfiled.slice(RECENT_HUBS);

    const hubCount =
        opts.projects.length + recent.length + (archived.length > 0 ? 1 : 0);
    const hubUnits = fibonacciSphere(hubCount);
    let slot = 0;

    // Project stars: files in close, chats orbiting.
    for (const project of opts.projects) {
        const unit = hubUnits[slot++]!;
        const hubId = `project:${project.id}`;
        const color = project.color ?? "var(--primary)";
        const docs = opts.documents
            .filter((d) => d.project_id === project.id)
            .slice(0, PROJECT_DOC_SAT);
        const sessions = filed
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
                chips: docs.map((d) => ({ label: d.title })),
                foot: `${sessions.length} chats · ${docs.length} files`,
            },
            payload: { project },
        });
        docs.forEach((doc, i) => {
            const dUnit = satelliteUnit(unit, i, docs.length, TOOL_SPREAD);
            const id = `${hubId}:doc:${doc.id}`;
            net.nodes.push({
                id,
                kind: "doc",
                label: doc.title,
                color,
                unit: dUnit,
                r: TOOL_R,
                parentId: hubId,
                primary: false,
                meta: { title: doc.title, subtitle: `file · ${project.name}` },
            });
            net.edges.push({ a: hubId, b: id });
        });
        sessions.forEach((s, i) => {
            const sUnit = satelliteUnit(unit, i, sessions.length, AGENT_SPREAD);
            const preset = s.preset_id ? presetById.get(s.preset_id) : undefined;
            const id = `session:${s.id}`;
            net.nodes.push({
                id,
                kind: "session",
                label: s.title,
                color: sessionColor(s, preset, agentsById),
                unit: sUnit,
                r: AGENT_R,
                parentId: hubId,
                primary: true,
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

    // Recent unfiled sessions: their own stars with specialist satellites.
    for (const s of recent) {
        const unit = hubUnits[slot++]!;
        const preset = s.preset_id ? presetById.get(s.preset_id) : undefined;
        const defs = safeAgents(preset)
            .map((id) => agentsById.get(id))
            .filter((d): d is AgentDef => d !== undefined);
        const hubId = `session:${s.id}`;
        net.nodes.push({
            id: hubId,
            kind: "session",
            label: s.title,
            color: sessionColor(s, preset, agentsById),
            unit,
            r: HUB_R,
            primary: true,
            meta: {
                title: s.title,
                subtitle: preset
                    ? `${preset.name} · ${preset.provider}/${preset.model}`
                    : "no preset",
                chips: defs.map((d) => {
                    const info = agentInfo(d);
                    return { label: info.slug, color: info.color };
                }),
                foot: `updated ${relativeTime(s.updated_at)}`,
            },
            payload: s,
        });
        defs.forEach((def, k) =>
            attachAgent(net, hubId, unit, def, k, defs.length, hubId),
        );
    }

    // The outskirts: older chats as one dim star; click to unfold them.
    if (archived.length > 0) {
        const unit = hubUnits[slot++]!;
        const hubId = "archive";
        net.nodes.push({
            id: hubId,
            kind: "archive",
            label: `${archived.length} older`,
            color: ARCHIVE_COLOR,
            unit,
            r: HUB_R,
            primary: true,
            meta: {
                title: `${archived.length} older chats`,
                subtitle: opts.expanded
                    ? "Click a chat to open it · click here to fold them back."
                    : "Click to unfold them onto the globe.",
            },
            payload: { archive: true, count: archived.length },
        });
        if (opts.expanded) {
            const shown = archived.slice(0, ARCHIVE_SAT);
            shown.forEach((s, i) => {
                const sUnit = satelliteUnit(unit, i, shown.length, AGENT_SPREAD * 1.4);
                const preset = s.preset_id ? presetById.get(s.preset_id) : undefined;
                const id = `session:${s.id}`;
                net.nodes.push({
                    id,
                    kind: "session",
                    label: s.title,
                    color: sessionColor(s, preset, agentsById),
                    unit: sUnit,
                    r: AGENT_R,
                    parentId: hubId,
                    primary: true,
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
    }

    return net;
}
```

(Also delete the now-unused `MAX_SESSIONS` constant. Keep `buildAgentTypeNetwork` unchanged — the roster tab and the empty state still use it.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/hud/networkData.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire ChatWorkspace to the universe**

In `ChatWorkspace.tsx`:
- New state: `const [projects, setProjects] = useState<Project[]>([]);`, `const [docs, setDocs] = useState<Pick<Document, "id" | "title" | "project_id">[]>([]);`, `const [archiveOpen, setArchiveOpen] = useState(false);`
- Extend the initial load effect: `setProjects(await listProjects());` and `setDocs(await listDocuments());` (`listDocuments()` already returns metadata with empty `content_text`).
- Replace the `network` memo:

```tsx
    const network = useMemo(
        () =>
            sessions.length || projects.length
                ? buildUniverseNetwork({
                      projects,
                      sessions,
                      documents: docs,
                      presets,
                      agents,
                      expanded: archiveOpen,
                  })
                : buildAgentTypeNetwork(agents),
        [sessions, projects, docs, presets, agents, archiveOpen],
    );
```

- Extend `openFromNode`:

```tsx
            if (node.kind === "archive") {
                setArchiveOpen((v) => !v);
                return;
            }
            if (node.kind === "project") {
                return; // project stars are context; management lives in Projects
            }
```

(before the existing `session` branch). Add an `onOpenProject?: (projectId: string) => void` prop later only if navigation from the star is wanted — YAGNI for now; the hover card explains the star.)
- `sessionIdOf` already resolves `parentId` prefixed `session:` — extend it so archive/project children map correctly (session nodes under hubs still have `kind === "session"`, handled by the first branch; no change needed — verify with hover).
- Sidebar grouping: in `InstancesSidebar`, group the session list — for each project (passed in as a new `projects: Project[]` prop) render a mono-uppercase header row (project name, colored dot) above its sessions, then an `"Unfiled"` header above the rest. Pure presentational partition of the existing `sessions.map` (two passes over the same row-rendering code, extracted into a local `Row` closure).

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm test` → pass.
Run: `npm run dev` → seed ~15 chats + 1 project with a file: globe shows the project star (file + chats around it), 8 recent stars, and one dim "N older" star; clicking it unfolds/refolds the archive ring; every session node opens its chat; hover-sync with the sidebar rows still works.

- [ ] **Step 7: Commit**

```bash
git add src/components/hud/networkData.ts src/components/hud/networkData.test.ts \
  src/app/chat/ChatWorkspace.tsx src/app/chat/InstancesSidebar.tsx
git commit -m "feat: universe network — project stars + expandable archive layer"
```

---

### Task 13: Pipelines without `{{}}` — template chips + plain-language copy

The `{{input}}` syntax stays as storage format (the runner and `lib/template.ts` are untouched); users stop typing it.

**Files:**
- Modify: `src/app/agents/PipelinesTab.tsx`, `src/app/agents/AutomationsTab.tsx:340-349`

**Interfaces:**
- Produces (local to PipelinesTab): `TemplateChips({ tokens, onInsert }: { tokens: { token: string; label: string }[]; onInsert: (token: string) => void })`.

- [ ] **Step 1: Add the chips + cursor insertion**

In `PipelinesTab.tsx` add above `PipelineEditor`:

```tsx
function TemplateChips({
    tokens,
    onInsert,
}: {
    tokens: { token: string; label: string }[];
    onInsert: (token: string) => void;
}) {
    return (
        <div className="flex flex-wrap items-center gap-1">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                insert
            </span>
            {tokens.map((t) => (
                <button
                    key={t.token}
                    type="button"
                    onClick={() => onInsert(t.token)}
                    className="cursor-pointer rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                    {t.label}
                </button>
            ))}
        </div>
    );
}
```

In `PipelineEditor`, keep a ref per step textarea and insert at the cursor:

```tsx
    const taRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

    const insertToken = (i: number, token: string) => {
        const ta = taRefs.current[i];
        const cur = steps[i]!.promptTemplate;
        if (!ta) {
            setStep(i, { promptTemplate: cur + token });
            return;
        }
        const start = ta.selectionStart ?? cur.length;
        const end = ta.selectionEnd ?? cur.length;
        setStep(i, {
            promptTemplate: cur.slice(0, start) + token + cur.slice(end),
        });
        requestAnimationFrame(() => {
            ta.focus();
            ta.selectionStart = ta.selectionEnd = start + token.length;
        });
    };
```

Attach `ref={(el) => { taRefs.current[i] = el; }}` to each step `<Textarea>`, and under it render:

```tsx
                        <TemplateChips
                            tokens={[
                                { token: "{{input}}", label: "run input" },
                                ...(i > 0
                                    ? [{ token: "{{prev}}", label: "previous step" }]
                                    : []),
                                ...steps.slice(0, i).map((_, j) => ({
                                    token: `{{step${j + 1}}}`,
                                    label: `step ${j + 1} output`,
                                })),
                                { token: "{{date}}", label: "today's date" },
                            ]}
                            onInsert={(t) => insertToken(i, t)}
                        />
```

- [ ] **Step 2: Rewrite the jargon copy**

- Editor header hint (lines 260–263) → `"Steps run top to bottom. Each step sends its prompt to one agent. Use the insert buttons to reference the run input or an earlier step's output — no syntax to memorize."`
- Run-input label (line 97) → `"What should this run start with?"` with the same placeholder.
- Step textarea placeholder → `"What should this agent do? e.g. Summarize the key points of {{prev}}"`.
- New-step default template stays `"{{prev}}"`.
- In `AutomationsTab.tsx:341`, label `"Input template ({{date}} available)"` → `"What each run starts with"` and add under the Input: `<TemplateChips tokens={[{ token: "{{date}}", label: "today's date" }]} onInsert={(t) => setForm({ ...form, inputTemplate: form.inputTemplate + t })} />` (export `TemplateChips` from PipelinesTab and import it, keeping one implementation).

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm test` → pass.
Run: `npm run dev` → chips insert at the cursor and re-focus; step 1 offers no "previous step"; step 3 offers "step 1 output" and "step 2 output"; a run still resolves templates exactly as before (`lib/template.ts` untouched).

- [ ] **Step 4: Commit**

```bash
git add src/app/agents/PipelinesTab.tsx src/app/agents/AutomationsTab.tsx
git commit -m "feat: pipeline template chips — no more hand-typed {{}} syntax"
```

---

### Task 14: Final verification + docs

**Files:**
- Modify: `docs/architecture.md` (repo-layout block), `docs/todo.md` (check off items)

- [ ] **Step 1: Full gates**

Run: `npm run typecheck` → exit 0.
Run: `npm test` → all suites pass.
Run: `npm run build` → completes (this also type-checks and tree-shakes the web target; catches any dangling import from the moves/deletes).

- [ ] **Step 2: Manual QA sweep (`npm run dev`)**

Walk the todo list end-to-end:
1. Composer: placeholder/button baseline aligned; grows/shrinks. ✔ UI-1
2. Background + sphere stars: soft halos, tapered spikes, nothing "two hard lines". ✔ UI-2
3. Chat permission dropdown: exactly one "Ask everything". ✔ UX-1
4. Chat lives under Agents → Chat; sidebar has no standalone Chat/Library/Tasks/Applications/Review entries. ✔ UX-2/3
5. Courses only appear inside Planner → Calendar; no student copy on general surfaces. ✔ UX-4
6. Agents tabs carry plain-language blurbs; pipeline chips replace `{{}}` typing. ✔ UX-5
7. 15+ chats: globe shows recent stars + archive star that unfolds; project star shows files in the middle ring. ✔ UX-6, Feature-2
8. Rename + recolor a chat from the sidebar. ✔ Feature-1
9. Project flow: create → upload files → project chat → project bookmark → delete project unfiles everything. ✔ Feature-2
10. Filter chips on bookmarks (groups + projects), snippets (groups), tasks (courses). ✔ Feature-3
11. `prefers-reduced-motion`: sphere static but hover/click still work.
12. Keyboard: tab through sidebar, tab bars, chips; ⌘K deep-links to every tab.

- [ ] **Step 3: Update docs**

- `docs/architecture.md` repo-layout block: replace the `app/` line with `app/  Shell + sections: home/, agents/ (chat, roster, pipelines, automations), projects/, notes/ (notes, bookmarks, snippets), planner/ (tasks, calendar, applications, review), presets/, permissions/, settings/`.
- `docs/todo.md`: mark each line done (`- [x] …`) or delete resolved entries, keeping any follow-up ideas.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture.md docs/todo.md
git commit -m "docs: record the section IA and close out todo.md"
```

---

## Self-Review (performed while writing)

**Spec coverage** — every `docs/todo.md` line maps to a task:

| todo.md item | Task(s) |
| --- | --- |
| Composer offset | 1 |
| Stars too simplistic/intrusive | 2 |
| Duplicate "Ask Everything" | 3 |
| Chat part of agents section | 10 |
| Unify sections (calendar/notes/agents) | 8, 9, 10 |
| Courses too student-targeted, keep under calendar | 7 (copy), 9 |
| Agents/pipelines confusing, `{{input}}` | 10 (blurbs), 13 |
| Neural net doesn't scale (layers/outskirts) | 12 |
| Customize chats (rename/recolor), notes | 6 (chats), 8 (bookmark/snippet editing; note rename already exists) |
| Projects (files, chats, automations, star, project bookmarks) | 4, 5, 11, 12 |
| Filter by category (bookmarks, snippets, tasks) | 7, 8 |

**Known judgment calls** (flag to the user, don't silently decide differently):
- "Applications and notes aren't separate" is read as *too many top-level pages*; Applications lands in Planner (deadline-shaped), not Notes.
- Projects **are** usable as categories via the bookmark project filter *and* have project-unique bookmarks in the detail view — the todo offered either; this does both cheaply.
- Project stars don't navigate on click (hover explains them); chats/archive nodes do. Revisit if it feels dead.
- `notes.project_id` deliberately skipped (YAGNI; todo doesn't ask for project notes).

**Placeholder scan** — no TBDs; the three "follow the file's existing conventions" spots (automations repo inputs, ApplicationsTab/ReviewTab wrapper strip, db.test.ts assertion shape) point at concrete files/lines the implementer must read anyway because this plan intentionally doesn't paste 400-line files it only trims.

**Type consistency** — checked: `sessionColor(session, preset, agentsById)` used in Tasks 6 and 12; `NavTarget { page, tab?, sessionId? }` grows in 8 → 10 → 11 in that order; `listSessions({projectId})`/`createSession({projectId})` defined in 4–5, consumed in 11–12; `SESSION_COLORS` exported in 6, imported in 11; `TabBar` extracted in 8, consumed in 9–10; `PermissionLevelSelect` value/onChange is `string | null` at all four call sites.
