# Home & Polish Implementation Plan — todo round of 2026-07-17

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Work through `docs/todo.md`'s current round: fix the automation-permissions bug at its root (the grant UI's stale tool list), give the calendar a 1-day view and manual event creation, hide the exo-sphere until the user scrolls out, restore per-chat agent satellites subtly, make new chats/notes inherit the project/category context they're created from, turn Home into a launcher (bookmarks, quick capture, recent chats), give the status bar live tappable readouts, and survive page refresh (nav position + chat drafts).

**Architecture:** No schema changes at all this round — every feature rides on existing tables (`events.source` distinguishes manual events; persistence uses namespaced localStorage, which both targets have). The permissions fix replaces a hardcoded `KNOWN_TOOLS` list with the `TOOL_CATALOG` single source of truth and adds an automation "preflight" warning that names ungranted tools before an unattended run can silently auto-deny them. Sphere changes are pure draw-pass math (a zoom-driven reveal factor) plus a builder option — the perf contract is untouched. Context-aware creation threads a `creationCategoryId` through ChatWorkspace and adds `NavTarget.projectId` so a sphere project-star click lands in the project detail (where project chats already file correctly).

**Tech Stack:** unchanged — React 19, TypeScript strict, Tailwind v4, motion, lucide-react, zod, SQLite (three clients), Vercel AI SDK. **No new dependencies, no new migrations.**

## Global Constraints

- **Branch prerequisite:** `feat/categories-signal` is complete and pending the user's QA/merge decision. Do not start this plan on top of it blind: **merge it first** (after QA), then `git checkout -b feat/home-signal` from main. If QA finds bugs, fix them on the categories branch before merging. The uncommitted `docs/todo.md` edits in the working tree are the user's new todo round — commit them together with this plan file as the new branch's first commit.
- **$0 budget:** no new npm packages, no services, no keys.
- **No migrations:** nothing in this round changes the schema. If an implementer thinks a task needs a column, stop and report BLOCKED — the plan chose designs that don't.
- **Perf contract (WSLg):** no SVG filters, no `backdrop-blur`, no per-frame allocations in HUD components; SVG attribute writes inside the one rAF draw pass only. The exo-reveal factor is scalar math computed once per frame.
- **localStorage keys** are namespaced `hugh.*` and versioned (`hugh.nav.v1`, `hugh.draft.<sessionId>`). Every read is wrapped so corrupt/missing values fall back cleanly — persistence must never break boot.
- **AI must never break the app** (unchanged from last round) — nothing here touches that contract, don't regress it.
- **Gates:** `npm run typecheck` and `npm test` must pass before every commit.
- **UI verification:** the Playwright MCP plugin is now installed and configured for bundled chromium (`--browser chromium`; takes effect after a `/reload-plugins`). UI tasks get a browser-verification step against `npm run dev` (port 1420 — if it's already in use, the user's own dev server is running; drive that one). If the browser genuinely cannot launch in this environment, fall back to flagging the step for a human pass — never claim visual verification you didn't perform.
- **Style:** 4-space indent, double quotes, `cn()` for class merging, repos throw on missing rows, `void` prefix for fire-and-forget promises — match the file you are editing.

## File Structure (what exists after the plan)

```txt
src/app/permissions/PermissionsPage.tsx   MOD  tool dropdown derives from TOOL_CATALOG
src/ai/tools/catalog.test.ts              MOD  builtin-agent tool coverage invariant
src/app/agents/AutomationsTab.tsx         MOD  preflight "this level leaves X ungranted" warning
src/db/repo/events.ts                     MOD  deleteEvent(id)
src/db/repo/events.test.ts                NEW  manual create/delete round-trip
src/app/planner/calendarItems.ts          MOD  CalendarItem gains refId + manual
src/app/planner/calendarItems.test.ts     MOD  manual-event case
src/app/planner/CalendarTab.tsx           MOD  "1d" mode; QuickEvent form; delete on manual chips
src/app/planner/TasksTab.tsx              MOD  due-window filters + completed section
src/components/hud/NetworkSphere.tsx      MOD  exo reveal factor (hidden at zoom 1)
src/components/hud/networkData.ts         MOD  attachAgent opts; subtle satellites in category view
src/components/hud/networkData.test.ts    MOD  satellite cases
src/app/chat/ChatWorkspace.tsx            MOD  creationCategoryId; project-star click navigates;
                                               onSessionOpened; lifted categoryFilter
src/app/chat/InstancesSidebar.tsx         MOD  categoryFilter lifted to props
src/app/Sidebar.tsx                       MOD  NavTarget gains projectId?
src/app/Shell.tsx                         MOD  nav persistence, onTabChange plumbing, home/status wiring
src/app/agents/AgentsPage.tsx             MOD  onNavigate + onTabChange threading
src/app/notes/NotesPage.tsx               MOD  onTabChange; new notes inherit category filter
src/app/planner/PlannerPage.tsx           MOD  onTabChange
src/app/categories/CategoriesPage.tsx     MOD  initialProjectId deep-link (opens ProjectDetail)
src/app/categories/CategoryDetail.tsx     MOD  "New note here" button
src/app/home/HomePage.tsx                 MOD  bookmarks strip, quick capture, recent chats, clickable tiles
src/components/hud/StatusReadouts.tsx     NEW  due-today + next-automation readouts (clickable)
src/lib/navPersist.ts                     NEW  load/save NavTarget with validation
src/lib/navPersist.test.ts                NEW
src/components/chat/Composer.tsx          MOD  per-session draft persistence (draftKey prop)
docs/todo.md                              MOD  check off this round
docs/architecture.md                      MOD  one line: manual events, status readouts
```

Deliberately **not** done (YAGNI, carried or new):
- Events don't get `category_id` — manual events color by kind; category filtering of events still flows through the course link. Revisit if manual events pile up.
- Task quick-add drafts aren't persisted (only chat composer drafts) — a half-typed task title is cheap to retype; a half-typed chat message isn't.
- The "possible future problems" section of todo.md (bookmarks/snippets category_id, Uncategorized drill-in, flashcard categories) stays deliberately unbuilt, per its own text.
- CategoryDetail's "New note here" navigates to Notes without auto-selecting the new note (NavTarget has no noteId; not worth adding for one hop).

---

### Task 1: Automation research fix — grantable tools from TOOL_CATALOG + preflight warning

**Root cause (verified):** `PermissionsPage.tsx`'s `KNOWN_TOOLS` is a stale hardcoded 7-tool list. `search_web` — the Research agent's first move since the last round — plus every task/career/study tool **cannot be granted at all**. Unattended automation runs auto-deny anything ungranted (`createAutoDenyPermissions`, src/ai/automations/run.ts:26-29), so "research lookups" always fail no matter what level the user builds. Deriving the dropdown from `TOOL_CATALOG` fixes it for good; a coverage test pins the invariant; a preflight warning in the automation editor makes the next gap visible instead of silent.

