# Roadmap

Each phase is a self-contained chunk (roughly 1–3 working sessions for one experienced
React developer) that ends with something usable every day. Order reflects the pivot:
the AI OS is the core and ships first; dashboard features follow and plug into it.

## Phase 0 — Foundation

Scaffold everything the AI OS sits on.

- Tauri 2 shell + Vite + React + TS; single `npm run tauri dev` on Windows
- SQLite via tauri-plugin-sql with versioned migrations; FTS5 verified at startup
  (fail fast if missing)
- Tailwind v4 + shadcn/ui base layout (sidebar nav, CSS-variable theme tokens,
  dark/light via `prefers-color-scheme`) — structure only, design polish later
- Provider settings page: Gemini/Anthropic/OpenAI keys (tauri-plugin-store), Ollama
  base URL, model pickers
- Streaming chat with a single model (no tools yet), sessions + messages persisted

**Done when:** the app opens on Windows, the DB migrates, and a Gemini free-tier chat
streams end to end.

## Phase 1 — AI OS core

The differentiator: agents, permissions, presets, token optimization, evals.

- Permission engine: levels + scoped grants (`read|write` ×
  `any|doc_folder|url_domain`), session grants, approval cards
  (allow once / session / deny), permission-level dropdown in the chat header,
  permissions management page
- Gated tools: `search_documents`, `read_document`, `list_documents`, `fetch_url`
- Orchestrator (cheap router model) + knowledge agent + research agent
- Context presets: seeded Quick Q&A / Study / Research + CRUD + picker
- Token tracking (usage per message, TokenMeter vs budget) + compaction + Anthropic
  prompt caching
- Eval harness (evalite): router / tools / permissions / compaction suites, runnable
  at $0

**Done when:** an out-of-scope tool call raises an approval card while an in-scope one
auto-runs under the selected level; the router eval scores ≥85%.

## Phase 2 — Multimodal

- Image input: paste/drop screenshots into chat; vision-capable model flags in the
  registry
- PDF ingestion: drop → unpdf text extraction → documents + FTS → retrievable by the
  knowledge agent
- Voice input: MediaRecorder mic capture → Gemini free-tier transcription → composer
  (isolated module; TTS and whisper.cpp deferred)

**Done when:** a pasted screenshot gets described, a dropped syllabus PDF is
answerable via the knowledge agent, and the mic button types for me.

## Phase 3 — Dashboard features

Fastest daily value outside chat; each feature lands as UI + agent tools behind the
permission engine.

- Bookmarks: groups + CRUD, favicon display, drag-to-reorder
- Snippets: CRUD with one-click copy
- Notes: list + CodeMirror 6 markdown editor with preview; FTS5 index; `search_notes`
  / `read_note` tools (note folders become permission scopes)
- ⌘K palette (cmdk): fuzzy search over bookmarks, snippets, notes, and app actions

**Done when:** ⌘K → type → Enter opens any bookmark or copies any snippet, and asking
the AI OS "what did my note about X say?" respects the active permission level.

## Phase 4 — Tasks & scheduling

- Tasks CRUD: due dates, recurrence (`rrule`), complete/snooze
- Calendar view mixing tasks and imported events; ICS import of the class schedule
  (`ical.js`), re-importable each semester
- Reminders via tauri-plugin-notification (local notifications, no push server)
- Planner agent + `list_tasks` / `create_task` tools (same permission flow); daily
  SQLite backup job

**Done when:** the class schedule renders on the calendar, a reminder fires as a
native Windows notification, and "plan my week" produces a permission-gated plan.

## Phase 5 — Mobile port & polish

- Tauri iOS/Android build of the same codebase (this is why: no sidecar, no
  desktop-only deps, all logic in TS)
- Widget-grid home screen (dnd-kit); theme customization; keyboard-shortcut reference
- Accessibility pass: focus order, screen-reader labels, reduced motion

**Stretch (only after the above):** GitHub activity widget, pomodoro timer,
job-application tracker.
