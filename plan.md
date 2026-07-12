# Agents Section Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the read-only Agents page into the control center of the AI OS: user-defined agents (DB-backed CRUD over instructions/tools/model), a one-off test bench, multi-step pipelines that chain agents, and scheduled automations that run pipelines unattended — all behind the existing permission engine.

**Architecture:** Replace the hardcoded `knowledge`/`research` agent enum with an `agents` table; the orchestrator builds delegation tools dynamically from enabled agent rows, and a shared tool catalog lets each agent pick its gated tool subset. Pipelines are ordered steps (agent + prompt template) executed sequentially by a runner that persists run/step history; automations are schedules (interval/daily/weekly) that run a pipeline headlessly with a chosen permission level (anything outside it auto-denies) and can save the final output as a note.

**Tech Stack:** Existing stack only — Tauri 2, React 19, TypeScript, Vercel AI SDK v7 (`ToolLoopAgent`), SQLite (tauri-plugin-sql / sqlite-wasm), zod v4, Tailwind v4, vitest + better-sqlite3. **No new dependencies.**

## Global Constraints

- No new npm dependencies; no agent framework — compose on `ToolLoopAgent` + `tool()` from `ai`.
- Every agent tool call goes through `PermissionContext.gated(...)` — nothing runs silently (project's hard rule).
- New migrations: add `src-tauri/migrations/000N_*.sql` **and** register in `src-tauri/src/lib.rs` (`migrations()` vec). The web worker (`import.meta.glob`) and `testClient.ts` (readdir) pick up new `.sql` files automatically.
- Both targets must work: Tauri desktop and web (`isWebBrowser()`); all logic stays in TS, none in Rust.
- Design system (docs/design.md): tokens only, no hardcoded colors except data-driven agent colors via inline `style`; data renders in `font-mono`; approvals are always amber (`ApprovalCards`); page skeleton = `h-full overflow-y-auto p-6` → centered column → `font-display` h1; icons from lucide only.
- Fail fast: throw on bad preconditions (unknown tool name, empty pipeline, bad template variable) — no silent fallbacks.
- Tests: `npx vitest run <file>`; whole suite `npm test`; types `npm run typecheck`. Run both before every commit.
- Commit style: existing repo uses `feat:`-style one-liners.
- The dev database migrates forward only — never edit a shipped migration file; new schema = new migration.

## What this builds (spec)

**Milestone A — DB-backed custom agents (Tasks 1–6).** An `agents` table seeded with the existing knowledge/research agents as builtin rows. Each agent: name, description (what the orchestrator sees), instructions (its system prompt), tool subset from a central catalog, optional model override (e.g. cheap model for summarizer agents, big model for coding help), max steps, color. Presets reference agent ids; the orchestrator exposes one `ask_<slug>_agent` delegation tool per enabled agent. Includes a new `write_note` tool (write-gated) so agents can produce durable output.

**Milestone B — Agents page: roster + test bench (Tasks 7–8).** The Agents page becomes tabbed (Roster / Pipelines / Automations). Roster: the network sphere driven by real DB agents plus create/edit/duplicate/delete cards. Test bench: pick an agent, type a task, run it once against your default models with live approval cards and a usage readout — the fast loop for iterating on instructions.

**Milestone C — Pipelines (Tasks 9–12).** A pipeline = named ordered steps; each step = agent + prompt template with `{{input}}`, `{{prev}}`, `{{stepN}}`, `{{date}}` variables. A sequential runner persists `pipeline_runs` / `pipeline_step_runs` (prompt, output, status, error, timing). UI: builder, manual run with approval cards, expandable run history. Example use: "fetch HN front page → research agent summarizes → writer agent drafts a note".

**Milestone D — Automations (Tasks 13–15).** An automation = pipeline + schedule (`interval` minutes / `daily` HH:MM / `weekly` day+HH:MM) + input template + permission level + optional output-note folder. A scheduler ticks while the app is open, claims due automations, runs them headlessly (approvals auto-deny — no one is watching), and saves the final output as a note (which the knowledge agent can then read — closing the loop). UI: CRUD, enable toggle, next/last run readouts, run-now, history.

Deliberately out of scope (YAGNI, revisit later): parallel/branching pipeline graphs, cron expressions, agent-to-agent free-form chat, background execution while the app is closed (no server process by design), per-step model overrides (the per-agent override covers it).

## File structure

```txt
Create:
  src-tauri/migrations/0003_agents.sql        agents table + preset json rewrite
  src-tauri/migrations/0004_pipelines.sql     pipelines, steps, runs, step_runs
  src-tauri/migrations/0005_automations.sql   automations (+ pipeline_runs.automation_id)
  src/db/repo/agents.ts                       agent CRUD + builtin seeds
  src/db/repo/agents.test.ts
  src/db/repo/pipelines.ts                    pipeline/step/run CRUD
  src/db/repo/pipelines.test.ts
  src/db/repo/automations.ts                  automation CRUD + due queries
  src/db/repo/automations.test.ts
  src/ai/tools/catalog.ts                     TOOL_CATALOG + buildToolSet()
  src/ai/tools/catalog.test.ts
  src/ai/agents/factory.ts                    createAgentFromDef()
  src/ai/agents/factory.test.ts
  src/ai/pipelines/runner.ts                  sequential pipeline executor
  src/ai/pipelines/runner.test.ts
  src/ai/automations/schedule.ts              computeNextRun() (pure)
  src/ai/automations/schedule.test.ts
  src/ai/automations/run.ts                   headless run: auto-deny permissions, note output
  src/ai/automations/scheduler.ts             tick loop, claims due automations
  src/ai/automations/scheduler.test.ts
  src/ai/providers/appFetch.ts                shared Tauri/browser fetch pick
  src/lib/template.ts                         renderTemplate()
  src/lib/template.test.ts
  src/app/agents/AgentEditor.tsx              agent create/edit form
  src/app/agents/AgentTestBench.tsx           one-off agent run panel
  src/app/agents/PipelinesTab.tsx             pipeline builder + manual runs
  src/app/agents/RunHistory.tsx               shared run/step-run list
  src/app/agents/AutomationsTab.tsx           automation CRUD + history

Modify:
  src-tauri/src/lib.rs                        register migrations 3–5
  src/lib/schemas.ts                          agentDefSchema, pipeline/automation schemas,
                                              presetAgents → string ids, drop AgentName
  src/ai/agents/types.ts                      AgentRuntime.resolveModel; usage agent: string
  src/ai/agents/orchestrator.ts               dynamic delegation tools from AgentDef[]
  src/ai/agents/runtime.ts                    buildSessionAgent loads defs; buildPipelineRuntime
  src/ai/agents/agents.test.ts                defs instead of enum
  src/ai/tools/notes.ts                       add write_note tool + scope resolver
  src/ai/tools/tools.test.ts                  write_note cases
  src/ai/tools/index.ts                       (unchanged exports — resolvers spread already)
  src/db/repo/presets.ts                      enabledAgents: string[]; seeds use agt_ ids
  src/app/bootstrap.ts                        seedBuiltinAgents()
  src/app/agents/AgentsPage.tsx               tabs + DB-driven roster
  src/app/chat/ChatPage.tsx                   loads agents; passes to network builders
  src/app/presets/PresetsPage.tsx             agent checkboxes from DB
  src/components/hud/networkData.ts           builders take AgentDef[]
  evals/router.eval.ts                        inline AgentDef fixtures

Delete (Task 6):
  src/ai/agents/knowledge.ts                  instructions move to seeds
  src/ai/agents/research.ts                   instructions move to seeds
  src/components/hud/agentCatalog.ts          replaced by DB agents
```

---

## Milestone A — DB-backed custom agents

### Task 1: `agents` table migration + zod schema

**Files:**
- Create: `src-tauri/migrations/0003_agents.sql`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/schemas.ts` (append only in this task — the enum sweep is Task 6)
- Test: `src/db/repo/agents.test.ts` (created here, grows in Task 2)

**Interfaces:**
- Produces: `agents` table; `agentDefSchema`/`AgentDef`; `agentToolNames(def): string[]`; `agentSlug(name): string`; `delegationToolName(def): string`. Later tasks import all four from `@/lib/schemas`.

- [ ] **Step 1: Write the failing test**

```ts
// src/db/repo/agents.test.ts
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb, getDb } from "@/db/client";
import { agentSlug, delegationToolName, type AgentDef } from "@/lib/schemas";

let db: ReturnType<typeof createTestDbClient>;

beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});

afterEach(() => {
    db.close();
});

describe("agents migration", () => {
    it("creates the agents table with defaults", async () => {
        await getDb().execute(
            `INSERT INTO agents (id, name, description, instructions, created_at, updated_at)
             VALUES ('agt_x', 'Writer', 'writes things', 'You write.', 1, 1)`,
        );
        const rows = await getDb().select<{
            tools_json: string;
            max_steps: number;
            is_builtin: number;
        }>("SELECT tools_json, max_steps, is_builtin FROM agents WHERE id = 'agt_x'");
        expect(rows[0]).toEqual({ tools_json: "[]", max_steps: 6, is_builtin: 0 });
    });
});

describe("agent naming helpers", () => {
    it("slugifies display names", () => {
        expect(agentSlug("Knowledge")).toBe("knowledge");
        expect(agentSlug("HN Digest v2")).toBe("hn_digest_v2");
    });

    it("throws on names that slug to nothing", () => {
        expect(() => agentSlug("!!!")).toThrow(/empty slug/);
    });

    it("builds delegation tool names", () => {
        const def = { name: "Research" } as AgentDef;
        expect(delegationToolName(def)).toBe("ask_research_agent");
    });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/db/repo/agents.test.ts`
Expected: FAIL — `no such table: agents` and `agentSlug` not exported.

- [ ] **Step 3: Write the migration**

```sql
-- src-tauri/migrations/0003_agents.sql
-- User-defined agents. Builtin rows (knowledge, research) are seeded from TS
-- at bootstrap (like presets) so instructions live in one place.

CREATE TABLE agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    instructions TEXT NOT NULL,
    tools_json TEXT NOT NULL DEFAULT '[]',
    model TEXT,
    max_steps INTEGER NOT NULL DEFAULT 6,
    color TEXT,
    is_builtin INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Presets stored agent enum names; they now store agent row ids.
UPDATE presets SET enabled_agents_json =
    REPLACE(REPLACE(enabled_agents_json, '"knowledge"', '"agt_knowledge"'),
            '"research"', '"agt_research"');
```

- [ ] **Step 4: Register the migration in Rust**

In `src-tauri/src/lib.rs`, append to the `migrations()` vec after version 2:

```rust
Migration {
    version: 3,
    description: "agents table + preset agent ids",
    sql: include_str!("../migrations/0003_agents.sql"),
    kind: MigrationKind::Up,
},
```

- [ ] **Step 5: Add the schema + helpers to `src/lib/schemas.ts`**

Append after the preset section (do **not** touch `agentNameSchema` yet — Task 6 removes it):

```ts
export const agentDefSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    instructions: z.string(),
    tools_json: z.string(),
    model: z.string().nullable(),
    max_steps: z.number(),
    color: z.string().nullable(),
    is_builtin: sqlBool,
    created_at: z.number(),
    updated_at: z.number(),
});
export type AgentDef = z.infer<typeof agentDefSchema>;

/** Tool names (from the tool catalog) this agent may use. */
export function agentToolNames(def: AgentDef): string[] {
    return z.array(z.string()).parse(JSON.parse(def.tools_json));
}

/** "HN Digest v2" -> "hn_digest_v2" — used for tool names, usage rows, colors. */
export function agentSlug(name: string): string {
    const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    if (!slug) throw new Error(`agent name produces an empty slug: ${name}`);
    return slug;
}

/** The orchestrator-facing delegation tool name for an agent. */
export function delegationToolName(def: AgentDef): string {
    return `ask_${agentSlug(def.name)}_agent`;
}
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `npx vitest run src/db/repo/agents.test.ts` — Expected: PASS.
Run: `npm run typecheck` — Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/migrations/0003_agents.sql src-tauri/src/lib.rs src/lib/schemas.ts src/db/repo/agents.test.ts
git commit -m "feat: agents table migration + AgentDef schema"
```

### Task 2: agents repository (CRUD + builtin seeds)

**Files:**
- Create: `src/db/repo/agents.ts`
- Modify: `src/app/bootstrap.ts`
- Test: `src/db/repo/agents.test.ts` (extend)

**Interfaces:**
- Consumes: `agentDefSchema`, `AgentDef` from Task 1.
- Produces: `AgentInput { name; description; instructions; tools: string[]; model?: string|null; maxSteps?: number; color?: string|null }`; `BUILTIN_AGENT_IDS = { knowledge: "agt_knowledge", research: "agt_research" }`; `seedBuiltinAgents()`, `createAgent(input)`, `updateAgent(id, input)`, `deleteAgent(id)` (throws for builtins), `duplicateAgent(id)`, `getAgent(id)`, `listAgents()`. All later tasks load agents through these.

- [ ] **Step 1: Write the failing tests (append to `src/db/repo/agents.test.ts`)**

```ts
import {
    createAgent,
    deleteAgent,
    duplicateAgent,
    getAgent,
    listAgents,
    seedBuiltinAgents,
    updateAgent,
    BUILTIN_AGENT_IDS,
} from "./agents";
import { agentToolNames } from "@/lib/schemas";

