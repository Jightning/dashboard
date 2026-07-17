# Architecture

One person, one machine, zero dollars. Everything below follows from that: a single
desktop app, a single SQLite file, and free/MIT dependencies only. No server process,
no hosting, no subscriptions.

## System overview

```txt
              ┌───────────────────────────────────────────────────────┐
              │  Tauri 2 app (Windows now; iOS/Android later)         │
              │                                                       │
              │  WebView (all logic lives here, in TypeScript)        │
              │   ├─ React SPA (shell, chat, settings, presets)       │
              │   ├─ AI OS core                                       │
              │   │   ├─ provider registry (Gemini/Ollama/BYOK)       │
              │   │   ├─ orchestrator ──► specialist agents           │
              │   │   ├─ permission engine (levels + scoped grants)   │
              │   │   ├─ context presets                              │
              │   │   └─ token tracking + compaction                  │
              │   └─ repos (typed SQL) ─┐                             │
              │                         │ Tauri IPC                   │
              │  Rust shell (thin)      ▼                             │
              │   ├─ tauri-plugin-sql ──► SQLite file (+ FTS5)        │
              │   ├─ tauri-plugin-http ─► outbound provider calls     │
              │   ├─ tauri-plugin-fs ───► attachments dir             │
              │   ├─ tauri-plugin-store ► API keys (app-data JSON)    │
              │   └─ tauri-plugin-dialog                              │
              └───────────────┬───────────────────────────────────────┘
                              │ outbound only, per-request, BYOK
                              ▼
               Gemini free tier / Anthropic / OpenAI APIs
               Ollama (optional, same box, localhost:11434)
```

Why this shape:

- **Tauri 2, not Electron.** ~10MB installers, MIT, and official iOS/Android targets —
  the later mobile port reuses this codebase instead of requiring a rewrite.
- **No server, no Node sidecar.** The old Hono/Node design assumed a web PWA. Sidecars
  don't work on Tauri mobile and a second process is complexity with no payoff for a
  single user. All application logic is TypeScript running in the webview; the Rust
  layer only registers official plugins and holds DB migrations (~100 lines total).
- **Provider calls go through `tauri-plugin-http`.** The webview origin
  (`http://tauri.localhost`) would hit CORS walls on OpenAI/Anthropic. A `fetch`
  implementation from plugin-http (requests exit via Rust, no CORS) is injected into
  every AI SDK provider factory. Capabilities whitelist exactly the provider hosts.

## Repo layout

```txt
src/
  app/            Shell + sections: home/, agents/ (chat, roster, pipelines,
                  automations), categories/ (CategoriesPage, CategoryDetail —
                  Projects | Chats | Tasks | Notes tabs; projects/ProjectDetail
                  opens from here), notes/ (notes + review flashcards,
                  bookmarks, snippets), planner/ (tasks, calendar-first with
                  7d/14d/month views, applications), presets/, permissions/,
                  settings/
  components/     ui/ (shadcn), chat/ (MessageList, Composer, ApprovalCard,
                  TokenMeter, PresetPicker, PermissionLevelDropdown)
  ai/
    providers/    registry.ts, keys.ts, tauriFetch.ts
    chat/         transport.ts (client-side ChatTransport for useChat)
    agents/       orchestrator.ts, knowledge.ts, research.ts, types.ts
    tools/        documents.ts, web.ts
    permissions/  engine.ts, types.ts
    presets/      defaults.ts
    context/      tokens.ts, compaction.ts
    multimodal/   pdf.ts, stt.ts
  db/             client.ts (interface), tauriClient.ts, testClient.ts (vitest only),
                  repo/ (sessions, messages, documents, presets, permissions)
  lib/            ids.ts, utils.ts, schemas.ts (zod)
src-tauri/        Cargo.toml, tauri.conf.json, capabilities/, src/lib.rs,
                  migrations/*.sql
evals/            router/tools/permissions/compaction .eval.ts, fixtures/, scorers.ts
docs/             idea.md, architecture.md, roadmap.md
```

Shell.tsx composes the app chrome: sidebar nav, StatusBar (live due-today/
next-automation readouts via `StatusReadouts.tsx`, model chip → Settings),
and restores/persists nav position (page, tab, open chat) plus per-session
composer drafts to localStorage under versioned `hugh.*` keys.

