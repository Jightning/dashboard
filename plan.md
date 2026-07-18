# Trust & Hosting Implementation Plan — todo round of 2026-07-17 (evening)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make web search trustworthy end-to-end (a builtin "Reads only" level that can't be misconfigured, an exhaustive engine test, scoped-grant validation, preflight on manual runs), bound chat-draft storage (size cap, TTL, pruning), give the 1-day calendar a full hourly timeline, let projects accept pasted-text documents, rebuild the exo-sphere as unlimited pull-in layers with the inner sphere fading on zoom-out, finish the Ollama story (connection test + live model list + hosted guidance), surface provider usage so free-tier limits stop being a surprise, and make the repo deployable to a real host (Cloudflare Pages: headers + a production proxy function + docs).

**Scope decision (per the user's instruction to focus):** four todo items are deliberately **deferred to the next round** and stay in `docs/todo.md`: the School/Schedule tab restructure (courses→projects is an IA redesign deserving its own round), private instances (a cross-cutting privacy model), file attachments in automation/pipeline contexts, and home-menu widgets/rearranging (a customization framework). Everything else in the todo is planned here.

**Architecture:** Zero migrations again — the builtin level is seed data, drafts live in localStorage, usage reads the existing per-message token columns, the exo layers are pure draw-pass math, and hosting adds only static/function files outside `src/`. Hosting targets **Cloudflare Pages** (free tier): a `public/_headers` file supplies the COOP/COEP headers OPFS needs (GitHub Pages can't set headers), and a `functions/__proxy.ts` Pages Function serves the same `/__proxy?url=` contract the Vite dev middleware serves, so `wrapWebFetch` works unchanged in production.

**Diagnosis notes (verified while planning):**
- DuckDuckGo's HTML endpoint answers plain Node fetches from this machine — 10 results, no UA needed. The search *network* path is healthy; the reported "denied" is the permission engine.
- Chat delegation tools (`ask_*_agent`) are not gated — the deny originates at the web tool's own gate. Most likely cause: a hand-built grant that never matches (the UI accepts a `url_domain`/`doc_folder` grant with an **empty scope value**, which `grantMatches` can never satisfy), or a level missing `search_web` (only grantable since this morning). Task 1 removes the whole failure class rather than guessing: a seeded always-correct level, validation that rejects value-less scoped grants, and a test that pins every read tool to "allow" under that level.

**Tech Stack:** unchanged; **no new dependencies, no migrations**. Cloudflare deployment uses the dashboard git integration — no wrangler.

## Global Constraints

- **Branch:** `feat/home-signal` is merged (or pending merge — if unmerged when this starts, merge it first after the user's sign-off). Then `git checkout -b feat/trust-hosting` from main; commit this plan + the trimmed `docs/todo.md` as the first commit.
- **$0 budget:** no new npm packages, no paid services. Cloudflare Pages free tier only; deploy is documented, not executed (no credentials here).
- **No migrations.** If a task seems to need a column, stop and report BLOCKED.
- **Perf contract (WSLg):** no SVG filters, no backdrop-blur, no per-frame allocations in HUD components; the layer/pull-in math is scalar, computed inside the existing single rAF pass.
- **localStorage stays bounded and guarded:** every read tolerates garbage; writes are try/caught; Task 2's caps make the draft namespace self-limiting.
- **`functions/` and `public/` are host-target files** — they are not part of the app's src style rules, but `functions/__proxy.ts` must typecheck standalone (structural types, no `@cloudflare/workers-types` dep; exclude the dir in tsconfig if the sweep picks it up).
- **Gates:** `npm run typecheck` and `npm test` before every commit; `npm run build` must also pass in the hosting task (it is the deploy artifact).
- **Execution mode (per user):** streamlined — no per-task reviewer subagents; implementers self-review hard, the controller spot-checks diffs, one final whole-branch review at the end. Browser checks are deferred to the user unless urgent.
- **Style:** 4-space indent, double quotes, `cn()`, repos throw on missing rows, `void` for fire-and-forget — match the file you edit.

## File Structure (what exists after the plan)

```txt
src/db/repo/permissions.ts             MOD  seed "Reads only" builtin level from TOOL_CATALOG
src/db/repo/permissions.test.ts        NEW? (or extend existing engine tests' file) reads-only coverage
src/app/permissions/PermissionsPage.tsx MOD  reject scoped grants without a value
src/ai/permissions/preflight.ts        NEW  ungrantedTools moved here (shared)
src/app/agents/AutomationsTab.tsx      MOD  import preflight from shared module
src/app/agents/PipelinesTab.tsx        MOD  preflight warning on manual-run level select
src/lib/drafts.ts                      NEW  bounded draft load/save/prune (size cap, TTL, count cap)
src/lib/drafts.test.ts                 NEW
src/components/chat/Composer.tsx       MOD  use drafts.ts instead of raw localStorage
src/app/chat/ChatWorkspace.tsx         MOD  draft prune on delete via drafts.ts
src/app/planner/CalendarTab.tsx        MOD  HourDay timeline for the 1-day view
src/components/hud/networkData.ts      MOD  exo layer assignment (shell per layer)
src/components/hud/networkData.test.ts MOD  layer cases
src/components/hud/NetworkSphere.tsx   MOD  staged layer reveal, pull-in, inner fade
src/app/projects/ProjectDetail.tsx     MOD  "Add text" document creation
src/db/repo/documents.ts               MOD  createTextDocument (if no equivalent exists)
src/app/settings/SettingsPage.tsx      MOD  Ollama test-connection + model list; Usage card
src/db/repo/usage.ts                   MOD? (only if usageByDay's shape needs a provider column)
public/_headers                        NEW  COOP/COEP for OPFS on the host
functions/__proxy.ts                   NEW  Cloudflare Pages Function mirroring the dev proxy
docs/hosting.md                        NEW  deploy guide + hosted-mode caveats
docs/todo.md                           MOD  solved items removed; deferred items kept
docs/architecture.md                   MOD  hosting section pointer; Reads-only level
```

Deliberately **deferred** (kept in `docs/todo.md` for the next round): School/Schedule tab (courses→projects restructure), private instances, automation/pipeline file inclusion, home widgets. Deliberately **not** done: no server-side key handling for the hosted build (keys remain per-visitor, client-side — documented); no search-provider fallback beyond DDG (verified working; revisit only if it starts blocking).

---

### Task 1: Web search you can trust — "Reads only" level, exhaustive test, grant validation, manual-run preflight

**Files:**
- Modify: `src/db/repo/permissions.ts` (seed the level)
- Create: `src/db/repo/permissions.test.ts` (if absent — else extend the engine's test file)
- Modify: `src/app/permissions/PermissionsPage.tsx` (scoped-grant validation)
- Create: `src/ai/permissions/preflight.ts` (move `ungrantedTools` out of AutomationsTab)
- Modify: `src/app/agents/AutomationsTab.tsx`, `src/app/agents/PipelinesTab.tsx`

**Interfaces:**
- Produces: `BUILTIN_LEVELS.readsOnly = "lvl_reads_only"`; `ungrantedTools(pipelineId: string, levelId: string | null): Promise<string[]>` exported from `@/ai/permissions/preflight`.

- [ ] **Step 1: Failing test — reads-only coverage**

In the permissions repo test file (create with the standard testClient hooks if absent):

```ts
import { TOOL_CATALOG } from "@/ai/tools/catalog";
import { evaluateToolCall, SessionGrants, toScopedGrant } from "@/ai/permissions/engine";
import { webScopeResolvers } from "@/ai/tools/web";
import { BUILTIN_LEVELS, listGrants, seedBuiltinLevels } from "./permissions";

describe("Reads only builtin level", () => {
    it("auto-allows every read tool in the catalog, including real web scopes", async () => {
        await seedBuiltinLevels();
        const levelGrants = (await listGrants(BUILTIN_LEVELS.readsOnly)).map(toScopedGrant);
        const sessionGrants = new SessionGrants();
        for (const entry of TOOL_CATALOG) {
            if (entry.access !== "read") continue;
            // Representative scopes per type; web tools use their REAL resolvers.
            const scope =
                entry.name === "search_web"
                    ? await webScopeResolvers.search_web!({ query: "x" })
                    : entry.name === "fetch_url"
                      ? await webScopeResolvers.fetch_url!({ url: "https://example.com/a" })
                      : { access: "read" as const, scopeType: "doc_folder" as const, scopeValue: "/anywhere" };
            expect(
                evaluateToolCall({ tool: entry.name, scope, levelGrants, sessionGrants }),
                `${entry.name} should auto-allow under Reads only`,
            ).toBe("allow");
        }
    });

    it("write tools still ask under Reads only", async () => {
        await seedBuiltinLevels();
        const levelGrants = (await listGrants(BUILTIN_LEVELS.readsOnly)).map(toScopedGrant);
        expect(
            evaluateToolCall({
                tool: "write_note",
                scope: { access: "write", scopeType: "doc_folder", scopeValue: "/x" },
                levelGrants,
                sessionGrants: new SessionGrants(),
            }),
        ).toBe("ask");
    });

    it("re-seeding is idempotent", async () => {
        await seedBuiltinLevels();
        const before = (await listGrants(BUILTIN_LEVELS.readsOnly)).length;
        await seedBuiltinLevels();
        expect((await listGrants(BUILTIN_LEVELS.readsOnly)).length).toBe(before);
    });
});
```

(Adapt the non-web representative scope if some read tool resolves `any` — check each tool module's resolver; the point is the REAL scope type each tool emits must match the grant. If a tool's resolver is exported, prefer calling it like the web ones.)

Run: expect FAIL (`BUILTIN_LEVELS.readsOnly` missing).

- [ ] **Step 2: Seed the level in `permissions.ts`**

Add to `BUILTIN_LEVELS`: `readsOnly: "lvl_reads_only",`. In `seedBuiltinLevels()`, after the existing seeds:

```ts
    await getDb().execute(
        `INSERT OR IGNORE INTO permission_levels (id, name, description, is_builtin, created_at)
     VALUES (?, ?, ?, 1, ?)`,
        [
            BUILTIN_LEVELS.readsOnly,
            "Reads only",
            "Every read tool runs without asking; anything that writes still asks.",
            t,
        ],
    );
    // One grant per read tool, derived from the catalog so new read tools are
    // covered on the next boot automatically.
    for (const entry of TOOL_CATALOG) {
        if (entry.access !== "read") continue;
        await getDb().execute(
            `INSERT OR IGNORE INTO permission_grants (id, level_id, tool, access, scope_type, scope_value)
         VALUES (?, ?, ?, 'read', 'any', NULL)`,
            [`grt_reads_only_${entry.name}`, BUILTIN_LEVELS.readsOnly, entry.name],
        );
    }
```

Import `TOOL_CATALOG` from `@/ai/tools/catalog` (verify no import cycle — catalog imports tool modules and the engine types, never the repos' callers; if a cycle appears, report BLOCKED rather than inlining a copy). Run the new tests → PASS. Existing DBs pick the level up on next boot (`seedBuiltinLevels` runs every bootstrap, `INSERT OR IGNORE`).

- [ ] **Step 3: Reject value-less scoped grants in `PermissionsPage.tsx`**

In `addGrant`, before calling the repo:

```ts
            if (scopeType !== "any" && !scopeValue.trim())
                throw new Error(
                    scopeType === "doc_folder"
                        ? "a folder-scoped grant needs a folder (e.g. /school)"
                        : "a domain-scoped grant needs a domain (e.g. example.com)",
                );
```

(Inside the existing try so it lands in the error state.) This closes the "grant that can never match" trap — the likely cause of the reported denials.

- [ ] **Step 4: Share the preflight**

Create `src/ai/permissions/preflight.ts` and move `ungrantedTools` (and its imports) there verbatim from AutomationsTab; export it; AutomationsTab imports it. In `PipelinesTab`, add the same stale-guarded effect keyed on `[runsFor-independent]` — concretely: state `ungranted`, an effect watching `[levelId]` that, when a pipeline is about to run, is not enough — simplest correct UX: compute per-pipeline on demand next to the Run button is noisy; instead compute once for the SELECTED level against the pipeline being run, at click time is too late to warn. Do this: an effect watching `[levelId, pipelines]` that maps every pipeline id → ungranted list (`Promise.all`), stored as `Record<string, string[]>`; render the warning line inside each pipeline's Card when non-empty:

```tsx
                        {(ungrantedByPipeline[p.id] ?? []).length > 0 && (
                            <p className="text-xs text-warning">
                                With this level, unattended/denied tools:{" "}
                                {ungrantedByPipeline[p.id]!.join(", ")} — approval
                                cards will ask during manual runs.
                            </p>
                        )}
```

(Use the same warning color AutomationsTab's line uses.)

- [ ] **Step 5: Gates + commit**

`npm run typecheck && npm test` → PASS.

```bash
git add src/db/repo/permissions.ts src/db/repo/permissions.test.ts src/app/permissions/PermissionsPage.tsx src/ai/permissions/preflight.ts src/app/agents/AutomationsTab.tsx src/app/agents/PipelinesTab.tsx
git commit -m "feat: builtin Reads-only level, scoped-grant validation, shared preflight"
```

(User check later: pick "Reads only" on a Research chat → search runs with zero approval cards.)

---

### Task 2: Bounded chat drafts — size cap, TTL, pruning

**Files:**
- Create: `src/lib/drafts.ts`, `src/lib/drafts.test.ts`
- Modify: `src/components/chat/Composer.tsx`, `src/app/chat/ChatWorkspace.tsx`

**Interfaces:**
- Produces: `loadDraft(sessionId): string`, `saveDraft(sessionId, text): void`, `removeDraft(sessionId): void`, `pruneDrafts(): void` from `@/lib/drafts`. Constants: `MAX_DRAFT_CHARS = 8_000`, `DRAFT_TTL_MS = 14 * 86_400_000`, `MAX_DRAFTS = 20`.

- [ ] **Step 1: Failing tests — `src/lib/drafts.test.ts`** (reuse navPersist.test.ts's localStorage stub pattern):

```ts
describe("bounded drafts", () => {
    it("round-trips and accepts legacy plain-string values", () => {
        saveDraft("ses_a", "hello");
        expect(loadDraft("ses_a")).toBe("hello");
        localStorage.setItem("hugh.draft.ses_old", "legacy text");
        expect(loadDraft("ses_old")).toBe("legacy text");
    });

    it("caps draft size", () => {
        saveDraft("ses_big", "x".repeat(MAX_DRAFT_CHARS + 5));
        expect(loadDraft("ses_big").length).toBe(MAX_DRAFT_CHARS);
    });

    it("expires drafts past the TTL", () => {
        localStorage.setItem(
            "hugh.draft.ses_stale",
            JSON.stringify({ t: "old", at: Date.now() - DRAFT_TTL_MS - 1 }),
        );
        expect(loadDraft("ses_stale")).toBe("");
        expect(localStorage.getItem("hugh.draft.ses_stale")).toBeNull();
    });

    it("prunes to the newest MAX_DRAFTS", () => {
        for (let i = 0; i < MAX_DRAFTS + 5; i++) {
            localStorage.setItem(
                `hugh.draft.ses_${i}`,
                JSON.stringify({ t: `d${i}`, at: i }),
            );
        }
        pruneDrafts();
        const remaining = Object.keys(localStorage._dump?.() ?? {}); // adapt to the stub
        // newest MAX_DRAFTS survive; the 5 oldest (smallest at) are gone
        expect(loadDraft("ses_0")).toBe("");
        expect(loadDraft(`ses_${MAX_DRAFTS + 4}`)).toBe(`d${MAX_DRAFTS + 4}`);
    });
});
```

(The stub must support key enumeration — extend the navPersist stub with a backing Map the test can inspect, or assert via `loadDraft` results only, as the last two expects do; drop the `_dump` line if so.)

- [ ] **Step 2: Implement `src/lib/drafts.ts`**

```ts
const PREFIX = "hugh.draft.";
export const MAX_DRAFT_CHARS = 8_000;
export const DRAFT_TTL_MS = 14 * 86_400_000;
export const MAX_DRAFTS = 20;

interface DraftEnvelope {
    t: string;
    at: number;
}

function parse(raw: string): DraftEnvelope {
    try {
        const v = JSON.parse(raw) as { t?: unknown; at?: unknown };
        if (typeof v.t === "string" && typeof v.at === "number")
            return { t: v.t, at: v.at };
    } catch {
        // legacy plain-string draft
    }
    return { t: raw, at: Date.now() };
}

/** Draft text for a session; "" when absent/expired. Expired keys are removed. */
export function loadDraft(sessionId: string): string {
    try {
        const raw = localStorage.getItem(PREFIX + sessionId);
        if (!raw) return "";
        const env = parse(raw);
        if (Date.now() - env.at > DRAFT_TTL_MS) {
            localStorage.removeItem(PREFIX + sessionId);
            return "";
        }
        return env.t;
    } catch {
        return "";
    }
}

/** Persist (capped) or clear; prunes the namespace as a side effect. */
export function saveDraft(sessionId: string, text: string): void {
    try {
        const key = PREFIX + sessionId;
        if (!text) {
            localStorage.removeItem(key);
            return;
        }
        localStorage.setItem(
            key,
            JSON.stringify({ t: text.slice(0, MAX_DRAFT_CHARS), at: Date.now() }),
        );
        pruneDrafts();
    } catch {
        // best-effort
    }
}

export function removeDraft(sessionId: string): void {
    try {
        localStorage.removeItem(PREFIX + sessionId);
    } catch {
        // best-effort
    }
}

/** Drop expired drafts and everything beyond the newest MAX_DRAFTS. */
export function pruneDrafts(): void {
    try {
        const entries: { key: string; at: number }[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key?.startsWith(PREFIX)) continue;
            const env = parse(localStorage.getItem(key) ?? "");
            entries.push({ key, at: env.at });
        }
        const now = Date.now();
        const dead = entries.filter((e) => now - e.at > DRAFT_TTL_MS);
        const live = entries
            .filter((e) => now - e.at <= DRAFT_TTL_MS)
            .sort((a, b) => b.at - a.at);
        for (const e of dead) localStorage.removeItem(e.key);
        for (const e of live.slice(MAX_DRAFTS)) localStorage.removeItem(e.key);
    } catch {
        // best-effort
    }
}
```

(NOTE: the localStorage stub in the tests must implement `length` and `key(i)` for `pruneDrafts` — extend the stub accordingly.)

- [ ] **Step 3: Swap the call sites**

`Composer.tsx`: initial state uses `loadDraft(draftKey)`; the debounced effect and its flush-cleanup call `saveDraft(draftKey, text)` (which handles the empty→remove case — delete the inline try/catch blocks). `ChatWorkspace.tsx` `deleteInstance`: replace the inline `localStorage.removeItem(...)` with `removeDraft(session.id)`.

- [ ] **Step 4: Gates + commit**

`npm run typecheck && npm test` → PASS.

```bash
git add src/lib/drafts.ts src/lib/drafts.test.ts src/components/chat/Composer.tsx src/app/chat/ChatWorkspace.tsx
git commit -m "feat: chat drafts are size-capped, expire after 14 days, and prune to 20"
```

---

### Task 3: 1-day calendar shows every hour

**Files:**
- Modify: `src/app/planner/CalendarTab.tsx`

**Interfaces:** none new; `HourDay` is module-private.

- [ ] **Step 1: `HourDay` component**

Replace the 1d branch (`<DayList days={1} …>`) with `<HourDay from={from} items={visible} onDeleteManual={…} />`:

```tsx
function HourDay({
    from,
    items,
    onDeleteManual,
}: {
    from: number;
    items: CalendarItem[];
    onDeleteManual?: (item: CalendarItem) => void;
}) {
    const nowHour =
        startOfDay(Date.now()) === from ? new Date().getHours() : -1;
    return (
        <div className="flex flex-col">
            {Array.from({ length: 24 }, (_, h) => {
                const hourStart = from + h * 3_600_000;
                const hourItems = items.filter(
                    (x) => x.at >= hourStart && x.at < hourStart + 3_600_000,
                );
                return (
                    <div
                        key={h}
                        className={cn(
                            "flex min-h-8 gap-3 border-t border-border/40 px-1 py-0.5",
                            h === nowHour && "bg-primary/5",
                        )}
                    >
                        <span
                            className={cn(
                                "w-12 shrink-0 pt-0.5 text-right font-mono text-[10px] text-muted-foreground/70",
                                h === nowHour && "text-primary",
                            )}
                        >
                            {new Date(hourStart).toLocaleTimeString(undefined, {
                                hour: "numeric",
                            })}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            {hourItems.map((x) => (
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
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
```

(Match `ItemChip`'s actual onDelete prop wiring from the current file — DayList passes it the same way. Empty hours render as thin rows, which is the point: gaps become visible.)

- [ ] **Step 2: Gates + commit**

`npm run typecheck && npm test` → PASS.

```bash
git add src/app/planner/CalendarTab.tsx
git commit -m "feat: 1-day calendar renders a full hourly timeline"
```

---

### Task 4: Paste-text documents in projects (+ confirm metadata-only file referencing)

The todo's "files referenced with just the metadata" is **already true by design** — documents reach the model only through `search_documents`/`read_document` retrieval; nothing inlines file bodies into chat context. This task adds the claude.ai-style "add your own text" affordance next to the existing upload, and records the retrieval guarantee in the architecture doc so the question stays answered.

**Files:**
- Modify: `src/app/projects/ProjectDetail.tsx` (Add-text form in the files section)
- Modify: `src/db/repo/documents.ts` (only if no plain-text create function exists — check first; PDF ingestion may already route through a general insert)
- Modify: `docs/architecture.md` (one sentence in the retrieval/multimodal area)

**Interfaces:**
- Produces (if created): `createTextDocument(input: { title: string; contentText: string; folder: string; projectId?: string | null }): Promise<Document>` — mime `text/plain`, `source_name: null`, `byte_size: contentText.length`, `page_count: null`. FTS sync is automatic (documents_fts triggers exist since 0001).

- [ ] **Step 1: Check the repo, add the function if missing (with a small test)**

Read `src/db/repo/documents.ts`. If an insert covering plain text exists, reuse it. Otherwise add `createTextDocument` per the interface above (mirror the file's insert style) plus a test in the documents/repo test file: create → `searchDocuments("planted phrase")` finds it (proves FTS trigger coverage) and `project_id` round-trips.

- [ ] **Step 2: ProjectDetail UI**

In the files section, next to the existing upload control, an "Add text" toggle revealing an inline form (Input title + Textarea body + Save/Cancel), submitting through the page's existing error-handling helper:

```tsx
    const [addingText, setAddingText] = useState(false);
    const [textTitle, setTextTitle] = useState("");
    const [textBody, setTextBody] = useState("");
```

Save handler: require both trimmed non-empty, call the create function with the project's folder convention (match whatever folder the existing upload path assigns — read the upload code and use the same value) and `projectId: project.id`, then clear + refresh the file list. Keep the form styling consistent with the page's other inline forms.

- [ ] **Step 3: docs/architecture.md** — one sentence where retrieval is described: project files enter chats only via retrieval tools (search/read), never inlined; pasted-text documents follow the same path.

- [ ] **Step 4: Gates + commit**

`npm run typecheck && npm test` → PASS.

```bash
git add src/app/projects/ProjectDetail.tsx src/db/repo/documents.ts docs/architecture.md
git commit -m "feat: projects accept pasted-text documents; retrieval-only guarantee documented"
```

(Include the repo test file in the add if created.)

---

### Task 5: Exo-sphere as unlimited pull-in layers; inner sphere fades on zoom-out

The redesign the todo asks for: exo chats split into rings of at most `EXO_LAYER_SIZE`, unlimited ring count. At rest nothing exo is visible. Scrolling out reveals ring 0 first — sliding in from farther away (scroll-driven "pull-in animation") — then ring 1, ring 2, … while the inner sphere fades back so the revealed ring reads as the focus.

**Files:**
- Modify: `src/components/hud/networkData.ts` (layer assignment)
- Modify: `src/components/hud/networkData.test.ts`
- Modify: `src/components/hud/NetworkSphere.tsx` (staged reveal, pull-in, inner fade)

**Interfaces:**
- `EXO_LAYER_SIZE = 12`, `EXO_SHELL_BASE = 1.75`, `EXO_SHELL_STEP = 0.4` exported from networkData. A node's layer is derivable from its shell: `Math.round((shell - EXO_SHELL_BASE) / EXO_SHELL_STEP)`; NetworkSphere derives it with that arithmetic (no new node field).

- [ ] **Step 1: Failing test — layer assignment**

```ts
    it("splits exo overflow into rings of EXO_LAYER_SIZE with stepped shells", () => {
        const sessions = Array.from({ length: CATEGORY_INNER + 30 }, (_, i) =>
            session(`ses_${i}`, { category_id: "cat_a", updated_at: 1000 - i }),
        );
        const net = buildCategoryUniverse({
            categories: [cat("cat_a", "School")],
            projects: [], sessions, documents: [], presets: [], agents: [],
            focusCategoryId: "cat_a",
        });
        const exo = net.nodes.filter((n) => (n.shell ?? 1) > 1);
        expect(exo).toHaveLength(30);
        const shells = new Set(exo.map((n) => n.shell));
        expect(shells).toEqual(
            new Set([EXO_SHELL_BASE, EXO_SHELL_BASE + EXO_SHELL_STEP, EXO_SHELL_BASE + 2 * EXO_SHELL_STEP]),
        );
        // Ring 0 holds the newest EXO_LAYER_SIZE of the overflow.
        expect(
            exo.filter((n) => n.shell === EXO_SHELL_BASE),
        ).toHaveLength(EXO_LAYER_SIZE);
    });
```

(12 + 12 + 6 = 30 across three rings. Adapt factories as before; update the older exo test that expects the flat single-shell EXO_SHELL if it pins counts.)

Run → FAIL.

- [ ] **Step 2: networkData layer assignment**

Replace `EXO_SHELL = 1.75` with:

```ts
export const EXO_LAYER_SIZE = 12;
export const EXO_SHELL_BASE = 1.75;
export const EXO_SHELL_STEP = 0.4;
```

In the exo loop, per index `i`: `const layer = Math.floor(i / EXO_LAYER_SIZE);` and each ring gets its own fibonacci distribution — group first:

```ts
    for (let layer = 0; layer * EXO_LAYER_SIZE < exo.length; layer++) {
        const ring = exo.slice(layer * EXO_LAYER_SIZE, (layer + 1) * EXO_LAYER_SIZE);
        const ringUnits = fibonacciSphere(Math.max(1, ring.length));
        const shell = EXO_SHELL_BASE + layer * EXO_SHELL_STEP;
        ring.forEach((s, i) => {
            /* existing exo node push, with unit: ringUnits[i]!, shell */
        });
    }
```

(Keep the node fields otherwise identical; the meta foot's "exo-sphere" text may add ` · ring ${layer + 1}` for hover clarity.) Run tests → PASS (fix the old flat-shell assertions to use `EXO_SHELL_BASE`).

- [ ] **Step 3: NetworkSphere staged reveal + pull-in + inner fade**

Replace the single `reveal` computation with per-frame scalars (still allocation-free — layer math is per-node arithmetic on existing loop variables):

```ts
const EXO_REVEAL_SPAN = 0.12; // zoom range each ring takes to fade in
const EXO_REVEAL_FIRST = 0.95; // ring 0 starts below this zoom
const EXO_PULL = 0.5; // how much farther out a ring sits before it's revealed
const INNER_FADE_START = 0.85; // inner sphere starts receding below this
const INNER_FADE_FLOOR = 0.12; // and bottoms out at this opacity factor
```

In `draw()` per node (shell > 1):

```ts
                const shell = node.shell ?? 1;
                let ringReveal = 1;
                if (shell > 1) {
                    const layer = Math.round((shell - EXO_SHELL_BASE) / EXO_SHELL_STEP);
                    const start = EXO_REVEAL_FIRST - layer * EXO_REVEAL_SPAN;
                    ringReveal = Math.min(
                        1,
                        Math.max(0, (start - zoom) / EXO_REVEAL_SPAN),
                    );
                }
```

Projection uses the pull-in: an unrevealed ring sits `EXO_PULL` farther out and slides to its shell as it reveals (scroll-driven animation):

```ts
                const effShell = shell > 1 ? shell + (1 - ringReveal) * EXO_PULL : 1;
                const p = projectQuat(node.unit, orient, RADIUS * zoom * effShell);
```

Opacity/labels/hits for exo use `ringReveal` where the previous flat `reveal` was used (`op *= 0.6 * ringReveal`, `lop *= ringReveal`, hit gate `ringReveal > 0.2`). Inner fade — for `shell === 1` nodes compute once per frame:

```ts
            const innerFade = Math.max(
                INNER_FADE_FLOOR,
                Math.min(1, 1 - (INNER_FADE_START - zoom) / (INNER_FADE_START - 0.6) * (1 - INNER_FADE_FLOOR)),
            );
```

(Clamp so `zoom >= INNER_FADE_START` → 1, `zoom <= 0.6` → floor.) Apply `op *= innerFade`, `lop *= innerFade`, and to edge opacity (`eop *= innerFade` — edges only ever connect inner-sphere nodes), and gate inner hit targets off below `innerFade < 0.2` so the faded sphere doesn't steal clicks. Imports: `EXO_SHELL_BASE`, `EXO_SHELL_STEP` from networkData. Zoom bounds: extend min zoom so deep rings are reachable — `Math.max(0.35, …)` replaces 0.55, and verify geometry: ring k's revealed extent `RADIUS * zoom * (EXO_SHELL_BASE + k*STEP)` — at zoom 0.35, ring 4 (shell 3.35) ≈ 47 < 50. Note in the report how many rings fit before clipping.

- [ ] **Step 4: Gates + commit**

`npm run typecheck && npm test` → PASS.

```bash
git add src/components/hud
git commit -m "feat: exo-sphere becomes staged pull-in rings; inner sphere recedes on zoom-out"
```

(User check later: scroll out slowly — rings arrive one at a time from outside, inner sphere dims; scroll in — everything returns.)

---

### Task 6: Ollama, actually set up — connection test, live model list, hosted guidance

**Files:**
- Modify: `src/app/settings/SettingsPage.tsx`

**Interfaces:** none new (module-private helpers).

- [ ] **Step 1: Connection test + model list**

In the provider settings area (near the existing Ollama base URL input), add:

```tsx
    const [ollamaStatus, setOllamaStatus] = useState<string | null>(null);
    const [ollamaModels, setOllamaModels] = useState<string[]>([]);

    const testOllama = async () => {
        setOllamaStatus("checking…");
        setOllamaModels([]);
        try {
            const res = await appFetch(`${form.ollamaBaseUrl}/api/tags`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = (await res.json()) as { models?: { name: string }[] };
            const names = (data.models ?? []).map((m) => m.name);
            setOllamaModels(names);
            setOllamaStatus(
                names.length
                    ? `connected — ${names.length} model${names.length === 1 ? "" : "s"} installed`
                    : "connected, but no models installed — run: ollama pull llama3.2:3b",
            );
        } catch (e) {
            setOllamaStatus(
                `not reachable (${e instanceof Error ? e.message : String(e)}) — is Ollama running?`,
            );
        }
    };
```

Render a "Test connection" button + the status line; when `ollamaModels.length > 0` and the selected provider is ollama, offer the names as a `<datalist>` on the default-model input (or a Select if the settings form uses one — match the existing control). Use the exact settings field names from `keys.ts` (`ollamaBaseUrl` verified).

- [ ] **Step 2: Guidance copy**

Below the Ollama controls, a muted help block (plain language):

```txt
Free local models: llama3.2:3b (fast, ~2GB) or qwen3:4b (better reasoning,
~2.6GB). Install Ollama from ollama.com, then `ollama pull llama3.2:3b`.
If you open this app from a hosted URL instead of localhost, Ollama must
allow that origin: set OLLAMA_ORIGINS=https://your-site.example before
starting Ollama. Requests go straight from your browser to localhost —
your machine, your model, nothing leaves.
```

- [ ] **Step 3: Gates + commit**

`npm run typecheck && npm test` → PASS.

```bash
git add src/app/settings/SettingsPage.tsx
git commit -m "feat: ollama test-connection, live model list, and hosted-origin guidance"
```

---

### Task 7: Usage visibility — know when the free tier will bite

**Files:**
- Modify: `src/db/repo/usage.ts` (only if `usageByDay` lacks a model/provider dimension — read it first)
- Modify: `src/app/settings/SettingsPage.tsx` (Usage card)

**Interfaces:**
- Consumes: `usageByDay(days)` → verify its `DailyUsage` shape before writing UI; extend the SQL with a `model` group-by only if absent (messages carry `model`, `input_tokens`, `output_tokens`).

- [ ] **Step 1: Read `usage.ts`; extend if needed (with a test)**

If `DailyUsage` already breaks out model/provider, skip. Otherwise add `usageByDayAndModel(days = 14)` grouping `chat_messages` by day + `model`, summing input/output/cached tokens, with a repo test (insert two messages on different days/models via `insertMessage`, assert the grouping).

- [ ] **Step 2: Usage card in Settings**

A "Usage" Card at the bottom of SettingsPage: table of the last 14 days (day · model · input tok · output tok), today's row highlighted (`text-primary`), totals row per model, and the blurb:

```txt
Token counts are real usage reported by each provider, summed from your
message history. Gemini's free tier resets daily (around midnight Pacific);
when today's Gemini row climbs toward your quota, switch the preset to
Ollama or another key. Requests-per-day quotas are not shown — this tracks
tokens only.
```

Load via `useEffect` on mount; render "no usage recorded yet" when empty. Format numbers with `toLocaleString()`.

- [ ] **Step 3: Gates + commit**

`npm run typecheck && npm test` → PASS.

```bash
git add src/db/repo/usage.ts src/app/settings/SettingsPage.tsx
git commit -m "feat: settings shows per-day per-model token usage with free-tier guidance"
```

(Include the usage test file if created.)

---

### Task 8: Hosting readiness — Cloudflare Pages headers, production proxy, deploy guide

**Files:**
- Create: `public/_headers`
- Create: `functions/__proxy.ts`
- Create: `docs/hosting.md`
- Modify: `docs/architecture.md` (pointer), `tsconfig.json` (exclude `functions/` ONLY if `npm run typecheck` sweeps it)

- [ ] **Step 1: `public/_headers`** (Vite copies `public/` into `dist/` verbatim; Cloudflare Pages reads `_headers` from the output root):

```txt
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

- [ ] **Step 2: `functions/__proxy.ts`** — same contract as the Vite middleware (`/__proxy?url=`), structural types, no deps:

```ts
/**
 * Cloudflare Pages Function serving the same /__proxy?url= contract as the
 * dev server middleware (vite.config.ts) — the hosted browser build's web
 * tools (wrapWebFetch) route through here because arbitrary sites don't
 * send CORS headers. Fresh outbound fetch (no cookie/header forwarding);
 * only content-type is copied back.
 */
interface ProxyContext {
    request: Request;
}

export async function onRequest({ request }: ProxyContext): Promise<Response> {
    const url = new URL(request.url).searchParams.get("url");
    if (!url) return new Response("missing url", { status: 400 });
    let target: URL;
    try {
        target = new URL(url);
    } catch {
        return new Response("invalid url", { status: 400 });
    }
    if (target.protocol !== "http:" && target.protocol !== "https:")
        return new Response("http(s) only", { status: 400 });
    try {
        const upstream = await fetch(target.toString(), {
            headers: { accept: "text/html, text/plain, application/json" },
            redirect: "follow",
        });
        return new Response(upstream.body, {
            status: upstream.status,
            headers: {
                "content-type":
                    upstream.headers.get("content-type") ?? "text/plain",
            },
        });
    } catch (e) {
        return new Response(
            `proxy fetch failed: ${e instanceof Error ? e.message : String(e)}`,
            { status: 502 },
        );
    }
}
```

Run `npm run typecheck` — if tsc sweeps `functions/` and errors (DOM lib types should cover Request/Response/URL/fetch; `tsconfig.json` includes what?), add `"functions"` to the exclude list and note it. The function must NOT be imported by `src/` code.

- [ ] **Step 3: `docs/hosting.md`** — a complete, honest deploy guide:

Sections (write real prose, not stubs):
1. **What hosting means here**: the web build is a static SPA + one proxy function; every visitor's data lives in THEIR browser (OPFS SQLite) and their API keys in THEIR localStorage — nothing server-side, no accounts. Backup = the in-app backup, per browser.
2. **Cloudflare Pages (recommended)**: connect the repo in the dashboard → build command `npm run build`, output `dist` → `_headers` ships COOP/COEP (required for OPFS) → `functions/__proxy.ts` auto-deploys → done. Free tier limits (100k function requests/day) are far beyond personal use.
3. **Why not GitHub Pages**: cannot set response headers → no COOP/COEP → OPFS unavailable (DB falls back or fails — state which, per `webClient.ts`'s behavior; check and document accurately).
4. **Ollama for hosted visitors**: browser → localhost:11434 needs `OLLAMA_ORIGINS=https://your-site` on the visitor's machine (mirror Task 6's copy).
5. **Security notes**: the proxy is an open fetch relay for whoever can reach the site — Cloudflare Access (free for small teams) can gate the whole deployment if the URL should be private; API keys never leave the visitor's browser except direct-to-provider calls.
6. **Desktop remains first-class**: Tauri build unaffected; hosted and desktop instances have separate databases.

Verify the claims against the code while writing (webClient OPFS fallback behavior especially).

- [ ] **Step 4: Build gate + commit**

Run: `npm run typecheck && npm test && npm run build` — all three must pass (`build` = `tsc --noEmit && vite build`).

```bash
git add public/_headers functions/__proxy.ts docs/hosting.md docs/architecture.md tsconfig.json
git commit -m "feat: hosting readiness — COOP/COEP headers, production proxy function, deploy guide"
```

(Only include tsconfig.json if it changed.)

---

### Task 9: Docs, todo trim, final review

**Files:**
- Modify: `docs/todo.md`, `docs/architecture.md`

- [ ] **Step 1: Rewrite `docs/todo.md`** per the user's instruction: REMOVE the items this plan ships (hourly 1-day view, metadata-referencing confirmation, paste-text upload, web-search/permission trust, ollama setup, usage visibility, exo layers); KEEP, verbatim, the deferred items — School/Schedule tab, private instances, automation/pipeline file inclusion, home widgets — plus the untouched "Possible future problems" section. Add a line noting drafts are now bounded (QA item, wasn't in the todo).
- [ ] **Step 2: `docs/architecture.md`** — add the "Reads only" level to the permission-model section's builtin list; add a Hosting paragraph pointing at docs/hosting.md.
- [ ] **Step 3: Full gates**: `npm run typecheck && npm test && npm run build` → PASS.
- [ ] **Step 4: Final whole-branch review** (most capable model — the only independent review of the round), then fix wave if needed.
- [ ] **Step 5: Commit** `docs: close out the trust/hosting round`, then hand the user the QA list.

---

## Self-Review (performed while writing)

**Todo coverage:** hourly 1-day view → Task 3; School tab → deferred (recorded); metadata-only file referencing → Task 4 (verified true, documented); custom-text upload → Task 4; web-search denial + reads-only level → Task 1 (with diagnosis: DDG reachable, deny is engine-side, value-less scoped grants identified as the never-matching trap); private instances → deferred; Ollama setup → Task 6; usage visibility → Task 7; exo layers/pull-in/inner-hide → Task 5; automation file contexts → deferred; home widgets → deferred; QA draft-limits request → Task 2; hosting readiness → Task 8.

**Placeholder scan:** every code step carries code; steps that depend on live signatures name the exact file to read first (documents.ts create path, usage.ts shape, ItemChip's onDelete wiring, webClient OPFS fallback, settings field names).

**Type consistency:** `EXO_SHELL_BASE`/`EXO_SHELL_STEP`/`EXO_LAYER_SIZE` names match between networkData (Task 5 Step 2), its tests (Step 1), and NetworkSphere's derivation (Step 3); drafts.ts function names match the Composer/ChatWorkspace swaps; `BUILTIN_LEVELS.readsOnly` matches the test's usage; `ungrantedTools`' signature is unchanged by the move to preflight.ts; the proxy function's contract (`/__proxy?url=`, content-type-only response headers) matches `wrapWebFetch` and the vite middleware.