describe("agents repo", () => {
    it("seeds builtin knowledge and research agents idempotently", async () => {
        await seedBuiltinAgents();
        await seedBuiltinAgents(); // must not throw or duplicate
        const agents = await listAgents();
        expect(agents.map((a) => a.id).sort()).toEqual([
            BUILTIN_AGENT_IDS.knowledge,
            BUILTIN_AGENT_IDS.research,
        ]);
        const knowledge = await getAgent(BUILTIN_AGENT_IDS.knowledge);
        expect(knowledge.is_builtin).toBe(1);
        expect(agentToolNames(knowledge)).toContain("search_documents");
    });

    it("creates, updates, and deletes a custom agent", async () => {
        const created = await createAgent({
            name: "Writer",
            description: "Drafts notes",
            instructions: "You write concise notes.",
            tools: ["write_note"],
        });
        expect(created.max_steps).toBe(6);

        const updated = await updateAgent(created.id, {
            name: "Writer",
            description: "Drafts notes",
            instructions: "You write very concise notes.",
            tools: ["write_note", "search_notes"],
            maxSteps: 4,
        });
        expect(updated.max_steps).toBe(4);
        expect(agentToolNames(updated)).toEqual(["write_note", "search_notes"]);

        await deleteAgent(created.id);
        await expect(getAgent(created.id)).rejects.toThrow(/not found/);
    });

    it("refuses to delete builtin agents but allows editing them", async () => {
        await seedBuiltinAgents();
        await expect(
            deleteAgent(BUILTIN_AGENT_IDS.knowledge),
        ).rejects.toThrow(/built-in/);
        const edited = await updateAgent(BUILTIN_AGENT_IDS.knowledge, {
            name: "Knowledge",
            description: "custom desc",
            instructions: "custom instructions",
            tools: ["search_documents"],
        });
        expect(edited.description).toBe("custom desc");
        expect(edited.is_builtin).toBe(1);
    });

    it("duplicates an agent with a distinct name", async () => {
        await seedBuiltinAgents();
        const copy = await duplicateAgent(BUILTIN_AGENT_IDS.research);
        expect(copy.name).toBe("Research copy");
        expect(copy.is_builtin).toBe(0);
        expect(copy.instructions).toBe(
            (await getAgent(BUILTIN_AGENT_IDS.research)).instructions,
        );
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/db/repo/agents.test.ts`
Expected: FAIL — module `./agents` not found.

- [ ] **Step 3: Implement `src/db/repo/agents.ts`**

```ts
import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { agentDefSchema, type AgentDef } from "@/lib/schemas";

export interface AgentInput {
    name: string;
    description: string;
    instructions: string;
    tools: string[];
    model?: string | null;
    maxSteps?: number;
    color?: string | null;
}

export const BUILTIN_AGENT_IDS = {
    knowledge: "agt_knowledge",
    research: "agt_research",
} as const;

const KNOWLEDGE_INSTRUCTIONS = `You are the knowledge agent: you answer questions from the user's stored documents and notes.
Search first (search_documents / search_notes), read what looks relevant (read_document / read_note),
then answer grounded in what you found. Name the sources you used. If a tool result reports
{denied: true}, the user refused access — say what you could not check and answer from
what you have. If nothing relevant exists, say so plainly.`;

const RESEARCH_INSTRUCTIONS = `You are the research agent: you read specific web pages with fetch_url and report
what they say. Only fetch URLs that were given to you or that appear in pages you
already fetched. Quote or closely paraphrase sources and name the URL for each claim.
If a tool result reports {denied: true}, the user refused that fetch — do not retry
the same domain; report what you could not access.`;

/** Idempotent — called from bootstrap() on every start, like preset seeds. */
export async function seedBuiltinAgents(): Promise<void> {
    const seeds: Array<{ id: string } & AgentInput> = [
        {
            id: BUILTIN_AGENT_IDS.knowledge,
            name: "Knowledge",
            description:
                "Searches and reads the user's stored documents and notes. Use for anything that could be answered from the user's own material.",
            instructions: KNOWLEDGE_INSTRUCTIONS,
            tools: [
                "search_documents",
                "read_document",
                "list_documents",
                "search_notes",
                "read_note",
                "list_notes",
            ],
        },
        {
            id: BUILTIN_AGENT_IDS.research,
            name: "Research",
            description:
                "Reads specific web pages. Use when the user provides URLs or asks about the content of a particular site.",
            instructions: RESEARCH_INSTRUCTIONS,
            tools: ["fetch_url"],
        },
    ];
    const t = now();
    for (const s of seeds) {
        await getDb().execute(
            `INSERT OR IGNORE INTO agents
               (id, name, description, instructions, tools_json, model,
                max_steps, color, is_builtin, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, NULL, 6, NULL, 1, ?, ?)`,
            [s.id, s.name, s.description, s.instructions, JSON.stringify(s.tools), t, t],
        );
    }
}

export async function createAgent(input: AgentInput): Promise<AgentDef> {
    const id = newId("agt");
    const t = now();
    await getDb().execute(
        `INSERT INTO agents
           (id, name, description, instructions, tools_json, model,
            max_steps, color, is_builtin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
            id,
            input.name,
            input.description,
            input.instructions,
            JSON.stringify(input.tools),
            input.model ?? null,
            input.maxSteps ?? 6,
            input.color ?? null,
            t,
            t,
        ],
    );
    return getAgent(id);
}

export async function updateAgent(
    id: string,
    input: AgentInput,
): Promise<AgentDef> {
    const res = await getDb().execute(
        `UPDATE agents SET
           name = ?, description = ?, instructions = ?, tools_json = ?,
           model = ?, max_steps = ?, color = ?, updated_at = ?
         WHERE id = ?`,
        [
            input.name,
            input.description,
            input.instructions,
            JSON.stringify(input.tools),
            input.model ?? null,
            input.maxSteps ?? 6,
            input.color ?? null,
            now(),
            id,
        ],
    );
    if (res.rowsAffected === 0) throw new Error(`agent not found: ${id}`);
    return getAgent(id);
}

export async function getAgent(id: string): Promise<AgentDef> {
    const rows = await getDb().select("SELECT * FROM agents WHERE id = ?", [id]);
    if (!rows[0]) throw new Error(`agent not found: ${id}`);
    return agentDefSchema.parse(rows[0]);
}

export async function listAgents(): Promise<AgentDef[]> {
    const rows = await getDb().select(
        "SELECT * FROM agents ORDER BY is_builtin DESC, created_at ASC",
    );
    return rows.map((r) => agentDefSchema.parse(r));
}

export async function deleteAgent(id: string): Promise<void> {
    const agent = await getAgent(id);
    if (agent.is_builtin) throw new Error("built-in agents cannot be deleted");
    await getDb().execute("DELETE FROM agents WHERE id = ?", [id]);
}

export async function duplicateAgent(id: string): Promise<AgentDef> {
    const src = await getAgent(id);
    return createAgent({
        name: `${src.name} copy`,
        description: src.description,
        instructions: src.instructions,
        tools: JSON.parse(src.tools_json) as string[],
        model: src.model,
        maxSteps: src.max_steps,
        color: src.color,
    });
}
```

- [ ] **Step 4: Seed at bootstrap**

In `src/app/bootstrap.ts`: add `import { seedBuiltinAgents } from "@/db/repo/agents";` and in `runBootstrap()` insert `await seedBuiltinAgents();` on the line before `await seedBuiltinPresets({`.

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/db/repo/agents.test.ts` — Expected: PASS.
Run: `npm run typecheck` — Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/db/repo/agents.ts src/db/repo/agents.test.ts src/app/bootstrap.ts
git commit -m "feat: agents repo with builtin seeds"
```

### Task 3: `write_note` tool

**Files:**
- Modify: `src/ai/tools/notes.ts`
- Test: `src/ai/tools/tools.test.ts` (append a describe block)

**Interfaces:**
- Consumes: `createNote` from `@/db/repo/notes`; `PermissionContext.gated`.
- Produces: tool `write_note` inside `createNoteTools(...)` with input `{ title: string; folder?: string; body_md: string }`, resolving scope `{ access: "write", scopeType: "doc_folder", scopeValue: <normalized folder> }`; returns `{ id, title, folder }`. Registered in `noteScopeResolvers` (flows into `scopeResolvers` via the existing spread in `src/ai/tools/index.ts` — no change needed there).

- [ ] **Step 1: Write the failing test (append to `src/ai/tools/tools.test.ts`)**

Follow the existing test file's setup pattern (test DB via `createTestDbClient` + `setDb`, a `PermissionContext` with grants). Add:

```ts
describe("write_note tool", () => {
    it("creates a note when a write grant covers the folder", async () => {
        const permissions = new PermissionContext();
        permissions.levelGrants = [
            {
                tool: "write_note",
                access: "write",
                scopeType: "doc_folder",
                scopeValue: "/automations",
            },
        ];
        const tools = createNoteTools(permissions);
        const result = (await tools.write_note.execute!(
            { title: "Digest", folder: "/automations", body_md: "# hi" },
            { toolCallId: "t1", messages: [] },
        )) as { id: string; title: string; folder: string };
        expect(result.title).toBe("Digest");
        const note = await getNote(result.id);
        expect(note.body_md).toBe("# hi");
        expect(note.folder).toBe("/automations");
    });

    it("asks (and honors deny) outside the granted folder", async () => {
        const permissions = new PermissionContext();
        permissions.broker.subscribe((pending) => {
            for (const req of pending) permissions.broker.respond(req.id, "deny");
        });
        const tools = createNoteTools(permissions);
        const result = (await tools.write_note.execute!(
            { title: "X", folder: "/personal", body_md: "no" },
            { toolCallId: "t2", messages: [] },
        )) as { denied?: boolean };
        expect(result.denied).toBe(true);
    });
});
```

Add the imports the block needs at the top of the file if not present: `createNoteTools` from `./notes`, `getNote` from `@/db/repo/notes`, `PermissionContext` from `./context`.

> Note: match the `execute!` second-argument shape used by the existing tool tests in this file — copy whatever option object they pass; the AI SDK's `ToolCallOptions` there is the source of truth.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ai/tools/tools.test.ts`
Expected: FAIL — `write_note` is not defined.

- [ ] **Step 3: Implement in `src/ai/tools/notes.ts`**

Add to the imports: `import { createNote } from "@/db/repo/notes";` (extend the existing repo import). Add the input schema next to the others:

```ts
const writeInput = z.object({
    title: z.string().describe("Title for the new note"),
    folder: z
        .string()
        .optional()
        .describe("Folder to file the note under, e.g. /automations. Defaults to /."),
    body_md: z.string().describe("Markdown body of the note"),
});
```

Add to `noteScopeResolvers`:

```ts
write_note: (input) => ({
    access: "write",
    scopeType: "doc_folder",
    scopeValue: normalizeFolder(
        (input as z.infer<typeof writeInput>).folder ?? "/",
    ),
}),
```

Add to the object returned by `createNoteTools`:

```ts
write_note: tool({
    description:
        "Create a new markdown note in the user's notes. Use to save summaries, drafts, or results the user should keep.",
    inputSchema: writeInput,
    execute: permissions.gated(
        "write_note",
        noteScopeResolvers.write_note!,
        async (input: z.infer<typeof writeInput>) => {
            const note = await createNote({
                title: input.title,
                folder: input.folder,
                bodyMd: input.body_md,
            });
            return { id: note.id, title: note.title, folder: note.folder };
        },
    ),
}),
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/ai/tools/tools.test.ts` — Expected: PASS.
Run: `npm test && npm run typecheck` — Expected: clean (permission-engine tests still green — `write` access + `doc_folder` scope are already modeled).

- [ ] **Step 5: Commit**

```bash
git add src/ai/tools/notes.ts src/ai/tools/tools.test.ts
git commit -m "feat: write_note tool (write-gated by folder)"
```
### Task 4: tool catalog + `buildToolSet()`

**Files:**
- Create: `src/ai/tools/catalog.ts`
- Test: `src/ai/tools/catalog.test.ts`

**Interfaces:**
- Consumes: `createDocumentTools`, `createNoteTools`, `createWebTools`, `PermissionContext`.
- Produces: `ToolCatalogEntry { name; label; access: "read"|"write"; group: "documents"|"notes"|"web" }`; `TOOL_CATALOG: ToolCatalogEntry[]`; `buildToolSet(names: string[], deps: { permissions: PermissionContext; fetch: typeof globalThis.fetch }): ToolSet`. The agent factory (Task 5) and AgentEditor UI (Task 7) consume these.

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/tools/catalog.test.ts
import { describe, expect, it } from "vitest";
import { PermissionContext } from "./context";
import { buildToolSet, TOOL_CATALOG } from "./catalog";

const deps = {
    permissions: new PermissionContext(),
    fetch: (async () => new Response("stub")) as typeof globalThis.fetch,
};

describe("tool catalog", () => {
    it("every catalog entry builds a real tool", () => {
        const all = buildToolSet(
            TOOL_CATALOG.map((e) => e.name),
            deps,
        );
        expect(Object.keys(all).sort()).toEqual(
            TOOL_CATALOG.map((e) => e.name).sort(),
        );
    });

    it("builds only the requested subset", () => {
        const set = buildToolSet(["fetch_url", "write_note"], deps);
        expect(Object.keys(set).sort()).toEqual(["fetch_url", "write_note"]);
    });

    it("throws on unknown tool names", () => {
        expect(() => buildToolSet(["run_shell"], deps)).toThrow(
            /unknown tool.*run_shell/,
        );
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ai/tools/catalog.test.ts`
Expected: FAIL — module `./catalog` not found.

- [ ] **Step 3: Implement `src/ai/tools/catalog.ts`**

```ts
import type { ToolSet } from "ai";
import { createDocumentTools } from "./documents";
import { createNoteTools } from "./notes";
import { createWebTools } from "./web";
import type { PermissionContext } from "./context";

/**
 * Every gated tool an agent can be granted, with UI metadata. Adding a tool
 * module = spread its factory into buildToolSet and list its entries here.
 */
export interface ToolCatalogEntry {
    name: string;
    label: string;
    access: "read" | "write";
    group: "documents" | "notes" | "web";
}

export const TOOL_CATALOG: ToolCatalogEntry[] = [
    { name: "search_documents", label: "Search documents", access: "read", group: "documents" },
    { name: "read_document", label: "Read a document", access: "read", group: "documents" },
    { name: "list_documents", label: "List documents", access: "read", group: "documents" },
    { name: "search_notes", label: "Search notes", access: "read", group: "notes" },
    { name: "read_note", label: "Read a note", access: "read", group: "notes" },
    { name: "list_notes", label: "List notes", access: "read", group: "notes" },
    { name: "write_note", label: "Create a note", access: "write", group: "notes" },
    { name: "fetch_url", label: "Fetch a web page", access: "read", group: "web" },
];

/** Builds the ToolSet for an agent's granted tool names. Throws on unknowns. */
export function buildToolSet(
    names: string[],
    deps: {
        permissions: PermissionContext;
        fetch: typeof globalThis.fetch;
    },
): ToolSet {
    const all: ToolSet = {
        ...createDocumentTools(deps.permissions),
        ...createNoteTools(deps.permissions),
        ...createWebTools(deps.permissions, deps.fetch),
    };
    const set: ToolSet = {};
    for (const name of names) {
        const t = all[name];
        if (!t) throw new Error(`unknown tool in agent definition: ${name}`);
        set[name] = t;
    }
    return set;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/ai/tools/catalog.test.ts` — Expected: PASS.
Run: `npm run typecheck` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/ai/tools/catalog.ts src/ai/tools/catalog.test.ts
git commit -m "feat: tool catalog + buildToolSet for per-agent tool subsets"
```

### Task 5: agent factory (`createAgentFromDef`)

**Files:**
- Create: `src/ai/agents/factory.ts`
- Modify: `src/ai/agents/types.ts`
- Test: `src/ai/agents/factory.test.ts`

**Interfaces:**
- Consumes: `AgentDef`, `agentToolNames` (Task 1); `buildToolSet` (Task 4).
- Produces: `createAgentFromDef(def, runtime): { agent: ToolLoopAgent; modelId: string }`; `AgentRuntime` gains `resolveModel: (modelId: string) => LanguageModel` and `AgentUsageEvent.agent` widens to `string`. Orchestrator (Task 6) and pipeline runner (Task 11) consume the factory.

- [ ] **Step 1: Update `src/ai/agents/types.ts`**

Replace the file's contents with:

```ts
import type { LanguageModel, LanguageModelUsage } from "ai";
import type { PermissionContext } from "@/ai/tools/context";

/** Reported after every agent run so callers can persist token usage. */
export interface AgentUsageEvent {
    /** "orchestrator" or an agent slug (agentSlug of its name). */
    agent: string;
    model: string;
    usage: LanguageModelUsage;
}

/** Everything agents need at construction time; built per session from a preset. */
export interface AgentRuntime {
    permissions: PermissionContext;
    /** Preset's main model — default for specialists. */
    mainModel: LanguageModel;
    mainModelId: string;
    /** Preset's router model — runs the orchestrator. Falls back to mainModel. */
    routerModel: LanguageModel;
    routerModelId: string;
    /** Builds a model for a per-agent model override (same provider). */
    resolveModel: (modelId: string) => LanguageModel;
    /** Injected fetch (plugin-http in the app, mocks in tests). */
    fetch: typeof globalThis.fetch;
    onUsage?: (event: AgentUsageEvent) => void;
}
```

(This compiles today: `AgentName` was only used in the `agent:` union, now `string`. Call sites constructing `AgentRuntime` gain `resolveModel` in Steps 2–3 and Task 6.)

- [ ] **Step 2: Write the failing test**

```ts
// src/ai/agents/factory.test.ts
import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { PermissionContext } from "@/ai/tools/context";
import type { AgentDef } from "@/lib/schemas";
import type { AgentRuntime } from "./types";
import { createAgentFromDef } from "./factory";

function def(overrides: Partial<AgentDef>): AgentDef {
    return {
        id: "agt_t",
        name: "Tester",
        description: "d",
        instructions: "You test.",
        tools_json: "[]",
        model: null,
        max_steps: 6,
        color: null,
        is_builtin: 0,
        created_at: 0,
        updated_at: 0,
        ...overrides,
    };
}

function runtime(): AgentRuntime {
    return {
        permissions: new PermissionContext(),
        mainModel: new MockLanguageModelV3({ modelId: "mock-main" }),
        mainModelId: "mock-main",
        routerModel: new MockLanguageModelV3({ modelId: "mock-router" }),
        routerModelId: "mock-router",
        resolveModel: (modelId) => new MockLanguageModelV3({ modelId }),
        fetch: async () => new Response("stub"),
    };
}

describe("createAgentFromDef", () => {
    it("builds an agent on the main model with the selected tools", () => {
        const { agent, modelId } = createAgentFromDef(
            def({ tools_json: '["fetch_url","write_note"]' }),
            runtime(),
        );
        expect(modelId).toBe("mock-main");
        expect(Object.keys(agent.tools).sort()).toEqual([
            "fetch_url",
            "write_note",
        ]);
    });

    it("honors the per-agent model override", () => {
        const { modelId } = createAgentFromDef(
            def({ model: "cheap-model" }),
            runtime(),
        );
        expect(modelId).toBe("cheap-model");
    });

    it("throws on unknown tool names in the definition", () => {
        expect(() =>
            createAgentFromDef(def({ tools_json: '["nope"]' }), runtime()),
        ).toThrow(/unknown tool/);
    });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/ai/agents/factory.test.ts`
Expected: FAIL — module `./factory` not found.

- [ ] **Step 4: Implement `src/ai/agents/factory.ts`**

```ts
import { ToolLoopAgent, stepCountIs } from "ai";
import { buildToolSet } from "@/ai/tools/catalog";
import { agentToolNames, type AgentDef } from "@/lib/schemas";
import type { AgentRuntime } from "./types";

/**
 * Instantiates a runnable specialist from its DB definition: instructions as
 * the system prompt, catalog tool subset, and the preset main model unless the
 * definition overrides it.
 */
export function createAgentFromDef(def: AgentDef, runtime: AgentRuntime) {
    const model = def.model
        ? runtime.resolveModel(def.model)
        : runtime.mainModel;
    const agent = new ToolLoopAgent({
        model,
        instructions: def.instructions,
        tools: buildToolSet(agentToolNames(def), {
            permissions: runtime.permissions,
            fetch: runtime.fetch,
        }),
        stopWhen: stepCountIs(def.max_steps),
    });
    return { agent, modelId: def.model ?? runtime.mainModelId };
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/ai/agents/factory.test.ts` — Expected: PASS.
Run: `npm run typecheck` — Expected: **fails** in `agents.test.ts`/`runtime.ts` (missing `resolveModel`). Patch the two constructors now so the repo compiles:
- `src/ai/agents/agents.test.ts` `makeRuntime`: add `resolveModel: (modelId) => new MockLanguageModelV3({ modelId }),`
- `src/ai/agents/runtime.ts` `buildSessionAgent`: add to the `runtime` literal `resolveModel: (modelId) => createModel({ provider, modelId }, runtimeBase),`

Re-run: `npm test && npm run typecheck` — Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/ai/agents/factory.ts src/ai/agents/factory.test.ts src/ai/agents/types.ts src/ai/agents/runtime.ts src/ai/agents/agents.test.ts
git commit -m "feat: agent factory building specialists from DB definitions"
```

### Task 6: dynamic orchestrator + agent-enum removal sweep

This is one atomic interface change (agent enum → DB ids) that ripples; the repo compiles and all tests pass only when every edit lands together.

**Files:**
- Modify: `src/ai/agents/orchestrator.ts`, `src/ai/agents/runtime.ts`, `src/lib/schemas.ts`, `src/db/repo/presets.ts`, `src/app/chat/ChatPage.tsx`, `src/app/presets/PresetsPage.tsx`, `src/components/hud/networkData.ts`, `src/app/agents/AgentsPage.tsx`, `evals/router.eval.ts`
- Create: `src/ai/providers/appFetch.ts`
- Delete: `src/ai/agents/knowledge.ts`, `src/ai/agents/research.ts`, `src/components/hud/agentCatalog.ts`
- Test: `src/ai/agents/agents.test.ts` (rewrite call sites)

**Interfaces:**
- Consumes: `createAgentFromDef` (Task 5), agents repo (Task 2), `delegationToolName`/`agentSlug` (Task 1).
- Produces: `createOrchestrator(runtime, { systemPrompt: string; agents: AgentDef[] })`; `presetAgents(preset): string[]` (agent **ids**); `PresetInput.enabledAgents: string[]`; `buildSessionAgent` unchanged signature but loads defs from DB; `buildAgentTypeNetwork(agents: AgentDef[])` and `buildSessionNetwork(sessions, presets, agents)`; `appFetch` shared export.

- [ ] **Step 1: Update the orchestrator tests first (`src/ai/agents/agents.test.ts`)**

Keep the four existing test scenarios; change only construction. Add near the top:

```ts
import type { AgentDef } from "@/lib/schemas";

function makeDef(overrides: Partial<AgentDef> & { name: string }): AgentDef {
    return {
        id: `agt_${overrides.name.toLowerCase()}`,
        description: `${overrides.name} specialist`,
        instructions: `You are the ${overrides.name} agent.`,
        tools_json: "[]",
        model: null,
        max_steps: 6,
        color: null,
        is_builtin: 0,
        created_at: 0,
        updated_at: 0,
        ...overrides,
    };
}

const KNOWLEDGE_DEF = makeDef({
    name: "Knowledge",
    tools_json: '["search_documents","read_document","list_documents"]',
});
const RESEARCH_DEF = makeDef({ name: "Research", tools_json: '["fetch_url"]' });
```

Then replace every `createOrchestrator(runtime, { systemPrompt, enabledAgents: [...] })` call:
- `enabledAgents: ["knowledge"]` → `agents: [KNOWLEDGE_DEF]`
- `enabledAgents: []` → `agents: []`
- `enabledAgents: ["knowledge", "research"]` → `agents: [KNOWLEDGE_DEF, RESEARCH_DEF]`

The delegation tool names (`ask_knowledge_agent`, `ask_research_agent`) and usage expectations (`agent: "knowledge"`) stay identical — slugs preserve them.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ai/agents/agents.test.ts`
Expected: FAIL — `createOrchestrator` still expects `enabledAgents`.

- [ ] **Step 3: Rewrite `src/ai/agents/orchestrator.ts`**

```ts
import { ToolLoopAgent, stepCountIs, tool, type ToolSet } from "ai";
import { z } from "zod";
import {
    agentSlug,
    delegationToolName,
    type AgentDef,
} from "@/lib/schemas";
import { createAgentFromDef } from "./factory";
import type { AgentRuntime } from "./types";

const delegationInput = z.object({
    task: z
        .string()
        .describe(
            "The complete, self-contained task for the specialist, including any context it needs — it cannot see this conversation.",
        ),
});

const ROUTING_ADDENDUM = `
Routing: answer directly when you can. Delegate to a specialist only when the task
needs their capability. Delegations are self-contained — restate any needed context
in the task. After a specialist reports back, compose the final answer yourself.`;

/**
 * The orchestrator: runs on the cheap router model and sees each enabled
 * agent definition as one delegation tool. No agents = plain direct answers.
 */
export function createOrchestrator(
    runtime: AgentRuntime,
    opts: { systemPrompt: string; agents: AgentDef[] },
) {
    const tools: ToolSet = {};
    for (const def of opts.agents) {
        tools[delegationToolName(def)] = tool({
            description: `Ask the ${def.name} agent. ${def.description}`,
            inputSchema: delegationInput,
            execute: async ({ task }) => runSpecialist(def, runtime, task),
        });
    }

    const hasAgents = opts.agents.length > 0;

    return new ToolLoopAgent({
        model: runtime.routerModel,
        instructions: hasAgents
            ? opts.systemPrompt + ROUTING_ADDENDUM
            : opts.systemPrompt,
        tools,
        stopWhen: stepCountIs(6),
        // The chat transport injects the compaction summary as a system message.
        allowSystemInMessages: true,
        onEnd: (event) => {
            runtime.onUsage?.({
                agent: "orchestrator",
                model: runtime.routerModelId,
                usage: event.totalUsage,
            });
        },
    });
}

async function runSpecialist(
    def: AgentDef,
    runtime: AgentRuntime,
    task: string,
): Promise<string> {
    const { agent, modelId } = createAgentFromDef(def, runtime);
    const result = await agent.generate({ prompt: task });
    runtime.onUsage?.({
        agent: agentSlug(def.name),
        model: modelId,
        usage: result.totalUsage,
    });
    return result.text || "(the specialist returned no text)";
}
```

Delete `src/ai/agents/knowledge.ts` and `src/ai/agents/research.ts` (instructions live in the Task 2 seeds).

- [ ] **Step 4: Update `src/lib/schemas.ts`**

Remove `agentNameSchema` and `AgentName`. Replace `presetAgents` with:

```ts
/** Agent ids (rows in the agents table) enabled by a preset. */
export function presetAgents(preset: Preset): string[] {
    return z.array(z.string()).parse(JSON.parse(preset.enabled_agents_json));
}
```

- [ ] **Step 5: Update `src/db/repo/presets.ts`**

- `PresetInput.enabledAgents: AgentName[]` → `enabledAgents: string[]`; drop the `AgentName` import.
- In `seedBuiltinPresets`, change seeds to ids: `enabledAgents: ["agt_knowledge"]` (Study) and `enabledAgents: ["agt_knowledge", "agt_research"]` (Research). Import `BUILTIN_AGENT_IDS` from `./agents` and use `BUILTIN_AGENT_IDS.knowledge` / `.research` instead of string literals.

- [ ] **Step 6: Update `src/ai/agents/runtime.ts`**

Replace the imports of `presetAgents` usage and orchestrator construction inside `buildSessionAgent`:

```ts
import { listAgents } from "@/db/repo/agents";
// ...
const enabled = new Set(presetAgents(preset));
const agents = (await listAgents()).filter((a) => enabled.has(a.id));

const orchestrator = createOrchestrator(runtime, {
    systemPrompt: preset.system_prompt,
    agents,
});
```

(`resolveModel` already added in Task 5 Step 5. Agents deleted from the DB simply drop out of the filter — sessions keep working.)

- [ ] **Step 7: Create `src/ai/providers/appFetch.ts` and rewire networkData**

```ts
// src/ai/providers/appFetch.ts
import { isTauri } from "@/lib/env";
import { tauriFetch } from "./tauriFetch";

/** Desktop: plugin-http (no CORS). Browser: global fetch, bound so it isn't called detached. */
export const appFetch: typeof globalThis.fetch = isTauri()
    ? tauriFetch
    : globalThis.fetch.bind(globalThis);
```

In `src/app/chat/ChatPage.tsx` delete the local `appFetch` const and import it from `@/ai/providers/appFetch`.

Rewrite the agent-dependent parts of `src/components/hud/networkData.ts` (drop the `agentCatalog` import; add `import { agentSlug, agentToolNames, type AgentDef } from "@/lib/schemas";`):

```ts
/** Display info derived from a definition; color falls back to the identity hue. */
function agentInfo(def: AgentDef) {
    const slug = agentSlug(def.name);
    return {
        slug,
        color: def.color ?? agentColor(slug),
        tools: safeToolNames(def),
    };
}

function safeToolNames(def: AgentDef): string[] {
    try {
        return agentToolNames(def);
    } catch {
        return [];
    }
}

/** A session's identity color: its lone specialist, else the orchestrator hue. */
export function sessionColor(
    preset: Preset | undefined,
    agentsById: Map<string, AgentDef>,
): string {
    if (!preset) return "var(--primary)";
    const ids = safeAgents(preset);
    const def = ids.length === 1 ? agentsById.get(ids[0]!) : undefined;
    return def ? agentInfo(def).color : ORCHESTRATOR;
}
```

`attachAgent` now takes a def:

```ts
function attachAgent(
    net: Network,
    hubId: string,
    hubUnit: Vec3,
    def: AgentDef,
    slot: number,
    slots: number,
    idPrefix: string,
) {
    const unit = satelliteUnit(hubUnit, slot, slots, AGENT_SPREAD);
    const { slug, color, tools } = agentInfo(def);
    const agentId = `${idPrefix}:agent:${slug}`;
    net.nodes.push({
        id: agentId,
        kind: "agent",
        label: slug,
        color,
        unit,
        r: AGENT_R,
        parentId: hubId,
        primary: false,
        meta: {
            title: def.name,
            subtitle: def.description,
            chips: tools.map((t) => ({ label: t })),
        },
    });
    net.edges.push({ a: hubId, b: agentId });

    tools.forEach((toolName, ti) => {
        const tUnit = satelliteUnit(unit, ti, tools.length, TOOL_SPREAD);
        const toolId = `${agentId}:tool:${toolName}`;
        net.nodes.push({
            id: toolId,
            kind: "tool",
            label: toolName,
            color,
            unit: tUnit,
            r: TOOL_R,
            parentId: hubId,
            primary: false,
            meta: { title: toolName, subtitle: `tool · ${slug}` },
        });
        net.edges.push({ a: agentId, b: toolId });
    });
}
```

`buildSessionNetwork` gains a third parameter and resolves defs:

```ts
export function buildSessionNetwork(
    sessions: ChatSession[],
    presets: Preset[],
    agents: AgentDef[],
): Network {
    const shown = sessions.slice(0, MAX_SESSIONS);
    const hubUnits = fibonacciSphere(shown.length);
    const presetById = new Map(presets.map((p) => [p.id, p]));
    const agentsById = new Map(agents.map((a) => [a.id, a]));
    const net: Network = { nodes: [], edges: [] };

    shown.forEach((session, i) => {
        const hubUnit = hubUnits[i]!;
        const preset = session.preset_id
            ? presetById.get(session.preset_id)
            : undefined;
        const defs = safeAgents(preset)
            .map((id) => agentsById.get(id))
            .filter((d): d is AgentDef => d !== undefined);
        const hubId = `session:${session.id}`;
        net.nodes.push({
            id: hubId,
            kind: "session",
            label: session.title,
            color: sessionColor(preset, agentsById),
            unit: hubUnit,
            r: HUB_R,
            primary: true,
            meta: {
                title: session.title,
                subtitle: preset
                    ? `${preset.name} · ${preset.provider}/${preset.model}`
                    : "no preset",
                chips: defs.map((d) => {
                    const info = agentInfo(d);
                    return { label: info.slug, color: info.color };
                }),
                foot: `updated ${relativeTime(session.updated_at)}`,
            },
            payload: session,
        });
        defs.forEach((def, k) =>
            attachAgent(net, hubId, hubUnit, def, k, defs.length, hubId),
        );
    });

    return net;
}
```

`buildAgentTypeNetwork` becomes DB-driven (payload carries the **id** so click handlers match preset contents):

```ts
/** Orchestrator hub → every defined agent → its tools. */
export function buildAgentTypeNetwork(agents: AgentDef[]): Network {
    const units = fibonacciSphere(agents.length + 1);
    const net: Network = { nodes: [], edges: [] };

    net.nodes.push({
        id: "agent:orchestrator",
        kind: "agent",
        label: "orchestrator",
        color: ORCHESTRATOR,
        unit: units[0]!,
        r: HUB_R,
        primary: true,
        meta: {
            title: "Orchestrator",
            subtitle:
                "Runs on the preset's router model. Answers directly when it can; delegates to your agents as tool calls.",
        },
        payload: { agent: "orchestrator" },
    });

    agents.forEach((def, i) => {
        const unit = units[i + 1]!;
        const { slug, color, tools } = agentInfo(def);
        const id = `agent:${def.id}`;
        net.nodes.push({
            id,
            kind: "agent",
            label: slug,
            color,
            unit,
            r: AGENT_R + 0.3,
            primary: true,
            meta: {
                title: def.name,
                subtitle: def.description,
                chips: tools.map((t) => ({ label: t })),
            },
            payload: { agent: def.id },
        });
        net.edges.push({ a: "agent:orchestrator", b: id });

        tools.forEach((toolName, ti) => {
            const tUnit = satelliteUnit(unit, ti, tools.length, TOOL_SPREAD);
            const toolId = `${id}:tool:${toolName}`;
            net.nodes.push({
                id: toolId,
                kind: "tool",
                label: toolName,
                color,
                unit: tUnit,
                r: TOOL_R,
                parentId: id,
                primary: false,
                meta: { title: toolName, subtitle: `tool · ${slug}` },
            });
            net.edges.push({ a: id, b: toolId });
        });
    });

    return net;
}
```

Delete `src/components/hud/agentCatalog.ts`.

- [ ] **Step 8: UI call-site fallout**

`src/app/chat/ChatPage.tsx`:
- Drop the `AgentName` import; add `import { listAgents } from "@/db/repo/agents";` and `import type { AgentDef } from "@/lib/schemas";`.
- Add state `const [agents, setAgents] = useState<AgentDef[]>([]);` and load it wherever presets/levels load: `setAgents(await listAgents());`.
- Network memo: `buildSessionNetwork(sessions, presets, agents)` / `buildAgentTypeNetwork(agents)`, deps `[sessions, presets, agents]`.
- `openFromNode` fallback: the payload agent is now an **id**, so the cast disappears: `return presetAgents(p).includes(agent);`.

`src/app/chat/InstancesSidebar.tsx` (both `sessionColor(preset)` calls, lines ~94 and ~145):
- Add an `agents: AgentDef[]` prop (ChatPage passes its loaded `agents` state).
- Build the lookup once: `const agentsById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);`
- Change both calls to `sessionColor(preset, agentsById)`.

`src/app/presets/PresetsPage.tsx`:
- Delete `const ALL_AGENTS: AgentName[] = [...]` and the `AgentName` import.
- Load agents: `const [agents, setAgents] = useState<AgentDef[]>([]);` set in `reload()` via `listAgents()`; pass `agents` into `PresetForm`.
- Checkbox list becomes:

```tsx
<div className="flex flex-wrap items-center gap-4 text-sm">
    Agents:
    {agents.map((a) => (
        <label key={a.id} className="flex items-center gap-1.5">
            <input
                type="checkbox"
                checked={form.enabledAgents.includes(a.id)}
                onChange={() => toggleAgent(a.id)}
            />
            {a.name}
        </label>
    ))}
</div>
```

with `toggleAgent = (id: string) => ...` (same body, string typed).

`src/app/agents/AgentsPage.tsx` — minimal compile fix now (full roster UI is Task 7): load defs and render them.

```tsx
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NetworkSphere } from "@/components/hud/NetworkSphere";
import { buildAgentTypeNetwork } from "@/components/hud/networkData";
import { agentColor } from "@/components/hud/AgentNode";
import { listAgents } from "@/db/repo/agents";
import { agentSlug, agentToolNames, type AgentDef } from "@/lib/schemas";

export function AgentsPage() {
    const [agents, setAgents] = useState<AgentDef[]>([]);
    useEffect(() => {
        void listAgents().then(setAgents);
    }, []);
    const network = useMemo(() => buildAgentTypeNetwork(agents), [agents]);

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mx-auto flex max-w-4xl flex-col gap-6">
                <header>
                    <h1 className="font-display text-2xl font-bold tracking-wide">
                        Agent network
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Every tool call — orchestrator or specialist — passes
                        through the permission engine. Nothing runs silently.
                    </p>
                </header>
                <div className="flex justify-center">
                    <NetworkSphere
                        nodes={network.nodes}
                        edges={network.edges}
                        size={320}
                    />
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {agents.map((a) => {
                        const color = a.color ?? agentColor(agentSlug(a.name));
                        return (
                            <Card
                                key={a.id}
                                style={{ borderLeft: `2px solid ${color}` }}
                            >
                                <CardHeader>
                                    <CardTitle className="text-sm">
                                        {a.name}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-2">
                                    <p className="text-xs text-muted-foreground">
                                        {a.description}
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {agentToolNames(a).map((t) => (
                                            <code
                                                key={t}
                                                className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground/80"
                                            >
                                                {t}
                                            </code>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
```

`evals/router.eval.ts`: replace `enabledAgents: ["knowledge", "research"]` with inline defs (same routing behavior, so the ≥85% gate still applies):

```ts
import type { AgentDef } from "@/lib/schemas";

const evalDef = (
    name: string,
    description: string,
    tools: string[],
): AgentDef => ({
    id: `agt_${name.toLowerCase()}`,
    name,
    description,
    instructions: `You are the ${name} agent.`,
    tools_json: JSON.stringify(tools),
    model: null,
    max_steps: 6,
    color: null,
    is_builtin: 1,
    created_at: 0,
    updated_at: 0,
});
// in the task body:
const orchestrator = createOrchestrator(runtime, {
    systemPrompt: "...unchanged...",
    agents: [
        evalDef(
            "Knowledge",
            "Searches and reads the user's stored documents and notes.",
            ["search_documents", "read_document", "list_documents"],
        ),
        evalDef("Research", "Reads specific web pages.", ["fetch_url"]),
    ],
});
```

Also add `resolveModel` to the eval's runtime literal if `evals/models.ts` builds one: `resolveModel: () => mainModel,` (check that file; typecheck will point at it).

- [ ] **Step 9: Full verification**

Run: `npm test` — Expected: all suites PASS (orchestrator scenarios byte-identical in behavior).
Run: `npm run typecheck` — Expected: clean; `grep -rn "AgentName\|agentCatalog\|agents/knowledge\|agents/research" src evals` returns nothing.
Manual: `npm run dev` (web target) — Agents page renders both builtin agents from the DB; chat with the Study preset still delegates to knowledge.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: DB-driven agents — dynamic orchestrator, enum removal, UI fallout"
```
---

## Milestone B — Agents page: roster editor + test bench

### Task 7: tabbed Agents page + roster CRUD

**Files:**
- Modify: `src/app/agents/AgentsPage.tsx`
- Create: `src/app/agents/AgentEditor.tsx`

**Interfaces:**
- Consumes: agents repo (Task 2), `TOOL_CATALOG` (Task 4).
- Produces: `AgentsPage` with a `tab` state (`"roster" | "pipelines" | "automations"`) and a `TabBar` component reused by Tasks 12/15 (they replace the two placeholder tab bodies); `AgentEditor({ agent, onDone })`.

No unit tests (pure UI over tested repos) — verification is typecheck + manual.

- [ ] **Step 1: Create `src/app/agents/AgentEditor.tsx`**

```tsx
import { useState } from "react";
import * as agentsRepo from "@/db/repo/agents";
import { TOOL_CATALOG } from "@/ai/tools/catalog";
import { agentToolNames, type AgentDef } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GROUPS = ["documents", "notes", "web"] as const;

export function AgentEditor({
    agent,
    onDone,
}: {
    agent: AgentDef | null; // null = create
    onDone: () => Promise<void>;
}) {
    const [form, setForm] = useState<agentsRepo.AgentInput>(() =>
        agent
            ? {
                  name: agent.name,
                  description: agent.description,
                  instructions: agent.instructions,
                  tools: agentToolNames(agent),
                  model: agent.model,
                  maxSteps: agent.max_steps,
                  color: agent.color,
              }
            : {
                  name: "",
                  description: "",
                  instructions: "You are a helpful specialist agent.",
                  tools: [],
                  model: null,
                  maxSteps: 6,
                  color: null,
              },
    );
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        setError(null);
        try {
            if (agent) await agentsRepo.updateAgent(agent.id, form);
            else await agentsRepo.createAgent(form);
            await onDone();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    const toggleTool = (name: string) => {
        setForm((f) => ({
            ...f,
            tools: f.tools.includes(name)
                ? f.tools.filter((t) => t !== name)
                : [...f.tools, name],
        }));
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{agent ? `Edit ${agent.name}` : "New agent"}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <div className="flex gap-3">
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Name
                        <Input
                            value={form.name}
                            onChange={(e) =>
                                setForm({ ...form, name: e.target.value })
                            }
                        />
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Model override
                        <Input
                            value={form.model ?? ""}
                            placeholder="(preset main model)"
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    model: e.target.value || null,
                                })
                            }
                        />
                    </label>
                    <label className="flex w-28 flex-col gap-1 text-sm">
                        Max steps
                        <Input
                            type="number"
                            min={1}
                            value={form.maxSteps ?? 6}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    maxSteps: Number(e.target.value) || 6,
                                })
                            }
                        />
                    </label>
                </div>
                <label className="flex flex-col gap-1 text-sm">
                    Description
                    <Input
                        value={form.description}
                        placeholder="What the orchestrator reads when deciding to delegate"
                        onChange={(e) =>
                            setForm({ ...form, description: e.target.value })
                        }
                    />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                    Instructions (system prompt)
                    <Textarea
                        rows={6}
                        value={form.instructions}
                        onChange={(e) =>
                            setForm({ ...form, instructions: e.target.value })
                        }
                    />
                </label>
                <div className="flex flex-col gap-2 text-sm">
                    Tools
                    {GROUPS.map((group) => (
                        <div
                            key={group}
                            className="flex flex-wrap items-center gap-3"
                        >
                            <span className="w-20 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                {group}
                            </span>
                            {TOOL_CATALOG.filter((t) => t.group === group).map(
                                (t) => (
                                    <label
                                        key={t.name}
                                        className="flex items-center gap-1.5"
                                        title={t.label}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={form.tools.includes(t.name)}
                                            onChange={() => toggleTool(t.name)}
                                        />
                                        <code className="font-mono text-xs">
                                            {t.name}
                                        </code>
                                        {t.access === "write" && (
                                            <span className="font-mono text-[10px] uppercase text-warning">
                                                write
                                            </span>
                                        )}
                                    </label>
                                ),
                            )}
                        </div>
                    ))}
                </div>
                <label className="flex w-56 flex-col gap-1 text-sm">
                    Color (CSS value, optional)
                    <Input
                        value={form.color ?? ""}
                        placeholder="var(--agent-knowledge)"
                        onChange={(e) =>
                            setForm({ ...form, color: e.target.value || null })
                        }
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

- [ ] **Step 2: Rewrite `src/app/agents/AgentsPage.tsx` with tabs + roster actions**

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NetworkSphere } from "@/components/hud/NetworkSphere";
import { buildAgentTypeNetwork } from "@/components/hud/networkData";
import { agentColor } from "@/components/hud/AgentNode";
import * as agentsRepo from "@/db/repo/agents";
import { agentSlug, agentToolNames, type AgentDef } from "@/lib/schemas";
import { AgentEditor } from "./AgentEditor";
import { cn } from "@/lib/utils";

type Tab = "roster" | "pipelines" | "automations";
const TABS: { id: Tab; label: string }[] = [
    { id: "roster", label: "Roster" },
    { id: "pipelines", label: "Pipelines" },
    { id: "automations", label: "Automations" },
];

export function AgentsPage() {
    const [tab, setTab] = useState<Tab>("roster");

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mx-auto flex max-w-4xl flex-col gap-6">
                <header>
                    <h1 className="font-display text-2xl font-bold tracking-wide">
                        Agents
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Define agents, chain them into pipelines, put pipelines
                        on a schedule. Every tool call passes the permission
                        engine — nothing runs silently.
                    </p>
                </header>
                <TabBar tab={tab} onSelect={setTab} />
                {tab === "roster" && <RosterTab />}
                {tab === "pipelines" && <PipelinesPlaceholder />}
                {tab === "automations" && <AutomationsPlaceholder />}
            </div>
        </div>
    );
}

function TabBar({ tab, onSelect }: { tab: Tab; onSelect: (t: Tab) => void }) {
    return (
        <div className="flex gap-1 border-b border-border">
            {TABS.map((t) => (
                <button
                    key={t.id}
                    onClick={() => onSelect(t.id)}
                    aria-current={tab === t.id ? "page" : undefined}
                    className={cn(
                        "cursor-pointer border-b-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-ring",
                        tab === t.id
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

// Replaced by the real tabs in Tasks 12 and 15.
function PipelinesPlaceholder() {
    return (
        <p className="text-sm text-muted-foreground">Pipelines arrive next.</p>
    );
}
function AutomationsPlaceholder() {
    return (
        <p className="text-sm text-muted-foreground">Automations arrive next.</p>
    );
}

function RosterTab() {
    const [agents, setAgents] = useState<AgentDef[]>([]);
    const [editing, setEditing] = useState<AgentDef | "new" | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setAgents(await agentsRepo.listAgents());
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);

    const network = useMemo(() => buildAgentTypeNetwork(agents), [agents]);

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
            <div className="flex justify-center">
                <NetworkSphere
                    nodes={network.nodes}
                    edges={network.edges}
                    size={320}
                    onSelect={(node) => {
                        const agent = (
                            node.payload as { agent?: string } | undefined
                        )?.agent;
                        if (!agent) return;
                        setSelected(agent);
                        document
                            .getElementById(`agent-card-${agent}`)
                            ?.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                            });
                    }}
                />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {agents.map((a) => {
                    const color = a.color ?? agentColor(agentSlug(a.name));
                    return (
                        <Card
                            key={a.id}
                            id={`agent-card-${a.id}`}
                            style={{
                                borderLeft: `2px solid ${color}`,
                                boxShadow:
                                    selected === a.id
                                        ? `0 0 0 1px ${color}`
                                        : undefined,
                            }}
                        >
                            <CardHeader className="flex-row items-center gap-2">
                                <CardTitle className="flex-1 text-sm">
                                    {a.name}
                                </CardTitle>
                                {a.is_builtin === 1 && (
                                    <Badge tone="primary">builtin</Badge>
                                )}
                                {a.model && (
                                    <code className="font-mono text-[10px] text-muted-foreground">
                                        {a.model}
                                    </code>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Edit ${a.name}`}
                                    onClick={() => setEditing(a)}
                                >
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Duplicate ${a.name}`}
                                    onClick={() =>
                                        void act(() =>
                                            agentsRepo.duplicateAgent(a.id),
                                        )
                                    }
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                                {a.is_builtin === 0 && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Delete ${a.name}`}
                                        onClick={() =>
                                            void act(() =>
                                                agentsRepo.deleteAgent(a.id),
                                            )
                                        }
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <p className="text-xs text-muted-foreground">
                                    {a.description}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {agentToolNames(a).map((t) => (
                                        <code
                                            key={t}
                                            className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground/80"
                                        >
                                            {t}
                                        </code>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
            {editing ? (
                <AgentEditor
                    agent={editing === "new" ? null : editing}
                    onDone={async () => {
                        setEditing(null);
                        await reload();
                    }}
                />
            ) : (
                <Button className="self-start" onClick={() => setEditing("new")}>
                    New agent
                </Button>
            )}
        </div>
    );
}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm test` — Expected: clean.
Manual (`npm run dev`): create a "Summarizer" agent with `search_notes` + `write_note`; it appears on the sphere and in a preset's agent checkboxes; duplicate and delete work; builtin delete button absent.

- [ ] **Step 4: Commit**

```bash
git add src/app/agents/
git commit -m "feat: agents page tabs + roster CRUD editor"
```

### Task 8: agent test bench

**Files:**
- Create: `src/app/agents/AgentTestBench.tsx`
- Modify: `src/app/agents/AgentsPage.tsx` (mount inside RosterTab, under the cards)

**Interfaces:**
- Consumes: `createAgentFromDef` (Task 5), `PermissionContext`, `ApprovalCards({ broker })`, `createModel`, `useRuntime()` for settings, `appFetch` (Task 6).
- Produces: `AgentTestBench({ agents }: { agents: AgentDef[] })` — self-contained; nothing consumes it later.

- [ ] **Step 1: Create `src/app/agents/AgentTestBench.tsx`**

Runs one `generate` against the settings' default provider/models. Approvals flow through a bench-local `PermissionContext` (level = none → everything asks), rendered with the existing amber `ApprovalCards`.

```tsx
import { useMemo, useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { marked } from "marked";
import { createModel, type ProviderId } from "@/ai/providers/registry";
import { appFetch } from "@/ai/providers/appFetch";
import { PermissionContext } from "@/ai/tools/context";
import { createAgentFromDef } from "@/ai/agents/factory";
import type { AgentRuntime, AgentUsageEvent } from "@/ai/agents/types";
import { useRuntime } from "@/app/runtime";
import { ApprovalCards } from "@/components/chat/ApprovalCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgentDef } from "@/lib/schemas";

export function AgentTestBench({ agents }: { agents: AgentDef[] }) {
    const { settings } = useRuntime();
    const [agentId, setAgentId] = useState("");
    const [task, setTask] = useState("");
    const [running, setRunning] = useState(false);
    const [output, setOutput] = useState<string | null>(null);
    const [usage, setUsage] = useState<AgentUsageEvent | null>(null);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Fresh per mount; level-less → every tool call raises an approval card.
    const permissions = useMemo(() => new PermissionContext(), []);

    const run = async () => {
        const def = agents.find((a) => a.id === agentId);
        if (!def || !task.trim() || running) return;
        setRunning(true);
        setOutput(null);
        setUsage(null);
        setError(null);
        const abort = new AbortController();
        abortRef.current = abort;
        try {
            const provider = settings.defaultProvider as ProviderId;
            const base = { settings, fetch: appFetch };
            const runtime: AgentRuntime = {
                permissions,
                mainModel: createModel(
                    { provider, modelId: settings.defaultModel },
                    base,
                ),
                mainModelId: settings.defaultModel,
                routerModel: createModel(
                    { provider, modelId: settings.routerModel },
                    base,
                ),
                routerModelId: settings.routerModel,
                resolveModel: (modelId) =>
                    createModel({ provider, modelId }, base),
                fetch: appFetch,
                onUsage: setUsage,
            };
            const { agent, modelId } = createAgentFromDef(def, runtime);
            const result = await agent.generate({
                prompt: task,
                abortSignal: abort.signal,
            });
            runtime.onUsage?.({
                agent: def.name,
                model: modelId,
                usage: result.totalUsage,
            });
            setOutput(result.text || "(no text returned)");
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            permissions.broker.denyAll();
            abortRef.current = null;
            setRunning(false);
        }
    };

    const stop = () => {
        permissions.broker.denyAll();
        abortRef.current?.abort();
    };

    return (
        <Card corners>
            <CardHeader>
                <CardTitle>Test bench</CardTitle>
                <p className="text-xs text-muted-foreground">
                    Run one task against an agent with your default models.
                    Ungoverned by any level — every tool call asks.
                </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <div className="flex gap-3">
                    <Select
                        aria-label="Agent under test"
                        value={agentId}
                        onChange={(e) => setAgentId(e.target.value)}
                        className="w-56"
                    >
                        <option value="">Select agent…</option>
                        {agents.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </Select>
                    {running ? (
                        <Button variant="destructive" onClick={stop}>
                            <Square className="mr-1 h-3.5 w-3.5" /> Stop
                        </Button>
                    ) : (
                        <Button
                            disabled={!agentId || !task.trim()}
                            onClick={() => void run()}
                        >
                            <Play className="mr-1 h-3.5 w-3.5" /> Run
                        </Button>
                    )}
                </div>
                <Textarea
                    rows={3}
                    placeholder="Task for the agent — self-contained, it has no chat context."
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                />
                <ApprovalCards broker={permissions.broker} />
                {running && (
                    <p className="shimmer font-mono text-xs text-muted-foreground">
                        running…
                    </p>
                )}
                {error && (
                    <p className="font-mono text-xs text-destructive">{error}</p>
                )}
                {output !== null && (
                    <div
                        className="prose prose-sm prose-invert max-w-none rounded-sm border border-border bg-background/60 p-3 text-sm"
                        // Same rendering path as chat messages (marked).
                        dangerouslySetInnerHTML={{
                            __html: marked.parse(output, { async: false }),
                        }}
                    />
                )}
                {usage && (
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {usage.model} · in{" "}
                        {usage.usage.inputTokens?.total ?? "?"} · out{" "}
                        {usage.usage.outputTokens?.total ?? "?"}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
```

> Two check-before-use notes for the implementer: (1) mirror how `MessageList.tsx` renders markdown (`marked` options/sanitization) instead of the `dangerouslySetInnerHTML` call above if it differs; (2) mirror `TokenMeter`/`tokens.ts` for the exact `LanguageModelUsage` field access if `inputTokens?.total` doesn't typecheck.

- [ ] **Step 2: Mount it in `RosterTab`**

At the end of `RosterTab`'s JSX (after the editor/new-agent button): `<AgentTestBench agents={agents} />` with the import added.

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm test` — Expected: clean.
Manual: run the Knowledge agent with "list my notes" → amber approval card appears → allow once → output + usage line render; Stop mid-run aborts cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/app/agents/
git commit -m "feat: agent test bench with live approvals"
```
---

## Milestone C — Pipelines

### Task 9: template renderer

**Files:**
- Create: `src/lib/template.ts`
- Test: `src/lib/template.test.ts`

**Interfaces:**
- Produces: `renderTemplate(template: string, vars: Record<string, string>): string` — `{{key}}` substitution, throws on unknown keys. Runner (Task 11) and automations (Task 14) consume it.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/template.test.ts
import { describe, expect, it } from "vitest";
import { renderTemplate } from "./template";

describe("renderTemplate", () => {
    it("substitutes variables with optional whitespace", () => {
        expect(
            renderTemplate("Summarize {{input}} on {{ date }}", {
                input: "HN",
                date: "2026-07-11",
            }),
        ).toBe("Summarize HN on 2026-07-11");
    });

    it("passes through text without placeholders", () => {
        expect(renderTemplate("plain", {})).toBe("plain");
    });

    it("throws on unknown variables (fail fast, no silent blanks)", () => {
        expect(() => renderTemplate("{{step9}}", { input: "x" })).toThrow(
            /unknown template variable.*step9/,
        );
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/template.test.ts`
Expected: FAIL — module `./template` not found.

- [ ] **Step 3: Implement `src/lib/template.ts`**

```ts
const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Minimal {{var}} templating for pipeline prompts. Unknown variables throw:
 * a typo'd {{step3}} must fail the run, not silently inject an empty string.
 */
export function renderTemplate(
    template: string,
    vars: Record<string, string>,
): string {
    return template.replace(PLACEHOLDER, (_, key: string) => {
        const value = vars[key];
        if (value === undefined)
            throw new Error(`unknown template variable: {{${key}}}`);
        return value;
    });
}
```

- [ ] **Step 4: Run tests, typecheck, commit**

Run: `npx vitest run src/lib/template.test.ts && npm run typecheck` — Expected: PASS/clean.

```bash
git add src/lib/template.ts src/lib/template.test.ts
git commit -m "feat: renderTemplate for pipeline prompt variables"
```

### Task 10: pipelines migration + repository

**Files:**
- Create: `src-tauri/migrations/0004_pipelines.sql`, `src/db/repo/pipelines.ts`
- Modify: `src-tauri/src/lib.rs`, `src/lib/schemas.ts`
- Test: `src/db/repo/pipelines.test.ts`

**Interfaces:**
- Produces (schemas): `pipelineSchema/Pipeline`, `pipelineStepSchema/PipelineStep`, `pipelineRunSchema/PipelineRun` (status `"running"|"success"|"error"`), `pipelineStepRunSchema/PipelineStepRun` (status `"running"|"success"|"error"`).
- Produces (repo): `createPipeline({name, description?})`, `updatePipeline(id, {name, description?})`, `deletePipeline(id)`, `getPipeline(id)`, `listPipelines()`, `setPipelineSteps(pipelineId, steps: {agentId: string; promptTemplate: string}[])`, `listPipelineSteps(pipelineId)` (ordered by position, 1-based), `createRun({pipelineId, automationId?, input})`, `finishRun(id, {status, error?})`, `createStepRun({runId, position, agentId, prompt})`, `finishStepRun(id, {status, output?, error?})`, `listRuns(opts?: {pipelineId?: string; automationId?: string; limit?: number})` (newest first), `listStepRuns(runId)`.

- [ ] **Step 1: Write the migration `src-tauri/migrations/0004_pipelines.sql`**

```sql
-- Pipelines: ordered agent steps + persisted run history.
-- automation_id is plain TEXT (no FK): automations arrive in migration 0005.

CREATE TABLE pipelines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE pipeline_steps (
    id TEXT PRIMARY KEY,
    pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    agent_id TEXT NOT NULL REFERENCES agents(id),
    prompt_template TEXT NOT NULL
);
CREATE INDEX idx_pipeline_steps ON pipeline_steps(pipeline_id, position);

CREATE TABLE pipeline_runs (
    id TEXT PRIMARY KEY,
    pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    automation_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'error')),
    input TEXT NOT NULL DEFAULT '',
    error TEXT,
    started_at INTEGER NOT NULL,
    finished_at INTEGER
);
CREATE INDEX idx_pipeline_runs ON pipeline_runs(pipeline_id, started_at);

CREATE TABLE pipeline_step_runs (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    agent_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    output TEXT,
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'error')),
    error TEXT,
    started_at INTEGER NOT NULL,
    finished_at INTEGER
);
CREATE INDEX idx_pipeline_step_runs ON pipeline_step_runs(run_id, position);
```

Register in `src-tauri/src/lib.rs`:

```rust
Migration {
    version: 4,
    description: "pipelines, steps, run history",
    sql: include_str!("../migrations/0004_pipelines.sql"),
    kind: MigrationKind::Up,
},
```

- [ ] **Step 2: Add schemas to `src/lib/schemas.ts`**

```ts
export const pipelineSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    created_at: z.number(),
    updated_at: z.number(),
});
export type Pipeline = z.infer<typeof pipelineSchema>;

export const pipelineStepSchema = z.object({
    id: z.string(),
    pipeline_id: z.string(),
    position: z.number(),
    agent_id: z.string(),
    prompt_template: z.string(),
});
export type PipelineStep = z.infer<typeof pipelineStepSchema>;

export const runStatusSchema = z.enum(["running", "success", "error"]);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const pipelineRunSchema = z.object({
    id: z.string(),
    pipeline_id: z.string(),
    automation_id: z.string().nullable(),
    status: runStatusSchema,
    input: z.string(),
    error: z.string().nullable(),
    started_at: z.number(),
    finished_at: z.number().nullable(),
});
export type PipelineRun = z.infer<typeof pipelineRunSchema>;

export const pipelineStepRunSchema = z.object({
    id: z.string(),
    run_id: z.string(),
    position: z.number(),
    agent_id: z.string(),
    prompt: z.string(),
    output: z.string().nullable(),
    status: runStatusSchema,
    error: z.string().nullable(),
    started_at: z.number(),
    finished_at: z.number().nullable(),
});
export type PipelineStepRun = z.infer<typeof pipelineStepRunSchema>;
```

- [ ] **Step 3: Write the failing repo test**

```ts
// src/db/repo/pipelines.test.ts
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { seedBuiltinAgents, BUILTIN_AGENT_IDS } from "./agents";
import {
    createPipeline,
    createRun,
    createStepRun,
    deletePipeline,
    finishRun,
    finishStepRun,
    listPipelineSteps,
    listPipelines,
    listRuns,
    listStepRuns,
    setPipelineSteps,
} from "./pipelines";

let db: ReturnType<typeof createTestDbClient>;

beforeEach(async () => {
    db = createTestDbClient();
    setDb(db);
    await seedBuiltinAgents();
});

afterEach(() => db.close());

describe("pipelines repo", () => {
    it("creates a pipeline and replaces its steps atomically-enough", async () => {
        const p = await createPipeline({ name: "Digest" });
        await setPipelineSteps(p.id, [
            {
                agentId: BUILTIN_AGENT_IDS.research,
                promptTemplate: "Read {{input}}",
            },
            {
                agentId: BUILTIN_AGENT_IDS.knowledge,
                promptTemplate: "Relate to my notes: {{prev}}",
            },
        ]);
        let steps = await listPipelineSteps(p.id);
        expect(steps.map((s) => s.position)).toEqual([1, 2]);

        await setPipelineSteps(p.id, [
            {
                agentId: BUILTIN_AGENT_IDS.knowledge,
                promptTemplate: "only step {{input}}",
            },
        ]);
        steps = await listPipelineSteps(p.id);
        expect(steps).toHaveLength(1);
        expect(steps[0]!.position).toBe(1);
    });

    it("persists run and step-run lifecycles", async () => {
        const p = await createPipeline({ name: "R" });
        const run = await createRun({ pipelineId: p.id, input: "go" });
        expect(run.status).toBe("running");

        const sr = await createStepRun({
            runId: run.id,
            position: 1,
            agentId: BUILTIN_AGENT_IDS.research,
            prompt: "Read go",
        });
        await finishStepRun(sr.id, { status: "success", output: "done" });
        await finishRun(run.id, { status: "success" });

        const runs = await listRuns({ pipelineId: p.id });
        expect(runs[0]!.status).toBe("success");
        expect(runs[0]!.finished_at).not.toBeNull();
        const stepRuns = await listStepRuns(run.id);
        expect(stepRuns[0]!.output).toBe("done");
    });

    it("cascades runs and steps on pipeline delete", async () => {
        const p = await createPipeline({ name: "X" });
        const run = await createRun({ pipelineId: p.id, input: "" });
        await deletePipeline(p.id);
        expect(await listPipelines()).toHaveLength(0);
        expect(await listStepRuns(run.id)).toHaveLength(0);
        expect(await listRuns({})).toHaveLength(0);
    });
});
```

Run: `npx vitest run src/db/repo/pipelines.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 4: Implement `src/db/repo/pipelines.ts`**

```ts
import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import {
    pipelineRunSchema,
    pipelineSchema,
    pipelineStepRunSchema,
    pipelineStepSchema,
    type Pipeline,
    type PipelineRun,
    type PipelineStep,
    type PipelineStepRun,
    type RunStatus,
} from "@/lib/schemas";

export async function createPipeline(input: {
    name: string;
    description?: string | null;
}): Promise<Pipeline> {
    const id = newId("pip");
    const t = now();
    await getDb().execute(
        `INSERT INTO pipelines (id, name, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, input.name, input.description ?? null, t, t],
    );
    return getPipeline(id);
}

export async function updatePipeline(
    id: string,
    input: { name: string; description?: string | null },
): Promise<Pipeline> {
    const res = await getDb().execute(
        "UPDATE pipelines SET name = ?, description = ?, updated_at = ? WHERE id = ?",
        [input.name, input.description ?? null, now(), id],
    );
    if (res.rowsAffected === 0) throw new Error(`pipeline not found: ${id}`);
    return getPipeline(id);
}

export async function getPipeline(id: string): Promise<Pipeline> {
    const rows = await getDb().select(
        "SELECT * FROM pipelines WHERE id = ?",
        [id],
    );
    if (!rows[0]) throw new Error(`pipeline not found: ${id}`);
    return pipelineSchema.parse(rows[0]);
}

export async function listPipelines(): Promise<Pipeline[]> {
    const rows = await getDb().select(
        "SELECT * FROM pipelines ORDER BY created_at ASC",
    );
    return rows.map((r) => pipelineSchema.parse(r));
}

export async function deletePipeline(id: string): Promise<void> {
    await getDb().execute("DELETE FROM pipelines WHERE id = ?", [id]);
}

/**
 * Replace all steps (delete + insert, positions 1..N). Two statements, no
 * transaction: single local writer; a failure surfaces immediately in the UI.
 */
export async function setPipelineSteps(
    pipelineId: string,
    steps: { agentId: string; promptTemplate: string }[],
): Promise<void> {
    await getDb().execute(
        "DELETE FROM pipeline_steps WHERE pipeline_id = ?",
        [pipelineId],
    );
    for (const [i, step] of steps.entries()) {
        await getDb().execute(
            `INSERT INTO pipeline_steps (id, pipeline_id, position, agent_id, prompt_template)
             VALUES (?, ?, ?, ?, ?)`,
            [newId("pst"), pipelineId, i + 1, step.agentId, step.promptTemplate],
        );
    }
    await getDb().execute(
        "UPDATE pipelines SET updated_at = ? WHERE id = ?",
        [now(), pipelineId],
    );
}

export async function listPipelineSteps(
    pipelineId: string,
): Promise<PipelineStep[]> {
    const rows = await getDb().select(
        "SELECT * FROM pipeline_steps WHERE pipeline_id = ? ORDER BY position ASC",
        [pipelineId],
    );
    return rows.map((r) => pipelineStepSchema.parse(r));
}

export async function createRun(input: {
    pipelineId: string;
    automationId?: string | null;
    input: string;
}): Promise<PipelineRun> {
    const id = newId("run");
    await getDb().execute(
        `INSERT INTO pipeline_runs (id, pipeline_id, automation_id, status, input, started_at)
         VALUES (?, ?, ?, 'running', ?, ?)`,
        [id, input.pipelineId, input.automationId ?? null, input.input, now()],
    );
    return getRun(id);
}

export async function getRun(id: string): Promise<PipelineRun> {
    const rows = await getDb().select(
        "SELECT * FROM pipeline_runs WHERE id = ?",
        [id],
    );
    if (!rows[0]) throw new Error(`pipeline run not found: ${id}`);
    return pipelineRunSchema.parse(rows[0]);
}

export async function finishRun(
    id: string,
    result: { status: Exclude<RunStatus, "running">; error?: string | null },
): Promise<void> {
    await getDb().execute(
        "UPDATE pipeline_runs SET status = ?, error = ?, finished_at = ? WHERE id = ?",
        [result.status, result.error ?? null, now(), id],
    );
}

export async function listRuns(
    opts: { pipelineId?: string; automationId?: string; limit?: number } = {},
): Promise<PipelineRun[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (opts.pipelineId) {
        where.push("pipeline_id = ?");
        params.push(opts.pipelineId);
    }
    if (opts.automationId) {
        where.push("automation_id = ?");
        params.push(opts.automationId);
    }
    params.push(opts.limit ?? 20);
    const rows = await getDb().select(
        `SELECT * FROM pipeline_runs
         ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY started_at DESC LIMIT ?`,
        params,
    );
    return rows.map((r) => pipelineRunSchema.parse(r));
}

export async function createStepRun(input: {
    runId: string;
    position: number;
    agentId: string;
    prompt: string;
}): Promise<PipelineStepRun> {
    const id = newId("srn");
    await getDb().execute(
        `INSERT INTO pipeline_step_runs (id, run_id, position, agent_id, prompt, status, started_at)
         VALUES (?, ?, ?, ?, ?, 'running', ?)`,
        [id, input.runId, input.position, input.agentId, input.prompt, now()],
    );
    const rows = await getDb().select(
        "SELECT * FROM pipeline_step_runs WHERE id = ?",
        [id],
    );
    return pipelineStepRunSchema.parse(rows[0]);
}

export async function finishStepRun(
    id: string,
    result: {
        status: Exclude<RunStatus, "running">;
        output?: string | null;
        error?: string | null;
    },
): Promise<void> {
    await getDb().execute(
        `UPDATE pipeline_step_runs SET status = ?, output = ?, error = ?, finished_at = ?
         WHERE id = ?`,
        [result.status, result.output ?? null, result.error ?? null, now(), id],
    );
}

export async function listStepRuns(runId: string): Promise<PipelineStepRun[]> {
    const rows = await getDb().select(
        "SELECT * FROM pipeline_step_runs WHERE run_id = ? ORDER BY position ASC",
        [runId],
    );
    return rows.map((r) => pipelineStepRunSchema.parse(r));
}
```

- [ ] **Step 5: Run tests, typecheck, commit**

Run: `npx vitest run src/db/repo/pipelines.test.ts && npm run typecheck` — Expected: PASS/clean.

```bash
git add src-tauri/migrations/0004_pipelines.sql src-tauri/src/lib.rs src/lib/schemas.ts src/db/repo/pipelines.ts src/db/repo/pipelines.test.ts
git commit -m "feat: pipelines schema + repository with run history"
```

### Task 11: pipeline runner

**Files:**
- Create: `src/ai/pipelines/runner.ts`
- Test: `src/ai/pipelines/runner.test.ts`

**Interfaces:**
- Consumes: pipelines repo (Task 10), `getAgent` (Task 2), `createAgentFromDef` (Task 5), `renderTemplate` (Task 9), `agentSlug`.
- Produces: `runPipeline(opts: { pipelineId: string; input: string; runtime: AgentRuntime; automationId?: string; abortSignal?: AbortSignal; onProgress?: () => void }): Promise<{ runId: string; status: "success" | "error"; finalOutput: string }>`. Template vars per step: `input`, `date`, `prev`, `step1…stepN` (outputs of finished steps).

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/pipelines/runner.test.ts
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import type { LanguageModelV3GenerateResult } from "@ai-sdk/provider";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { createAgent } from "@/db/repo/agents";
import {
    createPipeline,
    listRuns,
    listStepRuns,
    setPipelineSteps,
} from "@/db/repo/pipelines";
import { PermissionContext } from "@/ai/tools/context";
import type { AgentRuntime } from "@/ai/agents/types";
import { runPipeline } from "./runner";

let db: ReturnType<typeof createTestDbClient>;

beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

const usage = {
    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 5, text: 5, reasoning: 0 },
};
const text = (t: string): LanguageModelV3GenerateResult => ({
    content: [{ type: "text" as const, text: t }],
    finishReason: { unified: "stop" as const, raw: undefined },
    usage,
    warnings: [],
});

function runtimeWith(model: MockLanguageModelV3): AgentRuntime {
    return {
        permissions: new PermissionContext(),
        mainModel: model,
        mainModelId: "mock-main",
        routerModel: model,
        routerModelId: "mock-main",
        resolveModel: () => model,
        fetch: async () => new Response("stub"),
    };
}

async function twoStepPipeline() {
    const a = await createAgent({
        name: "Reader",
        description: "reads",
        instructions: "Read.",
        tools: [],
    });
    const b = await createAgent({
        name: "Writer",
        description: "writes",
        instructions: "Write.",
        tools: [],
    });
    const p = await createPipeline({ name: "Digest" });
    await setPipelineSteps(p.id, [
        { agentId: a.id, promptTemplate: "Read {{input}}" },
        { agentId: b.id, promptTemplate: "Summarize: {{prev}}" },
    ]);
    return p;
}

describe("runPipeline", () => {
    it("chains step outputs and persists the run", async () => {
        const p = await twoStepPipeline();
        const model = new MockLanguageModelV3({
            doGenerate: [text("PAGE CONTENT"), text("THE SUMMARY")],
        });

        const result = await runPipeline({
            pipelineId: p.id,
            input: "hn.example",
            runtime: runtimeWith(model),
        });

        expect(result.status).toBe("success");
        expect(result.finalOutput).toBe("THE SUMMARY");
        // Step 2's prompt saw step 1's output via {{prev}}.
        expect(
            JSON.stringify(model.doGenerateCalls[1]?.prompt),
        ).toContain("Summarize: PAGE CONTENT");

        const runs = await listRuns({ pipelineId: p.id });
        expect(runs[0]!.status).toBe("success");
        const steps = await listStepRuns(result.runId);
        expect(steps.map((s) => s.status)).toEqual(["success", "success"]);
        expect(steps[1]!.output).toBe("THE SUMMARY");
    });

    it("marks the run failed when a step throws and stops there", async () => {
        const p = await twoStepPipeline();
        const model = new MockLanguageModelV3({
            doGenerate: () => {
                throw new Error("model exploded");
            },
        });

        const result = await runPipeline({
            pipelineId: p.id,
            input: "x",
            runtime: runtimeWith(model),
        });

        expect(result.status).toBe("error");
        const runs = await listRuns({ pipelineId: p.id });
        expect(runs[0]!.status).toBe("error");
        expect(runs[0]!.error).toContain("step 1");
        const steps = await listStepRuns(result.runId);
        expect(steps).toHaveLength(1);
        expect(steps[0]!.status).toBe("error");
    });

    it("throws before creating a run when the pipeline has no steps", async () => {
        const p = await createPipeline({ name: "Empty" });
        await expect(
            runPipeline({
                pipelineId: p.id,
                input: "",
                runtime: runtimeWith(new MockLanguageModelV3({})),
            }),
        ).rejects.toThrow(/no steps/);
        expect(await listRuns({ pipelineId: p.id })).toHaveLength(0);
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ai/pipelines/runner.test.ts`
Expected: FAIL — module `./runner` not found.

- [ ] **Step 3: Implement `src/ai/pipelines/runner.ts`**

```ts
import { getAgent } from "@/db/repo/agents";
import {
    createRun,
    createStepRun,
    finishRun,
    finishStepRun,
    listPipelineSteps,
} from "@/db/repo/pipelines";
import { createAgentFromDef } from "@/ai/agents/factory";
import type { AgentRuntime } from "@/ai/agents/types";
import { renderTemplate } from "@/lib/template";
import { agentSlug } from "@/lib/schemas";

export interface PipelineRunResult {
    runId: string;
    status: "success" | "error";
    finalOutput: string;
}

/**
 * Executes a pipeline's steps sequentially. Each step renders its prompt
 * template ({{input}}, {{date}}, {{prev}}, {{stepN}}), runs its agent, and
 * persists a step-run row. The first failure ends the run as 'error' — later
 * steps depend on earlier output, so continuing would compound garbage.
 */
export async function runPipeline(opts: {
    pipelineId: string;
    input: string;
    runtime: AgentRuntime;
    automationId?: string;
    abortSignal?: AbortSignal;
    /** Fired after every persisted change so the UI can refresh run rows. */
    onProgress?: () => void;
}): Promise<PipelineRunResult> {
    const steps = await listPipelineSteps(opts.pipelineId);
    if (steps.length === 0)
        throw new Error(`pipeline has no steps: ${opts.pipelineId}`);

    const run = await createRun({
        pipelineId: opts.pipelineId,
        automationId: opts.automationId ?? null,
        input: opts.input,
    });
    opts.onProgress?.();

    const vars: Record<string, string> = {
        input: opts.input,
        date: new Date().toISOString().slice(0, 10),
        prev: opts.input,
    };
    let finalOutput = "";

    for (const step of steps) {
        let stepRunId: string | null = null;
        try {
            const def = await getAgent(step.agent_id);
            const prompt = renderTemplate(step.prompt_template, vars);
            const stepRun = await createStepRun({
                runId: run.id,
                position: step.position,
                agentId: def.id,
                prompt,
            });
            stepRunId = stepRun.id;
            opts.onProgress?.();

            const { agent, modelId } = createAgentFromDef(def, opts.runtime);
            const result = await agent.generate({
                prompt,
                abortSignal: opts.abortSignal,
            });
            opts.runtime.onUsage?.({
                agent: agentSlug(def.name),
                model: modelId,
                usage: result.totalUsage,
            });

            const output = result.text || "(the agent returned no text)";
            await finishStepRun(stepRun.id, { status: "success", output });
            vars[`step${step.position}`] = output;
            vars.prev = output;
            finalOutput = output;
            opts.onProgress?.();
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            if (stepRunId)
                await finishStepRun(stepRunId, {
                    status: "error",
                    error: message,
                });
            await finishRun(run.id, {
                status: "error",
                error: `step ${step.position}: ${message}`,
            });
            opts.onProgress?.();
            return { runId: run.id, status: "error", finalOutput };
        }
    }

    await finishRun(run.id, { status: "success" });
    opts.onProgress?.();
    return { runId: run.id, status: "success", finalOutput };
}
```

- [ ] **Step 4: Run tests, typecheck, commit**

Run: `npx vitest run src/ai/pipelines/runner.test.ts && npm test && npm run typecheck` — Expected: PASS/clean.

```bash
git add src/ai/pipelines/
git commit -m "feat: sequential pipeline runner with persisted step history"
```

### Task 12: Pipelines tab UI

**Files:**
- Create: `src/app/agents/PipelinesTab.tsx`, `src/app/agents/RunHistory.tsx`
- Modify: `src/app/agents/AgentsPage.tsx` (replace `PipelinesPlaceholder`)
- Modify: `src/ai/agents/runtime.ts` (add `buildPipelineRuntime`)

**Interfaces:**
- Consumes: pipelines repo, `runPipeline`, agents repo, `ApprovalCards`, `useRuntime()`, `appFetch`, permission levels (`listLevels`, `listGrants` via `applyPermissionLevel`).
- Produces: `buildPipelineRuntime({ settings, fetch, permissions, onUsage? }): AgentRuntime` (settings-default models; also used by Task 14); `RunHistory({ runs })` (also used by Task 15); `PipelinesTab()`.

- [ ] **Step 1: Add `buildPipelineRuntime` to `src/ai/agents/runtime.ts`**

```ts
/**
 * Runtime for pipeline/automation runs — no preset involved: models come from
 * the settings defaults; per-agent overrides still apply via resolveModel.
 */
export function buildPipelineRuntime(opts: {
    settings: Settings;
    fetch: typeof globalThis.fetch;
    permissions: PermissionContext;
    onUsage?: (event: AgentUsageEvent) => void;
}): AgentRuntime {
    const provider = opts.settings.defaultProvider as ProviderId;
    const base = { settings: opts.settings, fetch: opts.fetch };
    return {
        permissions: opts.permissions,
        mainModel: createModel(
            { provider, modelId: opts.settings.defaultModel },
            base,
        ),
        mainModelId: opts.settings.defaultModel,
        routerModel: createModel(
            { provider, modelId: opts.settings.routerModel },
            base,
        ),
        routerModelId: opts.settings.routerModel,
        resolveModel: (modelId) => createModel({ provider, modelId }, base),
        fetch: opts.fetch,
        onUsage: opts.onUsage,
    };
}
```

(Reuses the file's existing imports; add any missing type imports.)

- [ ] **Step 2: Create `src/app/agents/RunHistory.tsx`**

```tsx
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { listStepRuns } from "@/db/repo/pipelines";
import type { PipelineRun, PipelineStepRun, RunStatus } from "@/lib/schemas";
import { Badge } from "@/components/ui/badge";

const TONE: Record<RunStatus, "primary" | "success" | "destructive"> = {
    running: "primary",
    success: "success",
    error: "destructive",
};

export function RunHistory({ runs }: { runs: PipelineRun[] }) {
    if (runs.length === 0)
        return <p className="text-xs text-muted-foreground">No runs yet.</p>;
    return (
        <div className="flex flex-col gap-1.5">
            {runs.map((run) => (
                <RunRow key={run.id} run={run} />
            ))}
        </div>
    );
}

function RunRow({ run }: { run: PipelineRun }) {
    const [open, setOpen] = useState(false);
    const [steps, setSteps] = useState<PipelineStepRun[]>([]);

    useEffect(() => {
        if (open) void listStepRuns(run.id).then(setSteps);
    }, [open, run.id, run.status]);

    const Chevron = open ? ChevronDown : ChevronRight;
    return (
        <div className="rounded-md border border-border bg-card/60">
            <button
                onClick={() => setOpen((o) => !o)}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-ring"
            >
                <Chevron aria-hidden className="h-3.5 w-3.5 shrink-0" />
                <Badge tone={TONE[run.status]}>{run.status}</Badge>
                <span className="flex-1 truncate font-mono text-xs text-muted-foreground">
                    {run.input || "(no input)"}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date(run.started_at).toLocaleString()}
                </span>
            </button>
            {open && (
                <div className="flex flex-col gap-2 border-t border-border p-3">
                    {run.error && (
                        <p className="font-mono text-xs text-destructive">
                            {run.error}
                        </p>
                    )}
                    {steps.map((s) => (
                        <div key={s.id} className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                    step {s.position}
                                </span>
                                <Badge tone={TONE[s.status]}>{s.status}</Badge>
                            </div>
                            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-sm border border-border bg-background/60 p-2 font-mono text-xs">
                                {s.output ?? s.error ?? s.prompt}
                            </pre>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 3: Create `src/app/agents/PipelinesTab.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { Pencil, Play, Plus, Trash2 } from "lucide-react";
import * as pipelinesRepo from "@/db/repo/pipelines";
import { listAgents } from "@/db/repo/agents";
import { listLevels, listGrants } from "@/db/repo/permissions";
import { toScopedGrant } from "@/ai/permissions/engine";
import { PermissionContext } from "@/ai/tools/context";
import { buildPipelineRuntime } from "@/ai/agents/runtime";
import { runPipeline } from "@/ai/pipelines/runner";
import { appFetch } from "@/ai/providers/appFetch";
import { useRuntime } from "@/app/runtime";
import { ApprovalCards } from "@/components/chat/ApprovalCard";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
    AgentDef,
    PermissionLevel,
    Pipeline,
    PipelineRun,
    PipelineStep,
} from "@/lib/schemas";
import { RunHistory } from "./RunHistory";

interface StepDraft {
    agentId: string;
    promptTemplate: string;
}

export function PipelinesTab() {
    const { settings } = useRuntime();
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [agents, setAgents] = useState<AgentDef[]>([]);
    const [levels, setLevels] = useState<PermissionLevel[]>([]);
    const [editing, setEditing] = useState<Pipeline | "new" | null>(null);
    const [runsFor, setRunsFor] = useState<string | null>(null);
    const [runs, setRuns] = useState<PipelineRun[]>([]);
    const [runInput, setRunInput] = useState("");
    const [levelId, setLevelId] = useState("");
    const [running, setRunning] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<PermissionContext | null>(
        null,
    );
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setPipelines(await pipelinesRepo.listPipelines());
        setAgents(await listAgents());
        setLevels(await listLevels());
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);

    const refreshRuns = useCallback(async (pipelineId: string) => {
        setRunsFor(pipelineId);
        setRuns(await pipelinesRepo.listRuns({ pipelineId }));
    }, []);

    const runNow = async (pipeline: Pipeline) => {
        if (running) return;
        setError(null);
        setRunning(pipeline.id);
        const perms = new PermissionContext();
        setPermissions(perms);
        try {
            if (levelId) {
                const grants = await listGrants(levelId);
                perms.levelGrants = grants.map(toScopedGrant);
            }
            const runtime = buildPipelineRuntime({
                settings,
                fetch: appFetch,
                permissions: perms,
            });
            await runPipeline({
                pipelineId: pipeline.id,
                input: runInput,
                runtime,
                onProgress: () => void refreshRuns(pipeline.id),
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            perms.broker.denyAll();
            setPermissions(null);
            setRunning(null);
            await refreshRuns(pipeline.id);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-end gap-3">
                <label className="flex flex-1 flex-col gap-1 text-sm">
                    Run input ({"{{input}}"} in step templates)
                    <Input
                        value={runInput}
                        onChange={(e) => setRunInput(e.target.value)}
                        placeholder="e.g. https://news.ycombinator.com"
                    />
                </label>
                <label className="flex w-56 flex-col gap-1 text-sm">
                    Permission level for manual runs
                    <Select
                        value={levelId}
                        onChange={(e) => setLevelId(e.target.value)}
                    >
                        <option value="">Ask everything</option>
                        {levels.map((l) => (
                            <option key={l.id} value={l.id}>
                                {l.name}
                            </option>
                        ))}
                    </Select>
                </label>
            </div>

            {permissions && <ApprovalCards broker={permissions.broker} />}
            {error && <p className="text-xs text-destructive">{error}</p>}

            {pipelines.map((p) => (
                <Card key={p.id}>
                    <CardHeader className="flex-row items-center gap-2">
                        <div className="flex-1">
                            <CardTitle>{p.name}</CardTitle>
                            {p.description && (
                                <p className="text-xs text-muted-foreground">
                                    {p.description}
                                </p>
                            )}
                        </div>
                        <Button
                            size="sm"
                            disabled={running !== null}
                            onClick={() => void runNow(p)}
                        >
                            <Play className="mr-1 h-3.5 w-3.5" />
                            {running === p.id ? "Running…" : "Run"}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${p.name}`}
                            onClick={() => setEditing(p)}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${p.name}`}
                            onClick={() =>
                                void pipelinesRepo
                                    .deletePipeline(p.id)
                                    .then(reload)
                            }
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        <button
                            className="cursor-pointer self-start font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                            onClick={() =>
                                runsFor === p.id
                                    ? setRunsFor(null)
                                    : void refreshRuns(p.id)
                            }
                        >
                            {runsFor === p.id ? "hide runs" : "show runs"}
                        </button>
                        {runsFor === p.id && <RunHistory runs={runs} />}
                    </CardContent>
                </Card>
            ))}

            {editing ? (
                <PipelineEditor
                    pipeline={editing === "new" ? null : editing}
                    agents={agents}
                    onDone={async () => {
                        setEditing(null);
                        await reload();
                    }}
                />
            ) : (
                <Button className="self-start" onClick={() => setEditing("new")}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> New pipeline
                </Button>
            )}
        </div>
    );
}

function PipelineEditor({
    pipeline,
    agents,
    onDone,
}: {
    pipeline: Pipeline | null;
    agents: AgentDef[];
    onDone: () => Promise<void>;
}) {
    const [name, setName] = useState(pipeline?.name ?? "");
    const [description, setDescription] = useState(pipeline?.description ?? "");
    const [steps, setSteps] = useState<StepDraft[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!pipeline) return;
        void pipelinesRepo
            .listPipelineSteps(pipeline.id)
            .then((existing: PipelineStep[]) =>
                setSteps(
                    existing.map((s) => ({
                        agentId: s.agent_id,
                        promptTemplate: s.prompt_template,
                    })),
                ),
            );
    }, [pipeline]);

    const save = async () => {
        setError(null);
        try {
            if (steps.length === 0)
                throw new Error("a pipeline needs at least one step");
            if (steps.some((s) => !s.agentId))
                throw new Error("every step needs an agent");
            const target = pipeline
                ? await pipelinesRepo.updatePipeline(pipeline.id, {
                      name,
                      description: description || null,
                  })
                : await pipelinesRepo.createPipeline({
                      name,
                      description: description || null,
                  });
            await pipelinesRepo.setPipelineSteps(target.id, steps);
            await onDone();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    const setStep = (i: number, patch: Partial<StepDraft>) =>
        setSteps((all) =>
            all.map((s, j) => (j === i ? { ...s, ...patch } : s)),
        );

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    {pipeline ? `Edit ${pipeline.name}` : "New pipeline"}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                    Steps run in order. Templates: {"{{input}}"}, {"{{prev}}"},{" "}
                    {"{{step1}}"}…, {"{{date}}"}.
                </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <div className="flex gap-3">
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Name
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Description
                        <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </label>
                </div>
                {steps.map((s, i) => (
                    <div
                        key={i}
                        className="flex flex-col gap-2 rounded-md border border-border p-3"
                    >
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                step {i + 1}
                            </span>
                            <Select
                                aria-label={`Agent for step ${i + 1}`}
                                value={s.agentId}
                                onChange={(e) =>
                                    setStep(i, { agentId: e.target.value })
                                }
                                className="w-52"
                            >
                                <option value="">Select agent…</option>
                                {agents.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}
                                    </option>
                                ))}
                            </Select>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Remove step ${i + 1}`}
                                onClick={() =>
                                    setSteps((all) =>
                                        all.filter((_, j) => j !== i),
                                    )
                                }
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                        <Textarea
                            rows={2}
                            placeholder="Prompt template for this step"
                            value={s.promptTemplate}
                            onChange={(e) =>
                                setStep(i, { promptTemplate: e.target.value })
                            }
                        />
                    </div>
                ))}
                <Button
                    variant="outline"
                    className="self-start"
                    onClick={() =>
                        setSteps((all) => [
                            ...all,
                            { agentId: "", promptTemplate: "{{prev}}" },
                        ])
                    }
                >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add step
                </Button>
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

- [ ] **Step 4: Wire into `AgentsPage.tsx`**

Replace `PipelinesPlaceholder` usage: `{tab === "pipelines" && <PipelinesTab />}` and delete the placeholder component; add the import.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm test` — Expected: clean.
Manual: build "HN digest" (step 1 Research: `Read {{input}} and list the top stories`; step 2 a custom Writer agent with `write_note`: `Save a note titled "HN digest {{date}}" in /digests containing: {{prev}}`), run with a URL input, approve the fetch + write approvals, expand the run history, find the note in Notes.

- [ ] **Step 6: Commit**

```bash
git add src/app/agents/ src/ai/agents/runtime.ts
git commit -m "feat: pipelines tab — builder, manual runs with approvals, history"
```
---

## Milestone D — Automations

### Task 13: automations migration + repo + `computeNextRun`

**Files:**
- Create: `src-tauri/migrations/0005_automations.sql`, `src/db/repo/automations.ts`, `src/ai/automations/schedule.ts`
- Modify: `src-tauri/src/lib.rs`, `src/lib/schemas.ts`
- Test: `src/ai/automations/schedule.test.ts`, `src/db/repo/automations.test.ts`

**Interfaces:**
- Produces (schema): `automationSchema/Automation` — `schedule_kind: "interval"|"daily"|"weekly"`, `interval_minutes`, `time_of_day` ("HH:MM"), `day_of_week` (0=Sun…6=Sat), `input_template`, `permission_level_id`, `output_note_folder`, `enabled`, `next_run_at`, `last_run_at`.
- Produces (repo): `AutomationInput`, `createAutomation(input)` (computes initial `next_run_at`), `updateAutomation(id, input)` (recomputes), `setAutomationEnabled(id, enabled)` (recomputes on enable), `deleteAutomation(id)`, `getAutomation(id)`, `listAutomations()`, `listDueAutomations(nowMs)`, `markRun(id, { nextRunAt, lastRunAt })`.
- Produces (pure): `computeNextRun(a: Automation, from: number): number`.

- [ ] **Step 1: Migration `src-tauri/migrations/0005_automations.sql`**

```sql
-- Scheduled pipeline runs. The scheduler only fires while the app is open
-- (no server process by design); an overdue automation fires once on launch.

CREATE TABLE automations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    schedule_kind TEXT NOT NULL CHECK (schedule_kind IN ('interval', 'daily', 'weekly')),
    interval_minutes INTEGER,
    time_of_day TEXT,
    day_of_week INTEGER,
    input_template TEXT NOT NULL DEFAULT '',
    permission_level_id TEXT REFERENCES permission_levels(id),
    output_note_folder TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    next_run_at INTEGER,
    last_run_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

Register in `src-tauri/src/lib.rs` as version 5, description `"automations"`.

- [ ] **Step 2: Schema in `src/lib/schemas.ts`**

```ts
export const scheduleKindSchema = z.enum(["interval", "daily", "weekly"]);
export type ScheduleKind = z.infer<typeof scheduleKindSchema>;

export const automationSchema = z.object({
    id: z.string(),
    name: z.string(),
    pipeline_id: z.string(),
    schedule_kind: scheduleKindSchema,
    interval_minutes: z.number().nullable(),
    time_of_day: z.string().nullable(),
    day_of_week: z.number().nullable(),
    input_template: z.string(),
    permission_level_id: z.string().nullable(),
    output_note_folder: z.string().nullable(),
    enabled: sqlBool,
    next_run_at: z.number().nullable(),
    last_run_at: z.number().nullable(),
    created_at: z.number(),
    updated_at: z.number(),
});
export type Automation = z.infer<typeof automationSchema>;
```

- [ ] **Step 3: Failing tests for `computeNextRun`**

```ts
// src/ai/automations/schedule.test.ts
import { describe, expect, it } from "vitest";
import type { Automation } from "@/lib/schemas";
import { computeNextRun } from "./schedule";

function auto(overrides: Partial<Automation>): Automation {
    return {
        id: "aut_1",
        name: "A",
        pipeline_id: "pip_1",
        schedule_kind: "interval",
        interval_minutes: null,
        time_of_day: null,
        day_of_week: null,
        input_template: "",
        permission_level_id: null,
        output_note_folder: null,
        enabled: 1,
        next_run_at: null,
        last_run_at: null,
        created_at: 0,
        updated_at: 0,
        ...overrides,
    };
}

describe("computeNextRun", () => {
    it("interval: now + N minutes", () => {
        const from = Date.UTC(2026, 6, 11, 12, 0, 0);
        expect(
            computeNextRun(
                auto({ schedule_kind: "interval", interval_minutes: 30 }),
                from,
            ),
        ).toBe(from + 30 * 60_000);
    });

    it("interval: rejects missing/zero minutes", () => {
        expect(() =>
            computeNextRun(auto({ schedule_kind: "interval" }), 0),
        ).toThrow(/interval_minutes/);
    });

    it("daily: later today if the time is still ahead", () => {
        const from = new Date(2026, 6, 11, 8, 0, 0).getTime(); // local 08:00
        const next = computeNextRun(
            auto({ schedule_kind: "daily", time_of_day: "09:30" }),
            from,
        );
        const d = new Date(next);
        expect([d.getHours(), d.getMinutes(), d.getDate()]).toEqual([9, 30, 11]);
    });

    it("daily: tomorrow if the time already passed", () => {
        const from = new Date(2026, 6, 11, 10, 0, 0).getTime();
        const d = new Date(
            computeNextRun(
                auto({ schedule_kind: "daily", time_of_day: "09:30" }),
                from,
            ),
        );
        expect(d.getDate()).toBe(12);
    });

    it("weekly: next matching weekday at the given time", () => {
        // 2026-07-11 is a Saturday (getDay() === 6).
        const from = new Date(2026, 6, 11, 10, 0, 0).getTime();
        const d = new Date(
            computeNextRun(
                auto({
                    schedule_kind: "weekly",
                    time_of_day: "07:00",
                    day_of_week: 1, // Monday
                }),
                from,
            ),
        );
        expect([d.getDay(), d.getHours(), d.getDate()]).toEqual([1, 7, 13]);
    });

    it("daily: rejects malformed time_of_day", () => {
        expect(() =>
            computeNextRun(
                auto({ schedule_kind: "daily", time_of_day: "9am" }),
                0,
            ),
        ).toThrow(/time_of_day/);
    });
});
```

Run: `npx vitest run src/ai/automations/schedule.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 4: Implement `src/ai/automations/schedule.ts`**

```ts
import type { Automation } from "@/lib/schemas";

/** Next fire time strictly after `from`, in local time (schedules are human-local). */
export function computeNextRun(a: Automation, from: number): number {
    switch (a.schedule_kind) {
        case "interval": {
            if (!a.interval_minutes || a.interval_minutes < 1)
                throw new Error(
                    `interval schedule requires interval_minutes >= 1 (automation ${a.name})`,
                );
            return from + a.interval_minutes * 60_000;
        }
        case "daily":
            return nextAtTime(from, a.time_of_day, null);
        case "weekly":
            return nextAtTime(from, a.time_of_day, a.day_of_week);
    }
}

function nextAtTime(
    from: number,
    timeOfDay: string | null,
    dayOfWeek: number | null,
): number {
    const match = /^(\d{2}):(\d{2})$/.exec(timeOfDay ?? "");
    if (!match)
        throw new Error(`schedule requires time_of_day as HH:MM, got: ${timeOfDay}`);
    const d = new Date(from);
    d.setHours(Number(match[1]), Number(match[2]), 0, 0);
    if (dayOfWeek === null) {
        if (d.getTime() <= from) d.setDate(d.getDate() + 1);
        return d.getTime();
    }
    if (dayOfWeek < 0 || dayOfWeek > 6)
        throw new Error(`day_of_week must be 0-6, got: ${dayOfWeek}`);
    while (d.getDay() !== dayOfWeek || d.getTime() <= from)
        d.setDate(d.getDate() + 1);
    return d.getTime();
}
```

Run: `npx vitest run src/ai/automations/schedule.test.ts` — Expected: PASS.

- [ ] **Step 5: Failing repo tests**

```ts
// src/db/repo/automations.test.ts
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { createPipeline } from "./pipelines";
import {
    createAutomation,
    listAutomations,
    listDueAutomations,
    markRun,
    setAutomationEnabled,
} from "./automations";

let db: ReturnType<typeof createTestDbClient>;

beforeEach(async () => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

async function pipeline() {
    return createPipeline({ name: `P${Math.random()}` });
}

describe("automations repo", () => {
    it("creates with a computed next_run_at", async () => {
        const p = await pipeline();
        const before = Date.now();
        const a = await createAutomation({
            name: "Every hour",
            pipelineId: p.id,
            scheduleKind: "interval",
            intervalMinutes: 60,
            inputTemplate: "",
        });
        expect(a.next_run_at).toBeGreaterThanOrEqual(before + 59 * 60_000);
    });

    it("lists only enabled, due automations", async () => {
        const p = await pipeline();
        const a = await createAutomation({
            name: "Soon",
            pipelineId: p.id,
            scheduleKind: "interval",
            intervalMinutes: 1,
            inputTemplate: "",
        });
        expect(await listDueAutomations(Date.now())).toHaveLength(0);
        expect(
            await listDueAutomations(Date.now() + 2 * 60_000),
        ).toHaveLength(1);

        await setAutomationEnabled(a.id, false);
        expect(
            await listDueAutomations(Date.now() + 2 * 60_000),
        ).toHaveLength(0);
    });

    it("markRun advances the clock", async () => {
        const p = await pipeline();
        const a = await createAutomation({
            name: "M",
            pipelineId: p.id,
            scheduleKind: "interval",
            intervalMinutes: 5,
            inputTemplate: "",
        });
        const t = Date.now() + 10 * 60_000;
        await markRun(a.id, { nextRunAt: t + 5 * 60_000, lastRunAt: t });
        const [row] = await listAutomations();
        expect(row!.last_run_at).toBe(t);
        expect(row!.next_run_at).toBe(t + 5 * 60_000);
    });
});
```

Run: `npx vitest run src/db/repo/automations.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 6: Implement `src/db/repo/automations.ts`**

```ts
import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { automationSchema, type Automation, type ScheduleKind } from "@/lib/schemas";
import { computeNextRun } from "@/ai/automations/schedule";

export interface AutomationInput {
    name: string;
    pipelineId: string;
    scheduleKind: ScheduleKind;
    intervalMinutes?: number | null;
    timeOfDay?: string | null;
    dayOfWeek?: number | null;
    inputTemplate: string;
    permissionLevelId?: string | null;
    outputNoteFolder?: string | null;
}

export async function createAutomation(
    input: AutomationInput,
): Promise<Automation> {
    const id = newId("aut");
    const t = now();
    await getDb().execute(
        `INSERT INTO automations
           (id, name, pipeline_id, schedule_kind, interval_minutes, time_of_day,
            day_of_week, input_template, permission_level_id, output_note_folder,
            enabled, next_run_at, last_run_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, NULL, ?, ?)`,
        [
            id,
            input.name,
            input.pipelineId,
            input.scheduleKind,
            input.intervalMinutes ?? null,
            input.timeOfDay ?? null,
            input.dayOfWeek ?? null,
            input.inputTemplate,
            input.permissionLevelId ?? null,
            input.outputNoteFolder ?? null,
            t,
            t,
        ],
    );
    const created = await getAutomation(id);
    // Validates the schedule too — a bad HH:MM fails here, at save time.
    await getDb().execute(
        "UPDATE automations SET next_run_at = ? WHERE id = ?",
        [computeNextRun(created, t), id],
    );
    return getAutomation(id);
}

export async function updateAutomation(
    id: string,
    input: AutomationInput,
): Promise<Automation> {
    const res = await getDb().execute(
        `UPDATE automations SET
           name = ?, pipeline_id = ?, schedule_kind = ?, interval_minutes = ?,
           time_of_day = ?, day_of_week = ?, input_template = ?,
           permission_level_id = ?, output_note_folder = ?, updated_at = ?
         WHERE id = ?`,
        [
            input.name,
            input.pipelineId,
            input.scheduleKind,
            input.intervalMinutes ?? null,
            input.timeOfDay ?? null,
            input.dayOfWeek ?? null,
            input.inputTemplate,
            input.permissionLevelId ?? null,
            input.outputNoteFolder ?? null,
            now(),
            id,
        ],
    );
    if (res.rowsAffected === 0) throw new Error(`automation not found: ${id}`);
    const updated = await getAutomation(id);
    await getDb().execute(
        "UPDATE automations SET next_run_at = ? WHERE id = ?",
        [computeNextRun(updated, now()), id],
    );
    return getAutomation(id);
}

export async function setAutomationEnabled(
    id: string,
    enabled: boolean,
): Promise<void> {
    const a = await getAutomation(id);
    await getDb().execute(
        "UPDATE automations SET enabled = ?, next_run_at = ?, updated_at = ? WHERE id = ?",
        [
            enabled ? 1 : 0,
            enabled ? computeNextRun(a, now()) : a.next_run_at,
            now(),
            id,
        ],
    );
}

export async function getAutomation(id: string): Promise<Automation> {
    const rows = await getDb().select(
        "SELECT * FROM automations WHERE id = ?",
        [id],
    );
    if (!rows[0]) throw new Error(`automation not found: ${id}`);
    return automationSchema.parse(rows[0]);
}

export async function listAutomations(): Promise<Automation[]> {
    const rows = await getDb().select(
        "SELECT * FROM automations ORDER BY created_at ASC",
    );
    return rows.map((r) => automationSchema.parse(r));
}

export async function deleteAutomation(id: string): Promise<void> {
    await getDb().execute("DELETE FROM automations WHERE id = ?", [id]);
}

export async function listDueAutomations(
    nowMs: number,
): Promise<Automation[]> {
    const rows = await getDb().select(
        `SELECT * FROM automations
         WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?
         ORDER BY next_run_at ASC`,
        [nowMs],
    );
    return rows.map((r) => automationSchema.parse(r));
}

/** Claim a due automation: advance its clock before the (slow) run starts. */
export async function markRun(
    id: string,
    times: { nextRunAt: number; lastRunAt: number },
): Promise<void> {
    await getDb().execute(
        "UPDATE automations SET next_run_at = ?, last_run_at = ?, updated_at = ? WHERE id = ?",
        [times.nextRunAt, times.lastRunAt, now(), id],
    );
}
```

- [ ] **Step 7: Run tests, typecheck, commit**

Run: `npm test && npm run typecheck` — Expected: PASS/clean.

```bash
git add src-tauri/migrations/0005_automations.sql src-tauri/src/lib.rs src/lib/schemas.ts src/db/repo/automations.ts src/db/repo/automations.test.ts src/ai/automations/
git commit -m "feat: automations schema, repo, and schedule math"
```

### Task 14: headless run + scheduler

**Files:**
- Create: `src/ai/automations/run.ts`, `src/ai/automations/scheduler.ts`
- Test: `src/ai/automations/scheduler.test.ts`

**Interfaces:**
- Consumes: automations repo (Task 13), `runPipeline` (Task 11), `buildPipelineRuntime` (Task 12), `renderTemplate`, `createNote`, `listGrants` + `toScopedGrant`, `PermissionContext`.
- Produces: `createAutoDenyPermissions(levelId: string | null): Promise<PermissionContext>`; `runAutomation(a: Automation, deps: { settings: Settings; fetch: typeof globalThis.fetch }): Promise<void>`; `startAutomationScheduler(deps: { settings: Settings; fetch: typeof globalThis.fetch; tickMs?: number; run?: (a: Automation) => Promise<void> }): () => void` (returns stop; `run` injectable for tests/UI "run now").

- [ ] **Step 1: Implement `src/ai/automations/run.ts`** (write first — the scheduler test injects a fake `run`, so this file is exercised manually + via its parts' own tests)

```ts
import { listGrants } from "@/db/repo/permissions";
import { toScopedGrant } from "@/ai/permissions/engine";
import { PermissionContext } from "@/ai/tools/context";
import { buildPipelineRuntime } from "@/ai/agents/runtime";
import { runPipeline } from "@/ai/pipelines/runner";
import { renderTemplate } from "@/lib/template";
import { createNote } from "@/db/repo/notes";
import type { Settings } from "@/ai/providers/keys";
import type { Automation } from "@/lib/schemas";

/**
 * Permissions for unattended runs: the chosen level's grants apply, and
 * anything outside them is denied immediately — nobody is watching to
 * approve, and a paused broker would hang the scheduler forever.
 */
export async function createAutoDenyPermissions(
    levelId: string | null,
): Promise<PermissionContext> {
    const permissions = new PermissionContext();
    if (levelId) {
        const grants = await listGrants(levelId);
        permissions.levelGrants = grants.map(toScopedGrant);
    }
    permissions.broker.subscribe((pending) => {
        for (const req of pending) permissions.broker.respond(req.id, "deny");
    });
    return permissions;
}

/** One unattended automation run; optionally files the result as a note. */
export async function runAutomation(
    a: Automation,
    deps: { settings: Settings; fetch: typeof globalThis.fetch },
): Promise<void> {
    const permissions = await createAutoDenyPermissions(a.permission_level_id);
    const runtime = buildPipelineRuntime({
        settings: deps.settings,
        fetch: deps.fetch,
        permissions,
    });
    const input = renderTemplate(a.input_template, {
        date: new Date().toISOString().slice(0, 10),
    });
    const result = await runPipeline({
        pipelineId: a.pipeline_id,
        input,
        runtime,
        automationId: a.id,
    });
    if (a.output_note_folder && result.status === "success") {
        await createNote({
            title: `${a.name} — ${new Date().toLocaleString()}`,
            folder: a.output_note_folder,
            bodyMd: result.finalOutput,
        });
    }
}
```

- [ ] **Step 2: Write the failing scheduler test**

```ts
// src/ai/automations/scheduler.test.ts
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { createPipeline } from "@/db/repo/pipelines";
import {
    createAutomation,
    getAutomation,
    listDueAutomations,
} from "@/db/repo/automations";
import { DEFAULT_SETTINGS } from "@/ai/providers/keys";
import { startAutomationScheduler } from "./scheduler";
import type { Automation } from "@/lib/schemas";

let db: ReturnType<typeof createTestDbClient>;

beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => {
    db.close();
    vi.useRealTimers();
});

describe("automation scheduler", () => {
    it("claims due automations exactly once and reschedules", async () => {
        const p = await createPipeline({ name: "P" });
        const a = await createAutomation({
            name: "Every minute",
            pipelineId: p.id,
            scheduleKind: "interval",
            intervalMinutes: 1,
            inputTemplate: "",
        });
        // Force it due now.
        const { markRun } = await import("@/db/repo/automations");
        await markRun(a.id, { nextRunAt: Date.now() - 1000, lastRunAt: 0 });

        const ran: string[] = [];
        const stop = startAutomationScheduler({
            settings: DEFAULT_SETTINGS,
            fetch: async () => new Response("stub"),
            tickMs: 5,
            run: async (auto: Automation) => {
                ran.push(auto.id);
            },
        });
        // The scheduler ticks immediately; give the async tick a beat.
        await vi.waitFor(() => expect(ran).toEqual([a.id]));
        stop();

        const after = await getAutomation(a.id);
        expect(after.next_run_at).toBeGreaterThan(Date.now());
        expect(await listDueAutomations(Date.now())).toHaveLength(0);
    });

    it("keeps ticking when a run throws", async () => {
        const p = await createPipeline({ name: "P2" });
        const a = await createAutomation({
            name: "Flaky",
            pipelineId: p.id,
            scheduleKind: "interval",
            intervalMinutes: 1,
            inputTemplate: "",
        });
        const { markRun } = await import("@/db/repo/automations");
        await markRun(a.id, { nextRunAt: Date.now() - 1000, lastRunAt: 0 });

        const stop = startAutomationScheduler({
            settings: DEFAULT_SETTINGS,
            fetch: async () => new Response("stub"),
            tickMs: 5,
            run: async () => {
                throw new Error("boom");
            },
        });
        await vi.waitFor(async () =>
            expect((await getAutomation(a.id)).next_run_at).toBeGreaterThan(
                Date.now(),
            ),
        );
        stop(); // no unhandled rejection = pass
    });
});
```

Run: `npx vitest run src/ai/automations/scheduler.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/ai/automations/scheduler.ts`**

```ts
import {
    listDueAutomations,
    markRun,
} from "@/db/repo/automations";
import { computeNextRun } from "./schedule";
import { runAutomation } from "./run";
import type { Settings } from "@/ai/providers/keys";
import type { Automation } from "@/lib/schemas";

/**
 * Fires due automations while the app is open. Claims (advances next_run_at)
 * BEFORE running so a slow run can never double-fire; failures log and the
 * loop keeps going. Returns a stop function.
 */
export function startAutomationScheduler(deps: {
    settings: Settings;
    fetch: typeof globalThis.fetch;
    tickMs?: number;
    /** Injectable for tests; defaults to the real headless run. */
    run?: (a: Automation) => Promise<void>;
}): () => void {
    const run =
        deps.run ??
        ((a: Automation) =>
            runAutomation(a, { settings: deps.settings, fetch: deps.fetch }));
    let ticking = false;

    const tick = async () => {
        if (ticking) return; // a long run outlasted the interval — skip
        ticking = true;
        try {
            const due = await listDueAutomations(Date.now());
            for (const a of due) {
                const t = Date.now();
                await markRun(a.id, {
                    nextRunAt: computeNextRun(a, t),
                    lastRunAt: t,
                });
                try {
                    await run(a);
                } catch (e) {
                    console.error(`automation "${a.name}" failed:`, e);
                }
            }
        } finally {
            ticking = false;
        }
    };

    const id = setInterval(() => void tick(), deps.tickMs ?? 30_000);
    void tick(); // catch up on launch (overdue automations fire once)
    return () => clearInterval(id);
}
```

- [ ] **Step 4: Run tests, typecheck, commit**

Run: `npx vitest run src/ai/automations/scheduler.test.ts && npm test && npm run typecheck` — Expected: PASS/clean.

```bash
git add src/ai/automations/
git commit -m "feat: headless automation runs + claim-first scheduler"
```

### Task 15: Automations tab UI + scheduler wiring

**Files:**
- Create: `src/app/agents/AutomationsTab.tsx`
- Modify: `src/app/agents/AgentsPage.tsx` (replace `AutomationsPlaceholder`), `src/App.tsx` (start/stop the scheduler)

**Interfaces:**
- Consumes: automations repo, pipelines repo (`listPipelines`, `listRuns`), `runAutomation`, `startAutomationScheduler`, `appFetch`, `useRuntime()`, `RunHistory` (Task 12), permission levels.
- Produces: `AutomationsTab()` — terminal consumer.

- [ ] **Step 1: Start the scheduler in `src/App.tsx`**

Add imports:

```tsx
import { startAutomationScheduler } from "@/ai/automations/scheduler";
import { appFetch } from "@/ai/providers/appFetch";
```

Add an effect after the boot effect (settings-keyed so key changes rebuild it):

```tsx
useEffect(() => {
    if (!boot || !settings) return;
    return startAutomationScheduler({ settings, fetch: appFetch });
}, [boot, settings]);
```

- [ ] **Step 2: Create `src/app/agents/AutomationsTab.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { Pencil, Play, Plus, Trash2 } from "lucide-react";
import * as automationsRepo from "@/db/repo/automations";
import { listPipelines, listRuns } from "@/db/repo/pipelines";
import { listLevels } from "@/db/repo/permissions";
import { runAutomation } from "@/ai/automations/run";
import { appFetch } from "@/ai/providers/appFetch";
import { useRuntime } from "@/app/runtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
    Automation,
    PermissionLevel,
    Pipeline,
    PipelineRun,
    ScheduleKind,
} from "@/lib/schemas";
import { RunHistory } from "./RunHistory";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AutomationsTab() {
    const { settings } = useRuntime();
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [levels, setLevels] = useState<PermissionLevel[]>([]);
    const [editing, setEditing] = useState<Automation | "new" | null>(null);
    const [runsFor, setRunsFor] = useState<string | null>(null);
    const [runs, setRuns] = useState<PipelineRun[]>([]);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setAutomations(await automationsRepo.listAutomations());
        setPipelines(await listPipelines());
        setLevels(await listLevels());
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);

    const showRuns = async (a: Automation) => {
        setRunsFor(a.id);
        setRuns(await listRuns({ automationId: a.id }));
    };

    const runNow = async (a: Automation) => {
        setBusy(a.id);
        setError(null);
        try {
            // Same headless semantics as a scheduled fire: out-of-level denies.
            await runAutomation(a, { settings, fetch: appFetch });
            await showRuns(a);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(null);
        }
    };

    const pipelineName = (id: string) =>
        pipelines.find((p) => p.id === id)?.name ?? id;

    return (
        <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
                Automations fire while the app is open; anything outside the
                chosen permission level is denied — no approval cards, no
                surprises. Overdue schedules catch up once at launch.
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}

            {automations.map((a) => (
                <Card key={a.id}>
                    <CardHeader className="flex-row items-center gap-2">
                        <div className="flex-1">
                            <CardTitle>{a.name}</CardTitle>
                            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                {pipelineName(a.pipeline_id)} ·{" "}
                                {describeSchedule(a)} · next{" "}
                                {a.next_run_at
                                    ? new Date(a.next_run_at).toLocaleString()
                                    : "—"}
                                {a.last_run_at
                                    ? ` · last ${new Date(a.last_run_at).toLocaleString()}`
                                    : ""}
                            </p>
                        </div>
                        <Badge tone={a.enabled ? "success" : "neutral"}>
                            {a.enabled ? "enabled" : "paused"}
                        </Badge>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                void automationsRepo
                                    .setAutomationEnabled(a.id, !a.enabled)
                                    .then(reload)
                            }
                        >
                            {a.enabled ? "Pause" : "Enable"}
                        </Button>
                        <Button
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => void runNow(a)}
                        >
                            <Play className="mr-1 h-3.5 w-3.5" />
                            {busy === a.id ? "Running…" : "Run now"}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${a.name}`}
                            onClick={() => setEditing(a)}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${a.name}`}
                            onClick={() =>
                                void automationsRepo
                                    .deleteAutomation(a.id)
                                    .then(reload)
                            }
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        <button
                            className="cursor-pointer self-start font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                            onClick={() =>
                                runsFor === a.id
                                    ? setRunsFor(null)
                                    : void showRuns(a)
                            }
                        >
                            {runsFor === a.id ? "hide runs" : "show runs"}
                        </button>
                        {runsFor === a.id && <RunHistory runs={runs} />}
                    </CardContent>
                </Card>
            ))}

            {editing ? (
                <AutomationEditor
                    automation={editing === "new" ? null : editing}
                    pipelines={pipelines}
                    levels={levels}
                    onDone={async () => {
                        setEditing(null);
                        await reload();
                    }}
                />
            ) : (
                <Button className="self-start" onClick={() => setEditing("new")}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> New automation
                </Button>
            )}
        </div>
    );
}

function describeSchedule(a: Automation): string {
    switch (a.schedule_kind) {
        case "interval":
            return `every ${a.interval_minutes} min`;
        case "daily":
            return `daily ${a.time_of_day}`;
        case "weekly":
            return `${DAYS[a.day_of_week ?? 0]} ${a.time_of_day}`;
    }
}

function AutomationEditor({
    automation,
    pipelines,
    levels,
    onDone,
}: {
    automation: Automation | null;
    pipelines: Pipeline[];
    levels: PermissionLevel[];
    onDone: () => Promise<void>;
}) {
    const [form, setForm] = useState<automationsRepo.AutomationInput>(() =>
        automation
            ? {
                  name: automation.name,
                  pipelineId: automation.pipeline_id,
                  scheduleKind: automation.schedule_kind,
                  intervalMinutes: automation.interval_minutes,
                  timeOfDay: automation.time_of_day,
                  dayOfWeek: automation.day_of_week,
                  inputTemplate: automation.input_template,
                  permissionLevelId: automation.permission_level_id,
                  outputNoteFolder: automation.output_note_folder,
              }
            : {
                  name: "",
                  pipelineId: "",
                  scheduleKind: "daily",
                  intervalMinutes: null,
                  timeOfDay: "09:00",
                  dayOfWeek: null,
                  inputTemplate: "",
                  permissionLevelId: null,
                  outputNoteFolder: "/automations",
              },
    );
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        setError(null);
        try {
            if (!form.pipelineId)
                throw new Error("pick a pipeline for this automation");
            if (automation)
                await automationsRepo.updateAutomation(automation.id, form);
            else await automationsRepo.createAutomation(form);
            await onDone();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    {automation ? `Edit ${automation.name}` : "New automation"}
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <div className="flex gap-3">
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Name
                        <Input
                            value={form.name}
                            onChange={(e) =>
                                setForm({ ...form, name: e.target.value })
                            }
                        />
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Pipeline
                        <Select
                            value={form.pipelineId}
                            onChange={(e) =>
                                setForm({ ...form, pipelineId: e.target.value })
                            }
                        >
                            <option value="">Select pipeline…</option>
                            {pipelines.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </Select>
                    </label>
                </div>
                <div className="flex gap-3">
                    <label className="flex w-36 flex-col gap-1 text-sm">
                        Schedule
                        <Select
                            value={form.scheduleKind}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    scheduleKind: e.target
                                        .value as ScheduleKind,
                                })
                            }
                        >
                            <option value="interval">Interval</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                        </Select>
                    </label>
                    {form.scheduleKind === "interval" && (
                        <label className="flex w-36 flex-col gap-1 text-sm">
                            Every N minutes
                            <Input
                                type="number"
                                min={1}
                                value={form.intervalMinutes ?? ""}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        intervalMinutes: e.target.value
                                            ? Number(e.target.value)
                                            : null,
                                    })
                                }
                            />
                        </label>
                    )}
                    {form.scheduleKind !== "interval" && (
                        <label className="flex w-32 flex-col gap-1 text-sm">
                            Time (HH:MM)
                            <Input
                                value={form.timeOfDay ?? ""}
                                placeholder="09:00"
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        timeOfDay: e.target.value || null,
                                    })
                                }
                            />
                        </label>
                    )}
                    {form.scheduleKind === "weekly" && (
                        <label className="flex w-32 flex-col gap-1 text-sm">
                            Day
                            <Select
                                value={String(form.dayOfWeek ?? 1)}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        dayOfWeek: Number(e.target.value),
                                    })
                                }
                            >
                                {DAYS.map((d, i) => (
                                    <option key={d} value={i}>
                                        {d}
                                    </option>
                                ))}
                            </Select>
                        </label>
                    )}
                </div>
                <label className="flex flex-col gap-1 text-sm">
                    Input template ({"{{date}}"} available)
                    <Input
                        value={form.inputTemplate}
                        placeholder="e.g. Summarize https://news.ycombinator.com for {{date}}"
                        onChange={(e) =>
                            setForm({ ...form, inputTemplate: e.target.value })
                        }
                    />
                </label>
                <div className="flex gap-3">
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Permission level (out-of-level calls are denied)
                        <Select
                            value={form.permissionLevelId ?? ""}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    permissionLevelId: e.target.value || null,
                                })
                            }
                        >
                            <option value="">None (deny all tool calls)</option>
                            {levels.map((l) => (
                                <option key={l.id} value={l.id}>
                                    {l.name}
                                </option>
                            ))}
                        </Select>
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Save output as note in folder (blank = don't)
                        <Input
                            value={form.outputNoteFolder ?? ""}
                            placeholder="/automations"
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    outputNoteFolder: e.target.value || null,
                                })
                            }
                        />
                    </label>
                </div>
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

