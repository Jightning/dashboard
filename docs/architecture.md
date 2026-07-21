# Architecture

One person, one machine, zero dollars. Everything follows from that: a local-first
app, a single SQLite database, and free/MIT dependencies only. No server process to
run, no subscriptions. There are **two build targets from one TypeScript codebase**:
the primary Tauri desktop app, and a static web build (per-browser database) for
hosted deployments — see `docs/hosting.md` for the latter's deploy story.

## System overview

```txt
        ┌─────────────────────────────────────────────────────────────────┐
        │  Shared TypeScript core (all logic lives here)                  │
        │   ├─ React SPA — Shell, sidebar pages (home/agents/categories/  │
        │   │   notes/planner/presets/permissions/settings), ⌘K palette   │
        │   ├─ AI OS                                                      │
        │   │   ├─ provider registry (Gemini/Anthropic/OpenAI/Ollama)     │
        │   │   ├─ orchestrator ──► DB-defined specialist agents          │
        │   │   ├─ tool catalog (17 gated tools, 6 groups)                │
        │   │   ├─ permission engine + unattended-run preflight           │
        │   │   ├─ context presets, token tracking, compaction            │
        │   │   └─ pipelines ──► automations (in-app scheduler)           │
        │   └─ repos (typed SQL) ──► DbClient interface                   │
        └───────┬──────────────────────────────────┬──────────────────────┘
                │ Tauri IPC                        │ postMessage RPC
   ┌────────────▼─────────────────┐   ┌────────────▼─────────────────────┐
   │ DESKTOP — Tauri 2 (thin Rust)│   │ WEB — static SPA (CF Pages etc.) │
   │  plugin-sql ► SQLite + FTS5  │   │  Worker: sqlite-wasm + OPFS      │
   │  plugin-http ► provider calls│   │  (FTS5 included; COOP/COEP via   │
   │  plugin-fs ► attachments dir │   │   public/_headers)               │
   │  plugin-store ► API keys     │   │  localStorage ► settings/keys    │
   │  migrations run in Rust      │   │  functions/__proxy.ts ► web tools│
   └──────────────┬───────────────┘   └────────────┬─────────────────────┘
                  │ outbound only, per-request, BYOK│
                  ▼                                 ▼
          Gemini free tier / Anthropic / OpenAI APIs
          Ollama (localhost:11434, connection-tested, live model list)
```

Why this shape:

- **Tauri 2, not Electron.** ~10MB installers, MIT, and official iOS/Android targets —
  the later mobile port reuses this codebase instead of requiring a rewrite.
- **No Node sidecar, no second process.** All application logic is TypeScript in the
  webview; the Rust shell only registers official plugins and holds the migration
  list (`src-tauri/src/lib.rs`).
- **Everything behind two small interfaces.** `DbClient` (`src/db/client.ts`) and
  `SettingsStore` (`src/ai/providers/keys.ts`) each have a desktop and a web
  implementation; no other module knows which target it's running on.
- **Provider calls escape CORS per target.** Desktop injects a `fetch` built on
  `tauri-plugin-http` (requests exit via Rust) into every AI SDK provider factory;
  capabilities whitelist exactly the provider hosts. The browser build calls
  providers directly (they send CORS headers) but routes *web-tool* fetches of
  arbitrary sites through `/__proxy?url=` — a Vite middleware in dev/preview
  (`vite.config.ts`) and a Cloudflare Pages Function in production
  (`functions/__proxy.ts`).

## Boot sequence

`App.tsx` → `bootstrap()` (`src/app/bootstrap.ts`), memoized as a singleton promise
(React 19 StrictMode double-invokes effects; the web target's OPFS VFS rejects a
second concurrent open):

1. Pick the DB client by `isTauri()`: `tauriClient.ts` (plugin-sql) or
   `webClient.ts` (a postMessage RPC proxy to `webClient.worker.ts`, where
   sqlite-wasm runs — OPFS is Worker-only). FTS5 availability is verified;
   the app fails fast rather than silently degrading.
