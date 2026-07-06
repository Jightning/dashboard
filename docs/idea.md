# Personal Dashboard — Product Vision

A personal dashboard desktop app that manages the daily workflow of one person (me): a
computer engineering student who works across many tools and wants an **AI OS** — an AI
layer that operates over my personal data with permissions **I** define, never silently.

Two goals, equally weighted:

1. **Daily utility** — a home base for an AI assistant OS, links, snippets, notes, tasks.
2. **Career/learning value** — a portfolio-grade full-stack + applied-AI project.

## Hard constraints

- **$0 total cost.** No subscriptions, no paid tiers, no App Store fee. Free tiers and
  bring-your-own-key APIs are acceptable; local-first is preferred.
- **Private by default.** Runs entirely on my own machine. No server, no third party
  holding my data; the only outbound traffic is per-request calls to AI providers.
- **No silent AI permissions.** The AI OS can only touch data under a permission level
  I selected (scoped grants) or an approval I clicked for that specific tool call.

## Features

### The AI OS (rescoped back up from "AI assistant")

Earlier drafts renamed this down to a chat assistant. Reversed: the AI OS is the core
of the product — its own stack inside the app, built on five pillars:

1. **Multi-agent workflow** — a cheap orchestrator/router model delegates to
   specialist agents (knowledge agent over my documents, research agent over the web;
   planner agent once tasks exist). Each agent has a narrow tool set.
2. **Multimodal** — paste screenshots into chat (vision models), drop PDFs (extracted,
   indexed, retrievable by agents), talk to it (mic capture → transcription). TTS
   deliberately out of v1.
3. **Context presets** — named bundles of {system prompt, model, agents, permission
   level, token budget} selectable per chat: Quick Q&A, Study, Research, and my own.
4. **Token optimization** — cheap model for routing, real usage tracking against
   per-preset budgets, automatic history compaction, provider prompt caching,
   retrieval instead of context-stuffing.
5. **Evals** — a regression suite (routing accuracy, retrieval quality, permission
   respect, compaction fidelity) runnable at $0 on Gemini free tier or Ollama.

**Permission levels** replace all-or-nothing gating: a dropdown per chat selects a
named level ("Study" = read-only over documents in `/school`), and anything outside
the level's grants still raises an approval card — *allow once / allow for session /
deny*. Provider-agnostic: Ollama local, Gemini free tier, or BYOK Anthropic/OpenAI.

### Notes editor (later phase)

Scoped to **markdown**: CodeMirror 6 editor with live preview and code-block syntax
highlighting. Notes stored locally, full-text searchable (FTS5), and exposed to the
AI OS as permission-gated tools.

### Bookmarks + ⌘K command palette (later phase)

Bookmark groups for programs, sites, and school portals — plus a global **⌘K palette**
that fuzzy-searches bookmarks, snippets, notes, and app actions.

### Snippets handler (later phase)

Reusable text snippets with one-click copy.

### Tasks & scheduling (later phase)

Task manager with due dates, calendar view, recurring tasks, and local notification
reminders. Import my class schedule via ICS export (Purdue/Brightspace calendars
export ICS). Unlocks the planner agent.

### Platform: Windows desktop app on Tauri 2 (was "web + iOS PWA")

The PWA/Tailscale plan is dropped. The dashboard is a **Tauri 2 desktop app**:
React/TypeScript UI in a native webview, thin Rust shell, ~10MB installer, $0 tooling.
Tauri 2 ships official iOS/Android support, so a **mobile port later reuses this same
codebase** — which is why all logic stays in TypeScript (no Node sidecar) and no
dependency may assume a desktop-only runtime.

### Stretch ideas (student/career-fit, post-v1)

- GitHub activity widget
- Pomodoro / focus timer
- Job-application tracker
- Customizable widget-grid home screen

## Non-goals

- A server process, remote access, or multi-device sync in v1 (returns with the
  mobile port, on its own terms)
- Multi-user support, accounts, or sharing
- TTS / voice output in v1
- Anything requiring a paid service to function
- "Managing every part of work/life" in v1 — scope is the student workflow

## Prior art (why build it anyway)

Open source already covers pieces of this: **Homarr / Dashy / Homepage** for link
dashboards, **Obsidian** for notes. Building anyway is deliberate — the learning and
portfolio value is the point, and the differentiator is a permission-gated multi-agent
AI OS over personal data, which none of those provide. Borrow their patterns (service
tiles, widget grids, ⌘K), not their code.