- [ ] **Step 3: Wire into `AgentsPage.tsx`**

Replace `AutomationsPlaceholder` with `<AutomationsTab />`; delete the placeholder; add the import.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm test` — Expected: clean.
Manual: create an automation on the digest pipeline with a permission level that grants `fetch_url` for the target domain and `write_note` for `/digests`, interval = 1 minute, enable it, wait ≤90s → a run appears in history and a note lands in `/digests`; remove the level → next run's history shows the denial-degraded output. Pause stops firing.

- [ ] **Step 5: Commit**

```bash
git add src/app/agents/ src/App.tsx
git commit -m "feat: automations tab + scheduler wiring"
```

---

## Final end-to-end verification (after Task 15)

1. `npm test && npm run typecheck` — everything green.
2. `npm run eval` (needs a configured Gemini key or Ollama) — router eval still ≥85%.
3. Fresh-profile launch (delete dev `dashboard.db` or use a clean browser profile): migrations 1–5 apply, builtin agents/presets/levels seed, chat + Study preset delegate as before.
4. **Existing-profile launch** (the important one): pre-upgrade presets keep their agents — migration 0003 rewrote `"knowledge"` → `"agt_knowledge"`.
5. The career loop demo: create a "Job scout" agent (fetch_url), a pipeline "scan postings → summarize → write_note to /career", an automation daily 09:00 with a level granting exactly those scopes. Next morning, ask the Study preset "what did my job scout find?" — the knowledge agent reads the note.

## Execution handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task with review between tasks (superpowers:subagent-driven-development).
2. **Inline Execution** — execute task-by-task in one session with checkpoints (superpowers:executing-plans).