2. Migrations: desktop runs them in Rust before the webview loads (plugin-sql's
   versioned list). The web target applies the same `src-tauri/migrations/*.sql`
   files itself via `src/db/migrationPlan.ts`, which also handles the one-time
   adoption of pre-tracking databases (record-don't-rerun when a migration's
   tables already exist).
3. Pick the settings store: plugin-store JSON (desktop) or localStorage (web).
4. Idempotent seeds: built-in permission levels, built-in agents, built-in presets.
5. One-time FTS backfill for chat messages written before migration 0012.
6. `RuntimeContext` (`src/app/runtime.tsx`) exposes `{settingsStore, settings,
   refreshSettings}` app-wide; `App.tsx` then starts the automation scheduler.

`Shell.tsx` composes the chrome: sidebar nav (wordmark "HUGH"), `GridBackground`,
StatusBar (live due-today/next-automation readouts, model chip → Settings), page
transitions, and restores/persists nav position (page, tab, open chat, project)
plus per-session composer drafts to localStorage under versioned `hugh.*` keys.
Drafts are bounded (`src/lib/drafts.ts`): 8k chars each, 14-day TTL, 20 sessions
max, LRU-pruned.

## Repo layout

```txt
src/
  app/            Shell.tsx, Sidebar.tsx, runtime.tsx, bootstrap.ts + sections:
                    home/        HomePage
                    agents/      AgentsPage (chat + roster tabs), AgentEditor,
                                 AgentTestBench, PipelinesTab, AutomationsTab,
                                 TemplateEditor, RunHistory
                    chat/        ChatWorkspace, InstancesSidebar (exo ring)
                    categories/  CategoriesPage, CategoryDetail
                                 (Projects | Chats | Tasks | Notes tabs)
                    projects/    ProjectDetail (files: upload or paste-as-text)
                    notes/       NotesPage, ReviewTab (flashcards),
                                 BookmarksTab, SnippetsTab
                    planner/     PlannerPage, TasksTab, CalendarTab
                                 (1d hourly/7d/14d/month), ApplicationsTab,
                                 calendarItems.ts
                    presets/     PresetsPage
                    permissions/ PermissionsPage
                    settings/    SettingsPage (keys, Ollama test-connection +
                                 live model list, per-day/per-model usage)
  components/     ui/ (shadcn-style primitives: button, card, input, select,
                  tabs, badge, meter, filterChips), chat/ (MessageList,
                  Composer, ApprovalCard, TokenMeter), hud/ (NeuralCore,
                  NetworkSphere + networkData/sphere, AgentConstellation,
                  AgentNode, GridBackground, StatusBar, StubPanel, Typewriter),
                  palette/ (CommandPalette), PermissionLevelSelect
  ai/
    providers/    registry.ts (Gemini/Anthropic/OpenAI/Ollama), keys.ts
                  (SettingsStore, both impls), tauriFetch.ts, appFetch.ts
                  (wrapWebFetch → /__proxy on web)
    agents/       orchestrator.ts, factory.ts (DB def → ToolLoopAgent),
                  runtime.ts (buildSessionAgent, buildPipelineRuntime,
                  applyPermissionLevel, createSummarizer), types.ts
    tools/        catalog.ts (TOOL_CATALOG + buildToolSet), documents.ts,
                  notes.ts, web.ts, tasks.ts, applications.ts, flashcards.ts,
                  context.ts (PermissionContext)
    permissions/  engine.ts, broker.ts, preflight.ts (ungranted-tool check
                  for unattended runs), types.ts
    pipelines/    runner.ts, templates.ts
    automations/  schedule.ts (next-run math), scheduler.ts (in-app loop),
                  run.ts (headless pipeline execution)
    chat/         transport.ts (client-side ChatTransport for useChat),
                  metadata.ts (router-model auto title/summary/tags)
    context/      tokens.ts, compaction.ts
    multimodal/   image.ts, pdf.ts (unpdf), stt.ts (Gemini audio)
    notes/        flashcardGen.ts
  db/             client.ts (DbClient interface), tauriClient.ts,
                  webClient.ts + webClient.worker.ts (sqlite-wasm/OPFS),
                  testClient.ts (vitest only), migrationPlan.ts,
                  repo/ (agents, applications, automations, categories,
                  courses, documents, events, flashcards, library, messages,
                  notes, permissions, pipelines, presets, projects, semester,
                  sessions, tasks, usage)
  lib/            ids.ts, utils.ts, schemas.ts (zod), drafts.ts, astro.ts, env.ts
functions/        __proxy.ts — Cloudflare Pages Function (production proxy)
public/           _headers — COOP/COEP for OPFS (web target)
src-tauri/        Cargo.toml, tauri.conf.json, capabilities/, src/lib.rs
                  (13 versioned migrations), migrations/*.sql
evals/            router/tools/permissions/compaction .eval.ts, fixtures.ts,
                  models.ts, scorers.ts
docs/             idea.md, architecture.md, design.md, hosting.md, todo.md
```