## Stack and why each piece is free

| Piece | Choice | License / cost | Why |
| --- | --- | --- | --- |
| Desktop shell | Tauri 2 | MIT/Apache-2.0 | Tiny binaries; webview UI; official mobile targets for the later port |
| Frontend | Vite + React + TS | MIT | Existing React strength; fast dev loop |
| UI | Tailwind CSS v4 + shadcn/ui (Radix) | MIT | Accessible primitives; CSS-variable tokens make later theming cheap |
| DB | SQLite via tauri-plugin-sql + FTS5 | MIT | Single-file DB in app-data; FTS5 for search; trivial backup |
| AI | Vercel AI SDK (`ai`) | Apache-2.0 | Provider-agnostic streaming + tool calls + agent loops |
| AI cloud | `@ai-sdk/google` (Gemini free tier), `@ai-sdk/anthropic`, `@ai-sdk/openai` (BYOK) | free tier / BYOK | $0 cloud option today; paid keys optional, never required |
| AI local | `ai-sdk-ollama` provider | MIT | Local models over localhost:11434; reliable tool calling |
| PDF | `unpdf` | MIT | Browser-safe text extraction, no native deps |
| Key storage | tauri-plugin-store | MIT | App-data JSON outside the DB; see Tradeoffs |
| Evals | evalite | MIT | TypeScript-native, vitest-based, local UI; runs on Gemini free/Ollama at $0 |
| Tests | vitest + better-sqlite3 (dev-only test double) | MIT | Deterministic CI-safe tests incl. real FTS5 |

## The AI OS

The differentiator. Five pillars: multi-agent workflow, multimodal input, context
presets, token optimization, and evals — all behind a permission system with **no
silent data access**.

### Agent topology

Plain orchestrator–worker composition on AI SDK primitives. No agent framework.

- **Orchestrator** — runs on the preset's `router_model` (cheap: Gemini Flash or a
  small Ollama model). Sees specialists as tools (`ask_knowledge_agent`,
  `ask_research_agent`) plus the option to answer directly, bounded by
  `stopWhen: stepCountIs(6)`. Quick Q&A costs zero delegation.
- **Knowledge agent** — tools `search_documents` (FTS5 MATCH + snippets),
  `read_document`, `list_documents`. Runs on the preset's main model.
- **Research agent** — tools `search_web` (DuckDuckGo HTML endpoint,
  `html.duckduckgo.com`, no key, $0) and `fetch_url` (HTML→text, size-capped),
  both permission-scoped by domain. Desktop reaches both through
  `tauri-plugin-http` (no CORS). The browser target has no such escape hatch,
  so `wrapWebFetch` (`src/ai/providers/appFetch.ts`) rewrites outbound web-tool
  requests through a Vite dev/preview middleware, `/__proxy?url=`
  (`vite.config.ts`), which does the cross-origin fetch server-side.
- **Planner agent** — deliberately deferred. It has no real tools until tasks/notes
  exist (Phase 3+); building a stub now is dead code.

Every specialist runs its own `streamText`/`generateText` loop with a narrow tool
set; results return to the orchestrator as tool results. All tool execution — the
orchestrator's and the specialists' — funnels through the permission engine.

### Permission model — levels, scoped grants, approval cards

Hard rule carried over from v1 of this doc: the AI never touches data without a
permission the user chose. What changed: multi-agent flows fire many tool calls per
request, so per-call approval for everything would be unusable. The resolution is
**permission levels** — named bundles of scoped grants the user selects per session
from a dropdown in the chat header.

```txt
grant  = (tool, access: read|write, scope_type: any|doc_folder|url_domain, scope_value)
level  = named set of grants          e.g. "Study" = read documents in /school
session.permission_level  = user-selected, switchable mid-session
```

Decision order for every tool call, orchestrator and specialists alike:

```txt
1. grant in active level matches (tool, access, scope)  ──► auto-allow, log it
2. ephemeral session grant from a prior "allow for session" ──► allow
3. otherwise ──► pause; ApprovalCard renders (tool + args + resolved scope)
       allow once │ allow for session │ deny
   deny ──► structured {denied, reason} tool result; model answers without the data
```

