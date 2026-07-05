# Roadmap

Each phase is a self-contained chunk (roughly 1–3 working sessions for one experienced
React developer) that ends with something usable every day. Order reflects chosen v1
priorities: assistant, notes, bookmarks/snippets first; tasks/scheduling later.

## Phase 0 — Foundation

Scaffold everything the features sit on.

- Vite + React + TS client, Hono server, single `npm run dev` for both
- SQLite + Drizzle with migrations; `data/` gitignored
- Tailwind + shadcn/ui base layout (sidebar nav, dark/light via `prefers-color-scheme`)
- Passphrase login → HTTP-only session cookie
- PWA shell via vite-plugin-pwa (manifest, icons, installable)
- README notes: Tailscale setup, running as a background service (systemd/pm2)

**Done when:** the app installs to an iPhone home screen over the tailnet, requires the
passphrase, and shows an empty authenticated shell.

## Phase 1 — Bookmarks & snippets + ⌘K palette

Fastest daily value; establishes the CRUD and UI patterns every later feature copies.

- Bookmark groups + bookmarks CRUD, favicon display, drag-to-reorder
- Snippets CRUD with one-click copy
- ⌘K palette (cmdk): fuzzy search over bookmarks, snippets, and app actions ("new
  snippet", "go to notes")

**Done when:** ⌘K → type → Enter opens any bookmark or copies any snippet without
touching the mouse.

## Phase 2 — Notes editor

- Notes list + CodeMirror 6 markdown editor with preview toggle and code highlighting
- Autosave; FTS5 index kept in sync on write
- Notes results appear in the ⌘K palette

**Done when:** a note written on the laptop is searchable and readable from the phone
PWA seconds later.

## Phase 3 — AI assistant

The differentiator. Depends on Phases 1–2 so the tools have real data.

- Provider settings page: Ollama base URL + model picker, or Gemini/Anthropic/OpenAI key
  (stored in `.env`, surfaced read-only)
- Streaming chat UI with session history (`chat_sessions` / `chat_messages`)
- Tools: `search_notes`, `read_note`, `list_bookmarks`, `search_snippets`,
  `create_snippet` — all behind the approval-card flow in `architecture.md`
- Per-tool permission settings (`ask` / `session` / `always_deny`)

**Done when:** asking "what did my note about X say?" triggers an approval card, and the
answer is produced *only after* clicking allow — and a deny produces an answer without
the data. Works with at least two providers (e.g., Gemini free tier + Ollama).

## Phase 4 — Tasks & scheduling

- Tasks CRUD: due dates, recurrence (`rrule`), complete/snooze
- Calendar view (react-big-calendar) mixing tasks and imported events
- ICS import of the class schedule (`ical.js`), re-importable each semester
- Reminders: cron in the server process fires `web-push` notifications (iOS PWA included)
- New AI tools: `list_tasks`, `create_task` (same permission flow)

**Done when:** a class schedule ICS renders on the calendar and a task reminder buzzes
the phone at the right time.

## Phase 5 — Personalization & polish

- Widget-grid home screen (dnd-kit): rearrangeable cards for today's tasks, recent notes,
  pinned bookmarks, quick chat
- Theme customization beyond dark/light; keyboard-shortcut reference
- Accessibility pass: focus order, screen-reader labels, reduced motion
- Daily SQLite backup job

**Stretch (only after the above):** GitHub activity widget, pomodoro timer,
job-application tracker.