## Stack and why each piece is free

| Piece | Choice | License / cost | Why |
| --- | --- | --- | --- |
| Desktop shell | Tauri 2 | MIT/Apache-2.0 | Tiny binaries; webview UI; official mobile targets for the later port |
| Web DB | `@sqlite.org/sqlite-wasm` + OPFS | Public domain | Same SQL + FTS5 in the browser; per-browser persistence |
| Frontend | Vite + React 19 + TS | MIT | Existing React strength; fast dev loop |
| UI | Tailwind CSS v4 + shadcn-style primitives (cva/cmdk/lucide/motion) | MIT | Accessible primitives; CSS-variable tokens (see `docs/design.md`) |
| DB (desktop) | SQLite via tauri-plugin-sql + FTS5 | MIT | Single-file DB in app-data; trivial backup |
| AI | Vercel AI SDK (`ai` v7) | Apache-2.0 | Provider-agnostic streaming, tool calls, `ToolLoopAgent` |
| AI cloud | `@ai-sdk/google` (Gemini free tier), `@ai-sdk/anthropic`, `@ai-sdk/openai` (BYOK) | free tier / BYOK | $0 cloud option today; paid keys optional, never required |
| AI local | `ai-sdk-ollama` | MIT | Local models over localhost:11434; connection test + live model list in Settings |
| Calendar import | `ical.js` | MPL-2.0 | Purdue/Brightspace ICS exports |
| PDF | `unpdf` | MIT | Browser-safe text extraction, no native deps |
| Markdown | `marked` | MIT | Message/note rendering |
| Key storage | tauri-plugin-store (desktop) / localStorage (web) | MIT | See Tradeoffs |
| Evals | evalite | MIT | TypeScript-native, vitest-based; runs on Gemini free/Ollama at $0 |
| Tests | vitest + better-sqlite3 (dev-only test double) | MIT | Deterministic CI-safe tests incl. real FTS5 |

## The AI OS

The differentiator. Five pillars — multi-agent workflow, multimodal input, context
presets, token optimization, evals — all behind a permission system with **no
silent data access**.

### Agents are data, not code

Migration 0003 moved agents into the DB: `agents(id, name, description,
instructions, tools_json, model, max_steps, color, is_builtin)`. Built-ins
`agt_knowledge` (document retrieval) and `agt_research` (`search_web` +
`fetch_url`) are seeded idempotently; users create, edit, and test their own in
the Agents roster (`AgentEditor`, `AgentTestBench`). `factory.ts` instantiates any
definition as an AI SDK `ToolLoopAgent`: instructions as system prompt, its
catalog tool subset, the preset's main model unless the definition overrides,
`stopWhen: stepCountIs(max_steps)`.