- Each tool declares a `scopeOf(args)` extractor: `read_document` resolves the
  document's folder, `fetch_url` resolves the hostname. Grants match on scope prefix
  (folders) or exact domain.
- Built-in levels: **Ask everything** (zero grants — the old v1 behavior) and
  **Read documents** (read-only, any folder). Users create custom levels in the
  permissions page (e.g. "Study": read-only `/school`; "Research": adds `fetch_url`
  for chosen domains).
- Write grants are never part of built-in levels; creating one is an explicit user
  act in the permissions UI.
- Mechanics: if the installed `ai` version's tool-approval API (`needsApproval`) is
  stable, the engine is the `needsApproval` predicate; otherwise gated tools omit
  `execute` and the transport pauses/resumes via `addToolResult`. The engine itself
  is pure TypeScript, UI-independent, unit-tested as a decision table.

### Context presets

A preset binds everything a session needs:

```txt
preset = { system_prompt, provider+model, router_model, enabled_agents,
           permission_level, token_budget, compaction_threshold }
```

Seeded defaults: **Quick Q&A** (no agents/tools, cheap model, small budget),
**Study** (knowledge agent, "Read documents" level), **Research** (knowledge +
research agents). Presets are rows in the DB with full CRUD; a picker applies one at
session creation and the session can override the permission level afterward.

### Token optimization

1. **Model routing** — the orchestrator runs on a cheap `router_model`; only
   specialist work uses the preset's main model.
2. **Real usage accounting** — every `streamText` result's usage lands on the
   message row (input/output/cached tokens). A TokenMeter shows session totals
   against the preset's `token_budget`.
3. **Compaction** — before each send, if estimated context (stored usage + chars/4
   for unsent parts) exceeds `compaction_threshold`, all but the last 6 messages are
   summarized by the router model into `chat_sessions.compaction_summary`, marked
   `compacted=1`, and context is rebuilt as `[system, summary, recent]`.
4. **Provider prompt caching** — on Anthropic, `cacheControl` providerOptions on the
   system prompt/tools; the stable prefix (system + tools) renders first so caching
   actually hits.
5. **Retrieval, not stuffing** — PDFs and documents live in SQLite + FTS5 and reach
   the model through `search_documents`, never inlined wholesale.

### Multimodal

- **Images** — paste/drop into the composer → saved via plugin-fs under
  `appData/attachments/` → AI SDK image part on the user message. The registry flags
  which models are vision-capable (Gemini, Claude, GPT-4o+, llava via Ollama).
- **PDFs** — drop → `unpdf` extracts text in the webview → `documents` row (+FTS via
  triggers) + attachment record. Chat shows an "ingested" note; agents reach the
  content through retrieval. Small PDFs (<~10 pages) may additionally attach as a
  file part for direct vision-model reading.
