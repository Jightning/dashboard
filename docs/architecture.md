# Architecture

One person, one machine, zero dollars. Everything below follows from that: a single Node
process, a single SQLite file, and free/MIT dependencies only.

## System overview

```txt
 iPhone (installed PWA) ─┐
                         │  Tailscale tailnet (free tier, WireGuard-encrypted)
 Laptop browser ─────────┤
                         ▼
              ┌─────────────────────────────────────────────┐
              │  Node process (my machine)                   │
              │                                              │
              │  Hono ── serves built SPA + JSON API         │
              │   ├─ auth middleware (passphrase session)    │
              │   ├─ AI routes (AI SDK streaming)            │
              │   ├─ cron scheduler (reminders → web-push)   │
              │   └─ Drizzle ORM ──► SQLite file (+ FTS5)    │
              │                                              │
              │  Ollama (optional, same box) ◄─ AI provider  │
              └─────────────────────────────────────────────┘
                         │ outbound only, per-request, BYOK
                         ▼
              Gemini free tier / Anthropic / OpenAI APIs
```

## Repo layout

Single package — no monorepo tooling needed at this scale:

```txt
client/    Vite + React + TypeScript SPA (PWA)
server/    Hono API, cron, web-push, AI routes
shared/    Types and zod schemas used by both
data/      SQLite database file (gitignored)
docs/      idea.md, architecture.md, roadmap.md
```

## Stack and why each piece is free

| Piece | Choice | License / cost | Why |
|---|---|---|---|
| Frontend | Vite + React + TS | MIT | Existing React strength; fast dev loop |
| PWA | vite-plugin-pwa | MIT | Service worker + manifest with minimal config; iOS installable |
| UI | Tailwind CSS + shadcn/ui (Radix) | MIT | Accessibility (focus, ARIA) built into Radix primitives |
| Palette | cmdk | MIT | The ⌘K component used by Linear/Vercel-style palettes |
| Server | Hono on Node | MIT | Tiny, typed, one process for API + static + cron |
| DB | SQLite (better-sqlite3) + Drizzle | MIT | Single-file DB, synchronous + fast, trivial backup; FTS5 for search |
| AI | Vercel AI SDK (`ai`) | Apache-2.0 | Provider-agnostic streaming + tool calls |
| AI local | `ai-sdk-ollama` provider | MIT | The community Ollama provider recommended for reliable tool calling |
| AI cloud | `@ai-sdk/google` (Gemini free tier), `@ai-sdk/anthropic` / `@ai-sdk/openai` (BYOK) | free tier / BYOK | $0 cloud option today; paid keys optional, never required |
| Editor | CodeMirror 6 + `@codemirror/lang-markdown`, remark preview | MIT | Lightweight markdown + code highlighting |
| Notifications | `web-push` (VAPID) | MIT | Self-generated VAPID keys; works on installed iOS PWAs (16.4+) |
| Calendar (P4) | react-big-calendar, `rrule`, `ical.js` | MIT | Calendar view, recurrence, ICS class-schedule import |
| Access | Tailscale | free tier | Phone access anywhere without opening ports or paying for hosting |

## Data model (initial sketch)

```
notes           id, title, body_md, created_at, updated_at
notes_fts       FTS5 virtual table over (title, body_md)
bookmarks       id, group_id, title, url, icon, sort_order
bookmark_groups id, name, sort_order
snippets        id, title, body, remind_at (nullable)
tasks           id, title, notes, due_at, rrule (nullable), completed_at, source ('manual'|'ics')
chat_sessions   id, title, provider, model, created_at
chat_messages   id, session_id, role, content_json, created_at
tool_permissions tool_name, policy ('ask'|'session'|'always_deny'), updated_at
push_subscriptions id, endpoint, keys_json, created_at
```

## AI permission flow ("no auto permissions")

Tools are declared to the AI SDK **without server-side auto-execution**. The flow per
tool call:

```
model streams a tool call ──► server pauses, forwards to client
        ──► approval card renders in chat (tool name + exact arguments)
        ──► user: allow once │ allow for session │ deny
        allow ► server executes tool ► result streamed back to model ► answer continues
        deny  ► denial returned to model ► model answers without the data
```

- "Allow for session" writes an in-memory grant scoped to that chat session only.
- `tool_permissions` stores per-tool defaults; `ask` is the default for every tool.
- Tools are read-heavy and narrow: `search_notes`, `read_note`, `list_bookmarks`,
  `search_snippets`, `create_snippet`, later `list_tasks` / `create_task`. No shell, no
  filesystem, no network tools — the assistant only sees dashboard data.

## Auth & security

- Tailscale is the perimeter: the server binds to the tailnet address, so nothing is
  exposed to the public internet and no ports are forwarded.
- Defense in depth: a single-user passphrase login issuing an HTTP-only session cookie,
  so a borrowed/lost device on the tailnet still can't open the dashboard.
- API keys (Gemini/Anthropic/OpenAI) live in a local `.env`, never in the DB or client.

## Backups

The entire state is one SQLite file — a cron job copies `data/dashboard.db` to a dated
file (and optionally a private GitHub repo via `git`) daily. Free, and restore is "copy
the file back."