- **Orchestrator** (`orchestrator.ts`) — runs on the preset's `router_model`
  (cheap: Gemini Flash or a small Ollama model). Sees the session's enabled
  agents as `ask_<agent>` tools plus the option to answer directly. Quick Q&A
  costs zero delegation.
- **Research on the web** — `search_web` (DuckDuckGo HTML endpoint, no key, $0)
  and `fetch_url` (HTML→text, size-capped), both permission-scoped by domain.
  Desktop reaches them through plugin-http; the browser build has no CORS escape
  hatch, so `wrapWebFetch` (`appFetch.ts`) rewrites web-tool requests through the
  `/__proxy` middleware/function.

Every agent runs its own tool loop; results return to the orchestrator as tool
results. All tool execution funnels through the permission engine.

### Tool catalog

`src/ai/tools/catalog.ts` is the single registry — 17 gated tools in 6 groups,
each with UI metadata (label, read/write) used by the agent editor and the
permissions page:

```txt
documents  search_documents · read_document · list_documents            (read)
notes      search_notes · read_note · list_notes (read) · write_note    (write)
web        search_web · fetch_url                                       (read)
tasks      list_tasks · list_events (read) · create_task · complete_task (write)
career     list_applications (read) · create_application ·
           update_application_status                                    (write)
study      create_flashcards                                            (write)
```

Adding a tool module = spread its factory into `buildToolSet` and list its
entries in `TOOL_CATALOG`. Unknown grants fail fast.

### Permission model — levels, scoped grants, approval cards

Hard rule: the AI never touches data without a permission the user chose.
Multi-agent flows fire many tool calls per request, so per-call approval for
everything would be unusable. The resolution is **permission levels** — named
bundles of scoped grants selected per session from the chat header.

```txt
grant  = (tool, access: read|write, scope_type: any|doc_folder|url_domain, scope_value)
level  = named set of grants          e.g. "Study" = read documents in /school
session.permission_level  = user-selected, switchable mid-session; NULL = ask everything
```

Decision order for every tool call:

```txt
1. grant in active level matches (tool, access, scope)  ──► auto-allow, log it
2. ephemeral session grant from a prior "allow for session" ──► allow
3. otherwise ──► pause; ApprovalCard renders (tool + args + resolved scope)
       allow once │ allow for session │ deny
   deny ──► structured {denied, reason} tool result; model answers without the data
```

- Each tool declares a `scopeOf(args)` extractor: `read_document` resolves the
  document's folder, `fetch_url` the hostname. Grants match on scope prefix
  (folders) or exact domain.
- Built-in levels: **Read documents** (read-only, any folder) and **Reads only**
  (every read tool in the catalog auto-allowed, any scope; writes still ask).
  "Ask everything" is no longer a row — migration 0010 collapsed it into
  `permission_level_id = NULL`, the default. Custom levels are created in the
  permissions page; write grants are never part of built-ins.
- **Unattended runs get a preflight** (`preflight.ts`): pipelines and automations
  run headless, where an approval card would hang forever — gated tools their
  agents use but the chosen level doesn't grant are auto-denied at runtime, and
  `ungrantedTools()` surfaces exactly that list in the editor before the user
  saves or manually runs.
- Mechanics: the engine is pure TypeScript, UI-independent, unit-tested as a
  decision table; the transport pauses/resumes gated calls via the broker.

### Context presets

A preset binds everything a session needs:

```txt
preset = { system_prompt, provider+model, router_model, enabled_agents,
           permission_level, token_budget, compaction_threshold }
```

Seeded defaults: **Quick Q&A** (no agents/tools, cheap model, small budget),
**Study** (knowledge agent, "Read documents" level), **Research** (knowledge +
research agents). Presets are DB rows with full CRUD; a picker applies one at
session creation and the session can override the permission level afterward.