**Files:**
- Modify: `src/app/permissions/PermissionsPage.tsx` (KNOWN_TOOLS, ~line 11; grant form, ~lines 96, 183-190)
- Modify: `src/ai/tools/catalog.test.ts`
- Modify: `src/app/agents/AutomationsTab.tsx` (editor form)

**Interfaces:**
- Consumes: `TOOL_CATALOG` from `@/ai/tools/catalog`; `listPipelineSteps` from `@/db/repo/pipelines`; `getAgent` from `@/db/repo/agents`; `agentToolNames` from `@/lib/schemas`; `listGrants` from `@/db/repo/permissions`; `toScopedGrant` from `@/ai/permissions/engine`.
- Produces: no new exports (the preflight helper stays module-private in AutomationsTab).

- [ ] **Step 1: Failing test — extend `src/ai/tools/catalog.test.ts`**

Add (reusing the file's existing imports/setup style; it currently tests the catalog shape):

```ts
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { seedBuiltinAgents } from "@/db/repo/agents";
import { listAgents } from "@/db/repo/agents";
import { agentToolNames } from "@/lib/schemas";
import { TOOL_CATALOG } from "./catalog";

describe("catalog covers builtin agents", () => {
    let db: ReturnType<typeof createTestDbClient>;
    beforeEach(() => {
        db = createTestDbClient();
        setDb(db);
    });
    afterEach(() => db.close());

    it("every builtin agent tool is a catalog entry (and therefore grantable)", async () => {
        await seedBuiltinAgents();
        const catalog = new Set(TOOL_CATALOG.map((t) => t.name));
        for (const agent of await listAgents()) {
            for (const tool of agentToolNames(agent)) {
                expect(catalog, `${agent.name} uses ungrantable tool`).toContain(tool);
            }
        }
    });
});
```

(Merge into the existing `catalog.test.ts` — keep its current tests; if it has no DB setup today, add this as a second describe with its own hooks.)

- [ ] **Step 2: Run it — expect PASS, then break the invariant to prove the test bites**

Run: `npx vitest run src/ai/tools/catalog.test.ts`
This test passes already (the catalog does contain search_web — the *UI list* is what's stale). To confirm it guards the invariant, temporarily remove the search_web line from TOOL_CATALOG, re-run (expect FAIL), restore it. The real RED for this task is the UI fix below, which has no unit test — the browser step verifies it.

- [ ] **Step 3: Fix `PermissionsPage.tsx`**

Delete the `KNOWN_TOOLS` const. Import the catalog:

```ts
import { TOOL_CATALOG } from "@/ai/tools/catalog";
```

In `LevelCard`, the tool state and select become catalog-driven, and picking a tool defaults `access` to the tool's declared access (users can still override):

```tsx
    const [tool, setTool] = useState(TOOL_CATALOG[0]!.name);
```

```tsx
                        <Select
                            aria-label="Tool"
                            value={tool}
                            onChange={(e) => {
                                setTool(e.target.value);
                                const entry = TOOL_CATALOG.find(
                                    (t) => t.name === e.target.value,
                                );
                                if (entry) setAccess(entry.access);
                            }}
                        >
                            {TOOL_CATALOG.map((t) => (
                                <option key={t.name} value={t.name}>
                                    {t.label} ({t.name})
                                </option>
                            ))}
                        </Select>
```

(Adapt to the exact JSX around line 183 — only the options source and the onChange body change.)

- [ ] **Step 4: Preflight warning in `AutomationsTab.tsx`'s editor**

Inside the editor component (the one holding `form`), add a module-private helper and an effect that recomputes when the pipeline or level changes:

```ts
/**
 * Tools the pipeline's agents can call that the chosen level does not grant.
 * Unattended runs auto-deny those — surface them before the user saves.
 */
async function ungrantedTools(
    pipelineId: string,
    levelId: string | null,
): Promise<string[]> {
    const steps = await listPipelineSteps(pipelineId);
    const used = new Set<string>();
    for (const step of steps) {
        try {
            for (const t of agentToolNames(await getAgent(step.agent_id))) used.add(t);
        } catch {
            // deleted agent or bad tools_json — the run itself will surface that
        }
    }
    const grants = levelId ? (await listGrants(levelId)).map(toScopedGrant) : [];
    const accessOf = new Map(TOOL_CATALOG.map((t) => [t.name, t.access]));
    return [...used].filter((name) => {
        const access = accessOf.get(name);
        if (!access) return true;
        return !grants.some((g) => g.tool === name && g.access === access);
    });
}
```

```tsx
    const [ungranted, setUngranted] = useState<string[]>([]);
    useEffect(() => {
        if (!form.pipelineId) {
            setUngranted([]);
            return;
        }
        let stale = false;
        void ungrantedTools(form.pipelineId, form.permissionLevelId ?? null)
            .then((names) => {
                if (!stale) setUngranted(names);
            })
            .catch(() => {
                if (!stale) setUngranted([]);
            });
        return () => {
            stale = true;
        };
    }, [form.pipelineId, form.permissionLevelId]);
```

Render below the permission-level select:

```tsx
                {ungranted.length > 0 && (
                    <p className="text-xs text-warning">
                        Unattended runs deny anything not granted. This level
                        leaves ungranted: {ungranted.join(", ")}. Add grants in
                        Permissions or the run will skip those tools.
                    </p>
                )}
```

(If the project has no `text-warning` token, use the same class the app uses for warning badges — check `Badge`'s `warning` tone and reuse its color.)

- [ ] **Step 5: Gates + browser check + commit**

Run: `npm run typecheck && npm test` — Expected: PASS.
Browser (Playwright against dev server): Permissions page → a level's "add grant" tool dropdown lists all TOOL_CATALOG entries incl. "Search the web (search_web)"; grant it (read/any); Automations editor with a Research pipeline + that level shows no warning, with "Ask everything" (no level) shows the warning naming search_web/fetch_url.

```bash
git add src/app/permissions/PermissionsPage.tsx src/ai/tools/catalog.test.ts src/app/agents/AutomationsTab.tsx
git commit -m "fix: grants cover the whole tool catalog; automations preflight ungranted tools"
```

---

### Task 2: Calendar — 1-day view + manual events

**Files:**
- Modify: `src/db/repo/events.ts` (deleteEvent)
- Create: `src/db/repo/events.test.ts`
- Modify: `src/app/planner/calendarItems.ts` (refId + manual on CalendarItem)
- Modify: `src/app/planner/calendarItems.test.ts`
- Modify: `src/app/planner/CalendarTab.tsx` ("1d" mode, QuickEvent, chip delete)

**Interfaces:**
- Consumes: `insertEvent` (already accepts `source`), existing `CalendarItem` consumers (DayList/MonthGrid).
- Produces: `deleteEvent(id: string): Promise<void>`; `CalendarItem` gains `refId: string` (the underlying row id) and `manual: boolean` (deletable manual event).

- [ ] **Step 1: Failing tests**

`src/db/repo/events.test.ts` (new):

```ts
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { deleteEvent, insertEvent, listEventsBetween } from "./events";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

describe("manual events", () => {
    it("creates with source manual and deletes by id", async () => {
        const t0 = Date.now();
        const e = await insertEvent({
            title: "Dentist",
            startsAt: t0 + 3_600_000,
            endsAt: t0 + 5_400_000,
            location: "Lafayette",
            source: "manual",
        });
        expect(e.source).toBe("manual");
        expect(await listEventsBetween(t0, t0 + 86_400_000)).toHaveLength(1);
        await deleteEvent(e.id);
        expect(await listEventsBetween(t0, t0 + 86_400_000)).toHaveLength(0);
    });
});
```

Extend `calendarItems.test.ts` with a manual-event case:

```ts
    it("marks manual events deletable and carries the row id", async () => {
        const t0 = Date.now();
        const e = await insertEvent({
            title: "Dentist",
            startsAt: t0 + 3_600_000,
            endsAt: t0 + 5_400_000,
            source: "manual",
        });
        const items = await collectCalendarItems(t0, t0 + 7 * DAY);
        expect(items[0]).toMatchObject({
            kind: "event",
            refId: e.id,
            manual: true,
        });
    });
```

Run: `npx vitest run src/db/repo/events.test.ts src/app/planner/calendarItems.test.ts`
Expected: FAIL — `deleteEvent` not exported; `refId`/`manual` missing.

- [ ] **Step 2: Repo + collector**

`events.ts`:

```ts
export async function deleteEvent(id: string): Promise<void> {
    await getDb().execute("DELETE FROM events WHERE id = ?", [id]);
}
```

`calendarItems.ts` — add to the interface:

```ts
    /** Underlying row id (task/event/automation/application). */
    refId: string;
    /** True for user-created events — the only calendar items deletable in place. */
    manual: boolean;
```

Every push site sets `refId` (the bare `e.id`/`t.id`/`a.id`/`app.id`) and `manual: false`, except the event branch which sets `manual: e.source === "manual"`.

Run the two test files — Expected: PASS.

- [ ] **Step 3: CalendarTab — "1d" mode**

```ts
type ViewMode = "1d" | "7d" | "14d" | "month";
```

`rangeFor` gains, before the non-month path (or fold into it):

```ts
    if (mode === "1d") {
        const from = startOfDay(anchor);
        return { from, to: from + DAY };
    }
```

The mode buttons array becomes `(["1d", "7d", "14d", "month"] as const)` with label logic `m === "month" ? "1 month" : m === "1d" ? "1 day" : \`${m.slice(0, -1)} days\``. In `shift`, the non-month step becomes `(mode === "1d" ? 1 : mode === "7d" ? 7 : 14) * DAY`. Render: `mode === "month" ? <MonthGrid …> : <DayList from={from} days={mode === "1d" ? 1 : mode === "7d" ? 7 : 14} …>`.

- [ ] **Step 4: CalendarTab — QuickEvent form + chip delete**

Add a QuickEvent component rendered between the FilterChips and the grid:

```tsx
function QuickEvent({ onAdd }: { onAdd: (input: {
    title: string;
    startsAt: number;
    endsAt: number;
    location: string | null;
}) => Promise<void> }) {
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
```

Wire in `CalendarTab` (imports: `insertEvent`, `deleteEvent` from `@/db/repo/events`, `Plus` from lucide):

```tsx
            <QuickEvent
                onAdd={(input) =>
                    act(() => insertEvent({ ...input, source: "manual" }))
                }
            />
```

Chip delete — `ItemChip` gains an optional `onDelete`; render an ✕ only when provided:

```tsx
            {onDelete && (
                <button
                    aria-label={`Delete ${item.title}`}
                    className="ml-auto shrink-0 cursor-pointer text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete()}
                >
                    <X className="h-3 w-3" />
                </button>
            )}
```

`DayList` gains `onDeleteManual?: (item: CalendarItem) => void` and passes `onDelete={item.manual ? () => onDeleteManual?.(item) : undefined}` per chip. (MonthGrid chips stay non-interactive — cells are too small.) `CalendarTab` supplies `onDeleteManual={(item) => void act(() => deleteEvent(item.refId))}`.

- [ ] **Step 5: Gates + browser check + commit**

Run: `npm run typecheck && npm test` — Expected: PASS.
Browser: Calendar → "1 day" mode shows one row; add an event via the form; it appears with a time and an ✕ in day views; ✕ removes it; month view shows it without an ✕; ICS-imported events show no ✕.

```bash
git add src/db/repo/events.ts src/db/repo/events.test.ts src/app/planner
git commit -m "feat: 1-day calendar view + manual event creation and deletion"
```

---

### Task 3: Exo-sphere hidden until the user scrolls out

At zoom 1 the exo-shell must be invisible (no stars outside the ring, no stray labels, no hit targets); it fades in as the user zooms below ~0.95 and is fully visible by ~0.7. Pure scalar math in the existing draw pass — no allocations, no new state.

**Files:**
- Modify: `src/components/hud/networkData.ts` (relativeTime fix; EXO_SHELL bump)
- Modify: `src/components/hud/networkData.test.ts` (relativeTime cases)
- Modify: `src/components/hud/NetworkSphere.tsx` (draw pass, initial JSX opacities, hit gating)
- Modify: `src/app/chat/ChatWorkspace.tsx` (hint copy only)

**Interfaces:** none new (`relativeTime`'s signature is unchanged — only its unit handling is fixed).

- [ ] **Step 0a: Fix `relativeTime` (QA-reported: chat details say "Updated in 20,631,053 days")**

`relativeTime` in networkData.ts computes `ts * 1000 - Date.now()` — it treats its input as **seconds**, but every caller passes **milliseconds** (`now()` = `Date.now()`), so freshly-updated chats render absurd far-future dates. TDD — add to networkData.test.ts:

```ts
describe("relativeTime", () => {
    it("treats input as milliseconds", () => {
        expect(relativeTime(Date.now() - 5 * 60_000)).toMatch(/5 minutes ago/);
        expect(relativeTime(Date.now() - 2 * 86_400_000)).toMatch(/2 days ago/);
    });
});
```

Run → FAIL (renders a huge future value). Fix the first line of `relativeTime` to:

```ts
    const sec = Math.round((ts - Date.now()) / 1000);
```

Run → PASS. (`Intl.RelativeTimeFormat` wording can vary by ICU build — if the exact phrase differs, loosen the regex to digits + unit, but it must assert *past*-tense output.)

- [ ] **Step 0b: Push the exo-shell further out (QA-reported: too close to the newest chats)**

In networkData.ts change `EXO_SHELL = 1.4` → `EXO_SHELL = 1.75`. If any test pins the literal 1.4, assert against the exported `EXO_SHELL` const instead. Geometry check (record in the report): at min zoom 0.55 the exo orbit projects at 40 × 1.75 × 0.55 ≈ 38.5 < 50 — still inside the chart frame when scrolled out; at zoom 1 it sits far outside, which Task 3's reveal hides anyway.

- [ ] **Step 1: Reveal factor in `draw()`**

Add module consts next to `RADIUS`:

```ts
const EXO_REVEAL_START = 0.95; // exo starts fading in below this zoom
const EXO_REVEAL_FULL = 0.7; // fully visible at or below this zoom
```

At the top of `draw()`'s per-frame body (before the node loop), compute once:

```ts
            const zoom = zoomRef.current;
            const reveal = Math.min(
                1,
                Math.max(
                    0,
                    (EXO_REVEAL_START - zoom) / (EXO_REVEAL_START - EXO_REVEAL_FULL),
                ),
            );
```

Replace the flat exo dimming line (`if ((node.shell ?? 1) > 1) op *= 0.6;`) with:

```ts
                if ((node.shell ?? 1) > 1) op *= 0.6 * reveal;
```

In the label block, gate exo labels the same way — after `lop` is computed:

```ts
                    if ((node.shell ?? 1) > 1) lop *= reveal;
```

In the hit-target block, extend the pointer-events condition so hidden exo nodes can't be clicked or hovered:

```ts
                    hit.style.pointerEvents =
                        p.depth > 0.45 && ((node.shell ?? 1) === 1 || reveal > 0.2)
                            ? "auto"
                            : "none";
```

The spike opacity already derives from `op` (`op * 0.45`), so spikes fade with the body for free — verify that's still true after editing.

- [ ] **Step 2: First-paint opacities**

The seed JSX paints before the first rAF. For `shell > 1` nodes, initial `fillOpacity` must be 0 on the node circle AND the spike group (labels already start at 0). In the three JSX map blocks, wrap the existing opacity expressions:

```tsx
                        fillOpacity={(n.shell ?? 1) > 1 ? 0 : 0.35 + 0.65 * seed[i]!.depth}
```

(and the equivalent on the spike `<g>`'s `fillOpacity`).

- [ ] **Step 3: Hint copy**

In `ChatWorkspace`, when `sphereFocus` is set, the standing-by hint should read: `Hover to inspect · click to open · scroll out for older chats.` (keep the existing copy otherwise).

- [ ] **Step 4: Gates + browser check + commit**

Run: `npm run typecheck && npm test` — Expected: PASS (no unit tests touch draw internals).
Browser: focus a category with >8 chats — at rest nothing renders outside the ring; scrolling out fades the exo stars in; scrolling back in hides them and they stop being hoverable; reduced-motion (emulate via devtools) still shows/hides on scroll.

```bash
git add src/components/hud/NetworkSphere.tsx src/app/chat/ChatWorkspace.tsx
git commit -m "feat: exo-sphere stays hidden until the user scrolls out"
```

---

### Task 4: Subtle agent satellites on category-sphere chat stars

The category-focused sphere lost the old per-chat agent visualization. Restore it subtly: inner chat stars get their preset's agent nodes as small, label-quiet satellites — no tool sub-satellites (that was the old noise) — plus agent chips on the hover card. With Task 3's exo fade, the focused sphere has room for this.

**Files:**
- Modify: `src/components/hud/networkData.ts` (attachAgent opts; buildCategoryUniverse inner loop)
- Modify: `src/components/hud/networkData.test.ts`

**Interfaces:**
- `attachAgent` gains an options parameter `{ r?: number; withTools?: boolean }` (defaults preserve current behavior: `r: AGENT_R`, `withTools: true`). Still module-private.

- [ ] **Step 1: Failing test**

In the `buildCategoryUniverse` describe block (reuse its existing `cat`/`session` factories and however the file builds presets/agent defs for `buildUniverseNetwork`'s tests):

```ts
    it("focused chat stars carry subtle agent satellites, no tools", () => {
        const agent = agentDef("agt_r", "Research", '["search_web","fetch_url"]');
        const preset = presetWith("pre_1", ["agt_r"]);
        const net = buildCategoryUniverse({
            categories: [cat("cat_a", "School")],
            projects: [],
            sessions: [session("ses_1", { category_id: "cat_a", preset_id: "pre_1" })],
            documents: [],
            presets: [preset],
            agents: [agent],
            focusCategoryId: "cat_a",
        });
        const agents = net.nodes.filter((n) => n.kind === "agent");
        expect(agents).toHaveLength(1);
        expect(agents[0]!.primary).toBe(false);
        expect(agents[0]!.r).toBeLessThan(1.5); // subtler than the old AGENT_R
        expect(net.nodes.filter((n) => n.kind === "tool")).toHaveLength(0);
        // Hover card lists the agents as chips.
        const star = net.nodes.find((n) => n.id === "session:ses_1")!;
        expect(star.meta.chips?.map((c) => c.label)).toEqual(["research"]);
    });
```

(`agentDef`/`presetWith` — use the file's existing factory names; if none exist for presets/agents, add minimal ones mirroring the `session` factory. `"research"` is `agentSlug("Research")`.)

Run: `npx vitest run src/components/hud/networkData.test.ts` — Expected: FAIL (no agent nodes in focused view).

- [ ] **Step 2: Implement**

`attachAgent` signature and body:

```ts
function attachAgent(
    net: Network,
    hubId: string,
    hubUnit: Vec3,
    def: AgentDef,
    slot: number,
    slots: number,
    idPrefix: string,
    opts: { r?: number; withTools?: boolean } = {},
) {
    const r = opts.r ?? AGENT_R;
    const withTools = opts.withTools ?? true;
```

Use `r` for the agent node's radius; wrap the existing `tools.forEach(…)` block in `if (withTools) { … }`. Existing callers are untouched (defaults).

In `buildCategoryUniverse`'s inner-sessions loop (the `for (const s of inner)` block), after pushing the hub node:

```ts
        const defs = safeAgents(preset)
            .map((id) => agentsById.get(id))
            .filter((d): d is AgentDef => d !== undefined);
        defs.forEach((def, k) =>
            attachAgent(net, `session:${s.id}`, unit, def, k, defs.length, `session:${s.id}`, {
                r: 1.0,
                withTools: false,
            }),
        );
```

and add chips to that hub's meta (mirroring the old recent-star meta):

```ts
                chips: defs.map((d) => {
                    const info = agentInfo(d);
                    return { label: info.slug, color: info.color };
                }),
```

Run the test file — Expected: PASS. Also re-run the whole suite (satellite counts may be asserted elsewhere).

- [ ] **Step 3: Gates + browser check + commit**

Run: `npm run typecheck && npm test` — Expected: PASS.
Browser: focused category sphere — chat stars show small dim companion dots that brighten with the star's subtree on hover; hover card lists agent chips; no tool clutter.

```bash
git add src/components/hud/networkData.ts src/components/hud/networkData.test.ts
git commit -m "feat: subtle agent satellites return to category chat stars"
```

---

### Task 5: Context-aware creation — chats and notes inherit where you are

Three flows: (a) new chats from the chat sidebar inherit the focused category (sphere drill-in) or the active category filter; (b) clicking a project star navigates to that project's detail page, where "Start project chat" already files correctly; (c) new notes inherit the active category filter, and CategoryDetail's Notes tab gets a "New note here" button.

**Files:**
- Modify: `src/app/Sidebar.tsx` (NavTarget gains `projectId?: string`)
- Modify: `src/app/Shell.tsx` (pass through)
- Modify: `src/app/agents/AgentsPage.tsx` (onNavigate prop → ChatWorkspace)
- Modify: `src/app/chat/ChatWorkspace.tsx` (lift categoryFilter; creationCategoryId; project-star click)
- Modify: `src/app/chat/InstancesSidebar.tsx` (categoryFilter becomes controlled props)
- Modify: `src/app/categories/CategoriesPage.tsx` (initialProjectId deep-link)
- Modify: `src/app/categories/CategoryDetail.tsx` ("New note here")
- Modify: `src/app/notes/NotesPage.tsx` (new note inherits filter)

**Interfaces:**
- `NavTarget` gains `projectId?: string`.
- `InstancesSidebar` props: `categoryFilter: string | null; onCategoryFilter: (id: string | null) => void` replace its internal state.
- `AgentsPage` and `ChatWorkspace` gain `onNavigate?: (t: NavTarget) => void`.
- `CategoriesPage` gains `initialProjectId?: string`.

- [ ] **Step 1: NavTarget + Shell plumbing**

`Sidebar.tsx`: add `projectId?: string;` to `NavTarget`.
`Shell.tsx`: pass `initialProjectId={nav.projectId}` to `CategoriesPage`, and `onNavigate={setNav}` to `AgentsPage`.

- [ ] **Step 2: Lift the chat category filter**

In `InstancesSidebar`, delete the local `categoryFilter` state; add the two props and use them everywhere the state was used (FilterChips `active`/`onChange`, the visible predicate). In `ChatWorkspace`:

```tsx
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
```

pass `categoryFilter={categoryFilter} onCategoryFilter={setCategoryFilter}` down.

- [ ] **Step 3: Creation context for new chats**

In `ChatWorkspace` (UNFILED_ID import from `@/components/hud/networkData`):

```tsx
    // Where a new chat files itself: the sphere's focused category wins,
    // else the sidebar's active filter. "unfiled" means explicitly nowhere.
    const creationCategoryId =
        sphereFocus && sphereFocus !== UNFILED_ID
            ? sphereFocus
            : sphereFocus === UNFILED_ID
              ? null
              : categoryFilter;
```

`newChat` passes it:

```tsx
            const session = await sessionsRepo.createSession({
                title: `${preset.name} chat`,
                presetId: preset.id,
                permissionLevelId: preset.permission_level_id,
                categoryId: creationCategoryId,
            });
```

(and `creationCategoryId` joins `newChat`'s dependency array.)

- [ ] **Step 4: Project stars navigate**

In `openFromNode`, replace the `if (node.kind === "project") return;` branch:

```ts
            if (node.kind === "project") {
                const project = (node.payload as { project: Project }).project;
                onNavigate?.({ page: "categories", projectId: project.id });
                return;
            }
```

`ChatWorkspace` accepts `onNavigate` (threaded from AgentsPage), added to `openFromNode`'s deps. In `AgentsPage`, accept `onNavigate` and pass it to `<ChatWorkspace onNavigate={onNavigate} …>`.

In `CategoriesPage`, accept `initialProjectId` and open it on arrival (works for categorized projects too, not just loose ones):

```tsx
    useEffect(() => {
        if (!initialProjectId) return;
        void projectsRepo
            .getProject(initialProjectId)
            .then((p) => setOpenProject(p))
            .catch(() => setOpenProject(null));
    }, [initialProjectId]);
```

This requires generalizing the current `openProjectId`-into-`looseProjects` lookup into an `openProject: Project | null` state object (the loose-project card click sets the object directly). `ProjectDetail` usage is unchanged.

- [ ] **Step 5: Notes inherit context**

`NotesPage.tsx`'s new-note handler (line ~120) becomes:

```tsx
        const note = await notesRepo.createNote({ categoryId: categoryFilter });
```

(`categoryFilter` is the existing filter state in `NotesTabBody`; when null the note is uncategorized — same as today.)

`CategoryDetail.tsx`'s Notes tab gets a create button above the list:

```tsx
                        <Button
                            variant="outline"
                            size="sm"
                            className="self-start"
                            onClick={() =>
                                void act(async () => {
                                    await notesRepo.createNote({
                                        title: "Untitled",
                                        categoryId: category.id,
                                    });
                                }).then(() =>
                                    onNavigate({ page: "notes", tab: "notes" }),
                                )
                            }
                        >
                            <Plus className="mr-1 h-3.5 w-3.5" /> New note here
                        </Button>
```

(Import `Plus`; note `act` returns a success boolean since the last round — only navigate on `true`: `.then((ok) => { if (ok) onNavigate(...) })`.)

- [ ] **Step 5b: Double-click a chat title to rename (QA request)**

In `InstancesSidebar`'s Row, the title `<button>` (the one whose `onClick` calls `onOpen(s)`) gains:

```tsx
                            onDoubleClick={() => {
                                renameHandledRef.current = false;
                                setRenamingId(s.id);
                                setDraftTitle(s.title);
                            }}
```

— the same body as the pencil button's onClick. Single click still opens the chat (the first click of a double-click will open it too; that's fine — rename mode then appears in place).

- [ ] **Step 6: Gates + browser check + commit**

Run: `npm run typecheck && npm test` — Expected: PASS.
Browser: filter the chat sidebar to a category → new chat lands in that category (check its expanded row); drill into a category sphere → new chat files there; click a project star → project detail opens; "Start project chat" still files under the project; Notes filtered to a category → New note carries it; CategoryDetail → New note here → note appears in Notes filtered view.

```bash
git add src/app/Sidebar.tsx src/app/Shell.tsx src/app/agents/AgentsPage.tsx src/app/chat src/app/categories src/app/notes/NotesPage.tsx
git commit -m "feat: new chats and notes inherit the project/category context they're created from"
```

---

### Task 6: Home becomes a launcher

Bookmarks one click away, quick capture (task or note) without leaving Home, recent chats, and the existing tiles/cards become navigation. Everything Home shows stays read-at-a-glance — no new heavy panels.

**Files:**
- Modify: `src/app/Shell.tsx` (pass `onNavigate` to HomePage)
- Modify: `src/app/home/HomePage.tsx`

**Interfaces:**
- Consumes: `listBookmarks` from `@/db/repo/library` (check its filter signature before use), `openExternal` from `@/lib/openExternal`, `createTask` from `@/db/repo/tasks`, `createNote` from `@/db/repo/notes`, `sessionColor` from `@/components/hud/networkData`, `NavTarget`.
- Produces: `HomePage({ onNavigate }: { onNavigate?: (t: NavTarget) => void } = {})` — default param keeps the `PAGES` record assignable, mirroring NotesPage's pattern.

- [ ] **Step 1: Shell wiring**

In `Shell.tsx`, special-case home like the other prop-taking pages:

```tsx
                            {nav.page === "home" ? (
                                <HomePage onNavigate={setNav} />
                            ) : nav.page === "agents" ? (
```

- [ ] **Step 2: HomePage additions**

Load more in the boot effect (parallel with the existing calls): `bookmarks: (await listBookmarks()).slice(0, 8)` and keep the raw `sessions` list (first 3) instead of only its length — extend `HomeStats` or add a `recent` state:

```tsx
    const [recent, setRecent] = useState<ChatSession[]>([]);
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
```

Quick capture (below the header, above the stats row):

```tsx
function QuickCapture({ onNavigate }: { onNavigate?: (t: NavTarget) => void }) {
    const [text, setText] = useState("");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState<string | null>(null);

    const capture = async (kind: "task" | "note") => {
        const title = text.trim();
        if (!title || saving) return;
        setSaving(true);
        try {
            if (kind === "task") {
                await createTask({ title });
                setSaved("Task added — see Planner.");
            } else {
                await createNote({ title });
                setSaved("Note created — see Notes.");
            }
            setText("");
        } catch (e) {
            setSaved(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <Input
                value={text}
                placeholder="Capture a task or note…"
                onChange={(e) => {
                    setText(e.target.value);
                    setSaved(null);
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.repeat) void capture("task");
                }}
            />
            <Button size="sm" disabled={saving} onClick={() => void capture("task")}>
                Task
            </Button>
            <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => void capture("note")}
            >
                Note
            </Button>
            {saved && (
                <button
                    className="cursor-pointer whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    onClick={() =>
                        onNavigate?.(
                            saved.startsWith("Task")
                                ? { page: "planner", tab: "tasks" }
                                : { page: "notes", tab: "notes" },
                        )
                    }
                >
                    {saved}
                </button>
            )}
        </div>
    );
}
```

Bookmarks strip (its own section under Today; hidden when empty):

```tsx
                {bookmarks.length > 0 && (
                    <section>
                        <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Bookmarks
                        </h2>
                        <div className="flex flex-wrap gap-1.5">
                            {bookmarks.map((b) => (
                                <button
                                    key={b.id}
                                    onClick={() => void openExternal(b.url)}
                                    className="cursor-pointer rounded-full border border-border px-2.5 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                                >
                                    {b.title}
                                </button>
                            ))}
                            <button
                                onClick={() => onNavigate?.({ page: "notes", tab: "bookmarks" })}
                                className="cursor-pointer rounded-full px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground hover:text-foreground"
                            >
                                all →
                            </button>
                        </div>
                    </section>
                )}
```

Recent chats (compact rows next to or under the stats; three rows: colored dot + title + relative time) navigating via `onNavigate?.({ page: "agents", tab: "chat", sessionId: s.id })`.

Make navigation affordances of the existing UI:
- StatTiles: wrap each `Card` in a button-like click → sessions→`{page:"agents",tab:"chat"}`, notes→`{page:"notes"}`, presets→`{page:"presets"}`; leave "documents indexed" static.
- The three Today cards' headers become clickable → planner calendar / planner tasks / planner applications.

Match the file's motion/Card idioms; keep additions in the existing max-w-4xl column.

- [ ] **Step 3: Gates + browser check + commit**

Run: `npm run typecheck && npm test` — Expected: PASS.
Browser: Home shows bookmarks chips (open externally), quick capture creates a task (verify in Planner) and a note, recent chats open the right session, tiles/cards navigate.

```bash
git add src/app/Shell.tsx src/app/home/HomePage.tsx
git commit -m "feat: home is a launcher — bookmarks, quick capture, recent chats"
```

---

### Task 7: Status bar — live, tappable readouts

Verdict on the todo's "unless it's not recommended": worth doing at small scale. Two live readouts (tasks due today, next automation run) plus making the existing model chip navigate. The almanac aesthetic stays; StatusBar itself remains presentational — Shell composes the interactive children.

**Files:**
- Create: `src/components/hud/StatusReadouts.tsx`
- Modify: `src/app/Shell.tsx` (compose readouts + clickable model chip)

**Interfaces:**
- Produces: `StatusReadouts({ onNavigate }: { onNavigate: (t: NavTarget) => void })`.

- [ ] **Step 1: Create `StatusReadouts.tsx`**

```tsx
import { useEffect, useState } from "react";
import { listOpenTasks } from "@/db/repo/tasks";
import { listAutomations } from "@/db/repo/automations";
import { relativeTime } from "@/components/hud/networkData";
import type { NavTarget } from "@/app/Sidebar";

function endOfToday(): number {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
}

/**
 * Live almanac readouts for the status bar: open tasks due today and the
 * next scheduled automation. Refreshes every minute; failures leave the
 * previous values (the status bar must never error).
 */
export function StatusReadouts({
    onNavigate,
}: {
    onNavigate: (t: NavTarget) => void;
}) {
    const [dueToday, setDueToday] = useState<number | null>(null);
    const [nextRun, setNextRun] = useState<number | null>(null);

    useEffect(() => {
        const refresh = async () => {
            try {
                setDueToday((await listOpenTasks({ dueBefore: endOfToday() })).length);
                const autos = await listAutomations();
                const next = autos
                    .filter((a) => a.enabled === 1 && a.next_run_at !== null)
                    .map((a) => a.next_run_at!)
                    .sort((a, b) => a - b)[0];
                setNextRun(next ?? null);
            } catch {
                // keep last values
            }
        };
        void refresh();
        const timer = setInterval(() => void refresh(), 60_000);
        return () => clearInterval(timer);
    }, []);

    return (
        <>
            {dueToday !== null && dueToday > 0 && (
                <button
                    className="cursor-pointer hover:text-foreground"
                    onClick={() => onNavigate({ page: "planner", tab: "tasks" })}
                >
                    {dueToday} due today
                </button>
            )}
            {nextRun !== null && (
                <button
                    className="cursor-pointer hover:text-foreground"
                    onClick={() => onNavigate({ page: "agents", tab: "automations" })}
                >
                    next run {relativeTime(nextRun)}
                </button>
            )}
        </>
    );
}
```

Check `relativeTime`'s unit expectations against `next_run_at` (both are ms-era values in this codebase; if `relativeTime` renders nonsense for ms input, format inline with `toLocaleTimeString` instead and note it).

- [ ] **Step 2: Compose in Shell**

```tsx
            <StatusBar>
                <span>db linked</span>
                <button
                    className="cursor-pointer hover:text-foreground"
                    onClick={() => setNav({ page: "settings" })}
                >
                    {settings.defaultProvider}/{settings.defaultModel}
                </button>
                <StatusReadouts onNavigate={setNav} />
            </StatusBar>
```

- [ ] **Step 3: Gates + browser check + commit**

Run: `npm run typecheck && npm test` — Expected: PASS.
Browser: with a task due today the count appears and clicks through to Tasks; with an enabled automation the next-run chip appears and clicks through; model chip opens Settings.

```bash
git add src/components/hud/StatusReadouts.tsx src/app/Shell.tsx
git commit -m "feat: status bar gains live due-today and next-automation readouts"
```

---

### Task 8: Refresh persistence — nav position + chat drafts

Reload must land you where you were: same page, same tab, same open chat — and a half-typed chat message survives. Tab changes inside pages currently never reach `NavTarget`, so pages gain an `onTabChange` callback and ChatWorkspace reports the open session; Shell persists the merged NavTarget.

**Files:**
- Create: `src/lib/navPersist.ts`, `src/lib/navPersist.test.ts`
- Modify: `src/app/Shell.tsx` (restore + persist; thread callbacks)
- Modify: `src/app/agents/AgentsPage.tsx`, `src/app/notes/NotesPage.tsx`, `src/app/planner/PlannerPage.tsx` (report tab changes)
- Modify: `src/app/chat/ChatWorkspace.tsx` (report opened session)
- Modify: `src/components/chat/Composer.tsx` (draftKey persistence)

**Interfaces:**
- `loadNav(): NavTarget | null` / `saveNav(t: NavTarget): void` from `src/lib/navPersist.ts`.
- Pages gain `onTabChange?: (tab: string) => void`; `ChatWorkspace` gains `onSessionOpened?: (id: string | null) => void`; `Composer` gains `draftKey?: string`.

- [ ] **Step 1: Failing test — `src/lib/navPersist.test.ts`**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { loadNav, saveNav } from "./navPersist";

// Node 22+ exposes localStorage in vitest's node environment via --experimental
// APIs inconsistently — stub a minimal one for determinism.
beforeEach(() => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear(),
        key: () => null,
        length: 0,
    } as Storage;
});

describe("nav persistence", () => {
    it("round-trips a NavTarget", () => {
        saveNav({ page: "planner", tab: "calendar" });
        expect(loadNav()).toEqual({ page: "planner", tab: "calendar" });
    });

    it("rejects unknown pages and garbage", () => {
        localStorage.setItem("hugh.nav.v1", JSON.stringify({ page: "nope" }));
        expect(loadNav()).toBeNull();
        localStorage.setItem("hugh.nav.v1", "not json");
        expect(loadNav()).toBeNull();
    });

    it("keeps sessionId and projectId strings only", () => {
        localStorage.setItem(
            "hugh.nav.v1",
            JSON.stringify({ page: "agents", tab: "chat", sessionId: 42 }),
        );
        expect(loadNav()).toEqual({ page: "agents", tab: "chat" });
    });
});
```

Run: `npx vitest run src/lib/navPersist.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 2: Implement `src/lib/navPersist.ts`**

```ts
import type { NavTarget, Page } from "@/app/Sidebar";

const KEY = "hugh.nav.v1";
const PAGES: readonly Page[] = [
    "home",
    "agents",
    "categories",
    "notes",
    "planner",
    "presets",
    "permissions",
    "settings",
];

/** Last nav position, or null when unset/corrupt. Never throws. */
export function loadNav(): NavTarget | null {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (!PAGES.includes(parsed.page as Page)) return null;
        const nav: NavTarget = { page: parsed.page as Page };
        if (typeof parsed.tab === "string") nav.tab = parsed.tab;
        if (typeof parsed.sessionId === "string") nav.sessionId = parsed.sessionId;
        if (typeof parsed.projectId === "string") nav.projectId = parsed.projectId;
        return nav;
    } catch {
        return null;
    }
}

export function saveNav(t: NavTarget): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(t));
    } catch {
        // storage full/blocked — losing persistence is fine, breaking nav isn't
    }
}
```

Run the test — Expected: PASS.

- [ ] **Step 3: Shell restore + persist + callbacks**

```tsx
    const [nav, setNav] = useState<NavTarget>(() => loadNav() ?? { page: "home" });
    useEffect(() => {
        saveNav(nav);
    }, [nav]);
    const onTabChange = useCallback(
        (tab: string) => setNav((n) => ({ ...n, tab })),
        [],
    );
```

Pass `onTabChange={onTabChange}` to AgentsPage/NotesPage/PlannerPage, and to AgentsPage additionally `onSessionOpened={(id) => setNav((n) => ({ ...n, sessionId: id ?? undefined }))}` (threaded to ChatWorkspace).

In each of the three pages, the TabBar's `onSelect` wraps:

```tsx
                <TabBar
                    tabs={TABS}
                    active={active}
                    onSelect={(t) => {
                        setActive(t);
                        onTabChange?.(t);
                    }}
                />
```

In `ChatWorkspace`, call `onSessionOpened?.(session.id)` at the end of `openSession`'s success path, and `onSessionOpened?.(null)` when the active session is deleted (in `deleteInstance`'s branch that clears `active`). The existing `initialSessionId` deep-link effect then restores the chat on reload.

- [ ] **Step 4: Composer drafts**

`Composer` props gain `draftKey?: string`. Behavior:

```tsx
    const [text, setText] = useState(() => {
        if (!draftKey) return "";
        try {
            return localStorage.getItem(`hugh.draft.${draftKey}`) ?? "";
        } catch {
            return "";
        }
    });

    // Persist the draft, debounced; clear the key when the draft empties.
    useEffect(() => {
        if (!draftKey) return;
        const key = `hugh.draft.${draftKey}`;
        const handle = setTimeout(() => {
            try {
                if (text) localStorage.setItem(key, text);
                else localStorage.removeItem(key);
            } catch {
                // best-effort
            }
        }, 300);
        return () => clearTimeout(handle);
    }, [draftKey, text]);
```

The send path already does `setText("")` — the effect then removes the key. In `ChatWorkspace`'s `ActiveChatView`, pass `draftKey={active.session.id}` to `<Composer …>`.

- [ ] **Step 5: Gates + browser check + commit**

Run: `npm run typecheck && npm test` — Expected: PASS.
Browser: open Planner→Calendar, reload → still there; open a chat, reload → same chat open; type into the composer without sending, reload → text restored; send → draft gone after reload; switch tabs via ⌘K palette → also persisted.

```bash
git add src/lib/navPersist.ts src/lib/navPersist.test.ts src/app/Shell.tsx src/app/agents/AgentsPage.tsx src/app/notes/NotesPage.tsx src/app/planner/PlannerPage.tsx src/app/chat/ChatWorkspace.tsx src/components/chat/Composer.tsx
git commit -m "feat: refresh keeps your place — nav position and chat drafts persist"
```

---

### Task 9: Tasks tab — status + due-window filters (QA request)

QA asked for "more detailed filtering, including the ability to hide already completed tasks." Open tasks get a due-window filter row (Overdue / Today / This week) alongside the category chips, and a "show completed" toggle reveals recently-completed tasks with reopen/delete. The repo already has everything (`listCompletedTasks(limit=30)`, `reopenTask`) — this is pure TasksTab UI.

**Files:**
- Modify: `src/app/planner/TasksTab.tsx`

**Interfaces:**
- Consumes: `tasksRepo.listCompletedTasks`, `tasksRepo.reopenTask`, `FilterChips`.
- Produces: no new exports.

- [ ] **Step 1: Due-window filter**

```tsx
type DueWindow = "overdue" | "today" | "week";
const DUE_WINDOWS: { id: DueWindow; label: string }[] = [
    { id: "overdue", label: "Overdue" },
    { id: "today", label: "Today" },
    { id: "week", label: "This week" },
];

function inDueWindow(t: Task, w: DueWindow): boolean {
    if (t.due_at === null) return false;
    const now = Date.now();
    if (w === "overdue") return t.due_at < now;
    const eod = new Date();
    eod.setHours(23, 59, 59, 999);
    if (w === "today") return t.due_at <= eod.getTime();
    return t.due_at <= now + 7 * DAY;
}
```

State `const [dueWindow, setDueWindow] = useState<DueWindow | null>(null);` — a second `FilterChips` row (`options={DUE_WINDOWS}`, `allLabel="Any due date"`) under the category chips. The list filter composes: `tasks.filter((t) => (!categoryFilter || t.category_id === categoryFilter) && (!dueWindow || inDueWindow(t, dueWindow)))`. ("Today"/"This week" deliberately include overdue items — an overdue task is still due today.)

- [ ] **Step 2: Completed section**

```tsx
    const [showCompleted, setShowCompleted] = useState(false);
    const [completed, setCompleted] = useState<Task[]>([]);
    useEffect(() => {
        if (showCompleted) void tasksRepo.listCompletedTasks().then(setCompleted);
    }, [showCompleted, tasks]);
```

(`tasks` in the deps so completing a task while the section is open refreshes it.) Below the open-task list:

```tsx
            <button
                className="cursor-pointer self-start font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                onClick={() => setShowCompleted((v) => !v)}
            >
                {showCompleted ? "hide completed" : "show completed"}
            </button>
            {showCompleted && (
                <div className="flex flex-col gap-1.5 opacity-70">
                    {completed.map((t) => (
                        <div
                            key={t.id}
                            className="flex items-center gap-3 rounded-md border border-border/60 bg-card/40 px-3 py-2"
                        >
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Reopen ${t.title}`}
                                onClick={() => void act(() => tasksRepo.reopenTask(t.id))}
                            >
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                            <span className="flex-1 text-sm line-through decoration-muted-foreground/50">
                                {t.title}
                            </span>
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
                    {completed.length === 0 && (
                        <p className="text-xs text-muted-foreground">Nothing completed yet.</p>
                    )}
                </div>
            )}
```

(Import `RotateCcw` from lucide-react. `act` is TasksTab's existing helper — reopening triggers `reload()`, which refreshes the open list too.)

- [ ] **Step 3: Gates + commit**

Run: `npm run typecheck && npm test` — Expected: PASS.
(User-checkable later: window chips compose with category chips; completed section reopens/deletes.)

```bash
git add src/app/planner/TasksTab.tsx
git commit -m "feat: task due-window filters and a completed section with reopen"
```

---

### Task 10: Docs, gates, close the todo round

**Files:**
- Modify: `docs/todo.md` (check off this round's UX/Features items; keep "possible future problems" as-is)
- Modify: `docs/architecture.md` (data-model note: `events.source = 'manual'` for user-created events; one line in the shell description for status readouts)

- [ ] **Step 1: docs/todo.md** — mark the five UX items and four Features items `[x]`-style or move them into a dated "shipped 2026-07-XX" section matching the file's existing convention; leave the not-urgent section untouched.

- [ ] **Step 2: docs/architecture.md** — in the data-model block's `events` row (or nearest prose), note manual events (`source 'manual'`, created/deleted from the calendar). No restructuring.

- [ ] **Step 3: Full gates**

Run: `npm run typecheck && npm test` — Expected: PASS, no skips.

- [ ] **Step 4: Full browser QA sweep** (Playwright; fall back to a human pass only if the browser cannot launch): run the browser checks from Tasks 1-8 end to end against a fresh `npm run dev`, plus one regression lap: categories page, calendar modes, chat search/filter, pipelines template run, review tab.

- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "docs: close out the home/polish todo round"
```

---

## Self-Review (performed while writing)

**Todo coverage:**
- *Calendar event creation UI* → Task 2 (QuickEvent, `source: "manual"`, delete).
- *1-day view* → Task 2 Step 3.
- *Exo-sphere mostly out of view until scroll-out* → Task 3 (zoom-driven reveal, hit gating, first-paint hidden).
- *Agent visualization back, subtler* → Task 4 (agent-only satellites at r=1.0, chips on hover; explicitly paired with the exo fix as the todo suggests).
- *New chats/notes inherit project/category context* → Task 5 (creationCategoryId, project-star navigation → ProjectDetail's existing project-chat flow, notes inherit filter, CategoryDetail New-note-here).
- *Automation research lookups fail* → Task 1, root-caused to the stale KNOWN_TOOLS list (verified against src/app/permissions/PermissionsPage.tsx:11 — search_web absent → ungrantable → auto-denied headless). Coverage test + preflight warning prevent recurrence.
- *Home menu functionality* → Task 6 (bookmarks strip with openExternal, quick capture, recent chats, clickable tiles/cards).
- *Bottom tab functionality* → Task 7 (recommended yes, at small scale; decision recorded).
- *Refresh loses place/progress* → Task 8 (nav restore incl. tab + open session, composer drafts; task quick-add drafts deliberately skipped, recorded).
- *"Possible future problems"* → deliberately untouched, per the todo's own framing.
- *QA round (2026-07-17)*: relativeTime ms bug → Task 3 Step 0a; exo-shell too close → Task 3 Step 0b (1.75); double-click rename → Task 5 Step 5b; detailed task filtering + hide completed → Task 9.

**Placeholder scan:** all code steps carry code; the spots requiring reconciliation with live code name the exact file/line (PermissionsPage JSX around line 183, Badge warning tone, `listBookmarks` filter signature, `relativeTime` unit check, networkData test factory names).

**Type consistency:** `NavTarget.projectId` (Task 5 Step 1) matches `navPersist`'s field handling (Task 8 Step 2); `onTabChange`/`onSessionOpened` signatures match between Shell (Task 8 Step 3) and the pages; `CalendarItem.refId`/`manual` (Task 2 Step 2) match DayList's `onDeleteManual` usage (Step 4); `attachAgent`'s opts (Task 4) default to prior behavior so existing callers/tests stay valid; `InstancesSidebar`'s lifted `categoryFilter` props (Task 5 Step 2) match ChatWorkspace's state and the Task 8 changes don't touch them.
