# Personal Dashboard — Product Vision

A self-hosted personal dashboard that manages the daily workflow of one person (me): a
computer engineering student who lives in the browser, works across many tools, and wants
an AI assistant that can act on personal data **only with explicit permission**.

Two goals, equally weighted:

1. **Daily utility** — a home base for links, snippets, notes, tasks, and an AI assistant.
2. **Career/learning value** — a portfolio-grade full-stack + applied-AI project.

## Hard constraints

- **$0 total cost.** No subscriptions, no paid tiers, no App Store fee. Free tiers and
  bring-your-own-key APIs are acceptable; local-first is preferred.
- **Private by default.** Runs on my own machine; reachable from my phone over Tailscale
  (free tier). No third party holds my data.
- **No auto permissions for AI.** The assistant can never touch dashboard data without an
  explicit approval from me for that tool call (or a permission I granted for the session).

## Features

### AI assistant (was "AI OS")

Renamed and rescoped: not an operating layer, but a chat assistant with **permission-gated
tools** over dashboard data (search notes, list bookmarks, create snippets/tasks…). Every
tool call surfaces an approval card — *allow once / allow for session / deny* — plus a
settings page for per-tool defaults. Provider-agnostic: local models via Ollama, Google
Gemini's free API tier, or bring-your-own-key Anthropic/OpenAI. Hardware for local models
is undecided, so the provider layer is an abstraction from day one.

### Notes editor (was "built-in text editor")

Scoped to **markdown**: CodeMirror 6 editor with live preview and code-block syntax
highlighting. Notes are stored locally and full-text searchable (SQLite FTS5).

### Bookmarks + ⌘K command palette

Bookmark groups for programs, sites, and school portals — plus a global **⌘K palette**
(new idea) that fuzzy-searches bookmarks, snippets, notes, and app actions. The palette is
the "easy to use" backbone: everything reachable from the keyboard.

### Snippets handler

Reusable text snippets with one-click copy; a snippet can carry an attached reminder that
fires as a push notification.

### Tasks & scheduling (deferred to a later phase by choice)

Task manager with due dates, calendar view, recurring tasks, and push-notification
reminders. **New idea:** import my class schedule via ICS export (Purdue/Brightspace
calendars export ICS).

### Platform: web + iOS as a PWA (was "iOS and web availability")

Native iOS distribution requires a $99/yr Apple Developer account, which breaks the $0
constraint. Instead the dashboard is an **installable PWA**: one React codebase, installs
to the iOS home screen, and supports web push notifications on iOS 16.4+.

### Stretch ideas (student/career-fit, post-v1)

- GitHub activity widget
- Pomodoro / focus timer
- Job-application tracker
- Customizable widget-grid home screen

## Non-goals

- Native iOS/Android apps
- Multi-user support, accounts, or sharing
- Anything requiring a paid service to function
- "Managing every part of work/life" in v1 — scope is the student workflow; the widget
  system leaves room to grow

## Prior art (why build it anyway)

Open source already covers pieces of this: **Homarr / Dashy / Homepage** for link
dashboards, **Obsidian** for notes. Building anyway is deliberate — the learning and
portfolio value is the point, and the differentiator is the permission-gated AI assistant
over personal data, which none of those provide. Borrow their patterns (service tiles,
widget grids, ⌘K), not their code.