### Pipelines and automations

- **Pipelines** — ordered steps of (agent, prompt template); templates can splice
  the previous step's output. Runs and per-step runs are recorded
  (`pipeline_runs`, `pipeline_step_runs`) and browsable in `RunHistory`.
- **Automations** — schedule a pipeline: `interval` / `daily` / `weekly`, with an
  input template, an optional permission level for the unattended run, and an
  optional output note folder (results land as notes). `scheduler.ts` ticks
  while the app is open and **claims before running** (advances `next_run_at`
  first) so a slow run can never double-fire; failures log and the loop
  continues. StatusBar shows the next due automation.

### Token optimization

1. **Model routing** — the orchestrator runs on the cheap `router_model`; only
   specialist work uses the preset's main model.
2. **Real usage accounting** — every result's usage lands on the message row
   (input/output/cached tokens). A TokenMeter shows session totals against the
   preset's `token_budget`.
3. **Per-day visibility** — `usage.ts` aggregates tokens per day per model
   (14-day window); Settings renders it with free-tier guidance so the user
   sees when the Gemini free tier will bite.
4. **Compaction** — before each send, if estimated context (stored usage +
   chars/4 for unsent parts) exceeds `compaction_threshold`, all but the last 6
   messages are summarized by the router model into
   `chat_sessions.compaction_summary`, marked `compacted=1`, and context is
   rebuilt as `[system, summary, recent]`.
5. **Provider prompt caching** — on Anthropic, `cacheControl` providerOptions on
   the stable prefix (system + tools), rendered first so caching actually hits.
6. **Retrieval, not stuffing** — documents live in SQLite + FTS5 and reach the
   model through `search_documents`, never inlined wholesale. Project files
   (uploaded or pasted as plain text in the projects UI) enter chats only
   through these retrieval tools.

### Chat metadata

After a session's first exchanges, `metadata.ts` has the router model generate a
title (when still default), a one-line `auto_summary`, and `auto_tags_json` —
cheap, local-data-only metadata that powers the instances sidebar, the category
drill-ins, and `messages_fts` search. The chat workspace's `InstancesSidebar`
plus the `NetworkSphere`'s exo ring keep every session reachable: recent chats
orbit as pull-in layers, and the inner sphere fades on zoom-out.

### Multimodal

- **Images** — paste/drop into the composer → saved under
  `appData/attachments/` via plugin-fs → AI SDK image part on the user message.
  The registry flags vision-capable models (Gemini, Claude, GPT-4o+, llava).
- **PDFs** — drop → `unpdf` extracts text in the webview → `documents` row
  (+FTS via triggers) + attachment record; agents reach content through
  retrieval. Small PDFs may additionally attach as a file part for direct
  vision-model reading.
- **Voice input (STT)** — WebView2 has no Web Speech `SpeechRecognition`:
  MediaRecorder captures webm/opus → sent as a file part to Gemini free tier
  with a transcription prompt → text lands in the composer. Isolated so its
  failure blocks nothing. TTS is out of scope for v1.

### Evals

Two layers, strictly separated:

- **Deterministic unit tests** (vitest, CI-safe, no network): permission-engine
  decision table, compaction math, migration planning, repos against real
  SQLite (better-sqlite3 with FTS5), transport persistence, scheduler
  claim-before-run, agent loops driven by `MockLanguageModelV2` from `ai/test`.
- **Live-model evals** (evalite, local, $0 on Gemini free tier or Ollama; skip
  cleanly when no model is configured): `router.eval.ts` (~20 prompts → expected
  route; **regression gate ≥85%** before any model/prompt change ships),
  `tools.eval.ts` (planted facts appear in retrieval answers),
  `permissions.eval.ts` (out-of-scope temptations blocked AND the answer
  degrades gracefully), `compaction.eval.ts` (key facts survive summarization).

## Dashboard sections