- **Voice input (STT)** — WebView2 has no Web Speech `SpeechRecognition`. v1:
  MediaRecorder captures mic audio (webm/opus) → sent as a file part to Gemini free
  tier with a transcription prompt → text lands in the composer. whisper.cpp/local
  STT deferred (a sidecar wouldn't port to mobile). The module is isolated so its
  failure blocks nothing. TTS is out of scope for v1.

### Evals

Two layers, strictly separated:

- **Deterministic unit tests** (vitest, CI-safe, no network): permission-engine
  decision table, compaction math and context assembly, repos against a real SQLite
  (better-sqlite3 with FTS5), transport persistence, agent loops driven by
  `MockLanguageModelV2` from `ai/test`.
- **Live-model evals** (evalite, run locally at $0 on Gemini free tier or Ollama;
  skip cleanly when no model is configured):
  - `router.eval.ts` — ~20 prompts → expected route (direct/knowledge/research);
    deterministic scorer on the first tool chosen. **Regression gate: ≥85%** before
    any model or prompt change ships.
  - `tools.eval.ts` — retrieval prompts over fixture docs; scorer checks planted
    facts appear in the answer.
  - `permissions.eval.ts` — prompts tempting out-of-scope access under a restricted
    level; scorer asserts the engine blocked execution AND the answer degrades
    gracefully.
  - `compaction.eval.ts` — 30-turn fixture conversation; planted key facts must
    survive summarization.

## Data model

```txt
presets            id, name, description, system_prompt, provider, model,
                   router_model, enabled_agents_json, permission_level_id,
                   token_budget, compaction_threshold, is_builtin, timestamps
permission_levels  id, name, description, is_builtin, created_at
permission_grants  id, level_id, tool, access ('read'|'write'),
                   scope_type ('any'|'doc_folder'|'url_domain'), scope_value
categories         id, name UNIQUE, color, timestamps — the universal tag;
                   projects/tasks/notes/chat_sessions/courses carry category_id
chat_sessions      id, title, preset_id, permission_level_id (session override),
                   compaction_summary, category_id, auto_summary, auto_tags_json
                   (router-model metadata), timestamps
chat_messages      id, session_id, role, parts_json (AI SDK UIMessage parts),
                   agent, model, input_tokens, output_tokens, cached_input_tokens,
                   compacted (0|1), created_at
messages_fts       FTS5 (message_id, session_id, content) — written by the
                   messages repo from extracted text parts, backfilled at boot
documents          id, title, source_name, mime_type, folder (permission scope key),
                   content_text, byte_size, page_count, created_at
documents_fts      FTS5 over (title, content_text), synced by triggers
attachments        id, message_id, document_id, kind ('image'|'pdf'|'audio'),
                   file_path (under appData/attachments/), mime_type, created_at
```

Binary bytes go to files via plugin-fs, never DB blobs. Token usage lives on
messages (aggregate with SUM); a separate usage table only if per-day reporting is
ever wanted.

The semester-planner migration (0006) added `courses`, `tasks`, and `events` —
not re-sketched above. Worth flagging: `events.source` defaults to `'ics'`
(class-schedule import) but the calendar's quick-add form now writes
`'manual'` for user-created events, which are the only ones deletable in
place. Manual events don't carry `category_id` — they color by kind, and
category filtering of events still flows through the course link.

**Future tables (dashboard phases — sketch only, not migrated yet):**

```txt
notes            id, title, body_md, timestamps          (+ notes_fts)
bookmarks        id, group_id, title, url, icon, sort_order
bookmark_groups  id, name, sort_order
snippets         id, title, body, remind_at
tasks            id, title, notes, due_at, rrule, completed_at, source
```

Each future feature's folder/group becomes a permission `scope_type`, and each
feature ships as agent tools behind the same engine.

## Keys & security

- API keys live in a `tauri-plugin-store` JSON file in the app-data dir — never in
  the DB, never in source. Only the whitelisted provider hosts are reachable via
  plugin-http capabilities.
- The app binds to nothing; there is no listening port. Attack surface is the
  webview plus whatever the OS user account can already do.
- FTS5 availability is checked at startup (`pragma_compile_options`); the app fails
  fast with a clear error rather than silently degrading.

## Backups

The entire state is one SQLite file plus the attachments dir in app-data. Backup is
"copy `dashboard.db` (and `attachments/`) somewhere" — a dated copy on a schedule
once tasks/cron exist (Phase 4), manual before then.

## Deliberate tradeoffs

| Decision | Why | Revisit when |
| --- | --- | --- |
| Plain SQL, no Drizzle | drizzle's sqlite-proxy over plugin-sql adds an async shim + a second migration pipeline for ~10 tables; repo functions keep queries in one place | Dashboard phase if query volume gets painful |
| Keys in plugin-store, not Stronghold/keyring | Stronghold needs a master-password UX and a heavy Rust dep for a single-user machine | If the threat model grows beyond "my own PC" |
| Migrations as SQL strings in Rust (plugin-sql's built-in list) | One migration pipeline, versioned, runs before the webview loads | — |
| Token estimation chars/4 for unsent parts | Real usage from responses is authoritative; the estimate only gates compaction | If compaction triggers misfire in practice |
| No TTS, no whisper.cpp | Free TTS is poor; whisper sidecar blocks the mobile port | Post-v1 |
| STT via Gemini audio | Only $0 path that works in WebView2 today | If Gemini free tier terms change |