Beyond the AI OS, the shell's pages (`Page` union in `Sidebar.tsx`, `PAGES` map
in `Shell.tsx`):

- **Home** — landing panels + stubs for roadmap features (`StubPanel` pattern).
- **Agents** — chat workspace, agent roster (constellation view), pipelines,
  automations, run history.
- **Categories** — the universal tag (`categories` table; projects, tasks,
  notes, chats, and courses carry `category_id`). `CategoryDetail` drills into
  Projects | Chats | Tasks | Notes; `ProjectDetail` opens from here with the
  project's chats, files (upload or paste-text), bookmarks, and automations.
- **Notes** — markdown notes (folders + FTS), **Review** (flashcards with
  SM-2-style scheduling: ease/interval/reps/due, suspend; generated from notes
  via `flashcardGen.ts` or the `create_flashcards` tool), **Bookmarks**
  (grouped, project-linkable), **Snippets** (grouped, one-click copy).
- **Planner** — tasks (due dates, simple daily/weekly/monthly recurrence,
  course links), calendar-first views (1-day with every hour rendered, 7d, 14d,
  month) merging events + due tasks (`calendarItems.ts`), class-schedule ICS
  import (courses + `events` rows, `source='ics'`; quick-add writes
  `source='manual'`, the only ones deletable in place), and the job
  **Applications** tracker (status pipeline + event history).
- **Presets / Permissions / Settings** — CRUD for presets, levels and grants,
  provider keys + default/router models, Ollama base URL with test-connection
  and live model list, per-day per-model token usage.

A ⌘K `CommandPalette` (cmdk) covers navigation targets plus live search over
notes, tasks, applications, and bookmarks.

## Data model

All 13 migrations live in `src-tauri/migrations/` and run on both targets (Rust
list on desktop, `migrationPlan.ts` on web). Current tables, grouped:

```txt
AI OS core (0001, 0003, 0010, 0013)
  presets             system_prompt, provider, model, router_model,
                      enabled_agents_json, permission_level_id, token_budget,
                      compaction_threshold, is_builtin
  permission_levels   name, description, is_builtin
  permission_grants   level_id, tool, access(read|write),
                      scope_type(any|doc_folder|url_domain), scope_value
  agents              name, description, instructions, tools_json, model,
                      max_steps, color, is_builtin
  chat_sessions       title, preset_id, permission_level_id (NULL = ask
                      everything), compaction_summary, project_id, color,
                      category_id, auto_summary, auto_tags_json
  chat_messages       session_id, role, parts_json (UIMessage parts), agent,
                      model, input/output/cached_input_tokens, compacted
  messages_fts        FTS5 (message_id, session_id, content) — written by the
                      messages repo from extracted text parts, backfilled at boot
  documents(+_fts)    title, source_name, mime_type, folder (permission scope
                      key), content_text, byte_size, page_count, project_id;
                      FTS synced by triggers
  attachments         message_id, document_id, kind(image|pdf|audio), file_path

Pipelines & automations (0004, 0005)
  pipelines           name, description
  pipeline_steps      pipeline_id, position, agent_id, prompt_template
  pipeline_runs       status(running|success|error), input, error, timestamps;
                      automation_id when scheduled
  pipeline_step_runs  run_id, position, agent_id, prompt, output, status
  automations         name, pipeline_id, schedule_kind(interval|daily|weekly),
                      interval_minutes/time_of_day/day_of_week, input_template,
                      permission_level_id, output_note_folder, enabled,
                      next_run_at, last_run_at, project_id

Dashboard (0002, 0006–0009, 0011, 0012)
  notes(+notes_fts)   title, folder, body_md, category_id; FTS via triggers
  courses             code, name, term, folder, color, category_id
  tasks               title, notes, course_id, due_at,
                      recurrence(daily|weekly|monthly), completed_at, category_id
  events              course_id, title, location, starts_at, ends_at,
                      source('ics' import | 'manual' quick-add; manual events
                      color by kind and are the only ones deletable in place)
  applications        company, role, url, status(interested→…→offer/rejected/
                      ghosted), applied_at, next_action(_at), notes
  application_events  application_id, status, note  (history trail)
  flashcards          folder, front, back, source_note_id, ease, interval_days,
                      reps, due_at, suspended
  bookmarks           title, url, group_name, project_id
  snippets            title, body, group_name
  projects            name, description, color, category_id
  categories          name UNIQUE, color — the universal tag
```

Binary bytes go to files via plugin-fs, never DB blobs. Token usage lives on
messages; per-day reporting aggregates with SUM at read time (`usage.ts`) — no
separate usage table.

## Web target specifics

- **Database** — sqlite-wasm with the OPFS SAH-pool VFS, inside a Worker
  (`webClient.worker.ts`); the main thread talks to it over a postMessage RPC
  implementing `DbClient`. OPFS requires cross-origin isolation:
  `public/_headers` ships `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp` (Vite dev/preview set the same).
- **Per-browser data** — the database belongs to that browser profile; there is
  no shared state with the desktop app and no filesystem backup path.
- **Settings/keys** — localStorage, with the hosted-origin guidance in Settings
  (keys entered on a hosted origin live in that origin's storage).
- **Ollama from a hosted origin** — documented caveat: the browser calls
  `localhost:11434` from an HTTPS origin only if Ollama's CORS allows it
  (`OLLAMA_ORIGINS`); Settings' test-connection surfaces this.
- See `docs/hosting.md` for deploy steps (Cloudflare Pages recommended), the
  proxy function, and security notes.

## Keys & security

- API keys: plugin-store JSON in app-data (desktop) — never in the DB, never in
  source; localStorage on web (documented tradeoff for a hosted personal build).
- Desktop capabilities whitelist exactly the provider hosts reachable via
  plugin-http; the app binds to nothing — no listening port. Attack surface is
  the webview plus whatever the OS user account can already do.
- FTS5 is checked at startup; the app fails fast with a clear error.

## Backups

Desktop state is one SQLite file plus the attachments dir in app-data. Backup is
"copy `dashboard.db` (and `attachments/`) somewhere" — a dated copy on a
schedule once the resilience work in `docs/todo.md` (3.6) lands; manual until
then. The web build has no filesystem to back up to and a per-browser database
instead — its data lives and dies with the browser profile until export lands.

## Deliberate tradeoffs

| Decision | Why | Revisit when |
| --- | --- | --- |
| Plain SQL, no Drizzle | An ORM shim over plugin-sql adds an async layer + a second migration pipeline for ~25 tables; repo functions keep queries in one place | If query volume gets painful |
| Keys in plugin-store, not Stronghold/keyring | Stronghold needs a master-password UX and a heavy Rust dep for a single-user machine | If the threat model grows beyond "my own PC" |
| One migration source (`src-tauri/migrations/`), two runners | Desktop runs it in Rust pre-webview; web parses the same files (`migrationPlan.ts`) — no drift | — |
| Agents in the DB, tools in code | User-composable agents without a plugin system; the catalog stays the only capability surface | If tool modules need third-party contribution |
| Scheduler runs only while the app is open | No background process exists to host it; claim-before-run keeps it safe | Autostart-to-tray + catch-up policy (todo 3.1) |
| Token estimation chars/4 for unsent parts | Real usage from responses is authoritative; the estimate only gates compaction | If compaction triggers misfire in practice |
| No TTS, no whisper.cpp | Free TTS is poor; a whisper sidecar blocks the mobile port | Post-v1 |
| STT via Gemini audio | Only $0 path that works in WebView2 today | If Gemini free tier terms change |
| Unhardened `/__proxy` in production | Personal deployment behind an obscure URL today | Before any shared deployment — allowlist + SSRF guard (todo 4.5) |
