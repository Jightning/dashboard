# Personal Dashboard — AI OS

A $0, single-user desktop app (Tauri 2 + React/TypeScript) whose core is an **AI OS**:
a multi-agent assistant over your personal data, gated by permission levels you define.
See [`docs/idea.md`](docs/idea.md) for the vision, [`docs/architecture.md`](docs/architecture.md)
for how it works, and [`docs/roadmap.md`](docs/roadmap.md) for what comes next.

Built in this phase (roadmap Phases 0–2):

- **Chat** with streaming, sessions, and persisted history (SQLite, one file)
- **Multi-agent workflow** — a cheap router model orchestrates; knowledge agent
  (searches your documents via FTS5) and research agent (reads web pages) specialize
- **Permission levels** — named sets of scoped grants (read/write × folder/domain);
  anything outside the active level raises an approval card
  (allow once / allow for session / deny), even from nested agents
- **Context presets** — Quick Q&A / Study / Research seeds + your own
- **Token optimization** — usage tracking per message, budget meter, automatic
  history compaction on the router model
- **Multimodal** — paste images (vision models), drop PDFs (indexed for retrieval),
  voice input via Gemini transcription
- **Evals** — evalite suites for routing, retrieval, permission respect, and
  compaction fidelity, runnable at $0

## Windows setup

1. Install [Node.js 22+](https://nodejs.org) and the
   [Rust toolchain](https://www.rust-lang.org/tools/install) (`rustup`, MSVC target —
   the installer will prompt for Visual Studio Build Tools if missing).
   WebView2 ships with Windows 11.
2. ```sh
   npm install
   npm run tauri dev
   ```
   First launch compiles the Rust shell (a few minutes), then opens the window,
   creates the database in `%APPDATA%`, and runs migrations.
3. In **Settings**, paste a [Gemini API key](https://aistudio.google.com/apikey)
   (free tier) — or point at a local [Ollama](https://ollama.com) — and save.
4. Start a chat from a preset. Documents you drop as PDFs become searchable by the
   knowledge agent under the permission level you select.

> `npm run tauri build` (installer) additionally needs app icons: run
> `npm run tauri icon <path-to-1024px-png>` once first.

## Verification checkpoints

Cloud/CI sessions can't open a Tauri window, so these three checks run on Windows:

| # | After | Check |
|---|---|---|
| W1 | setup | App opens; DB file exists; startup FTS5 check passes (app fails loudly if not) |
| W2 | adding a key | A Gemini chat streams end-to-end; token meter fills in after the reply |
| W3 | multimodal | Pasted screenshot described; dropped PDF answerable via Study preset; mic button types for you |

Everything else is machine-checkable anywhere:

```sh
npm run typecheck   # strict TS
npm test            # 65 unit/integration tests (real SQLite + FTS5, mocked models)
npm run build       # production bundle
npm run eval        # evalite suites; skip cleanly with no key
```

## Evals

Runnable at $0 two ways:

```sh
GOOGLE_GENERATIVE_AI_API_KEY=... npm run eval      # Gemini free tier
EVAL_OLLAMA_MODEL=qwen3 npm run eval               # local Ollama
```

The router suite is the regression gate: **≥ 85%** (`npx evalite run --threshold 85`)
before shipping any model or prompt change. `npm run eval:watch` opens the local UI.

## Backups

All state is one SQLite file plus attachments, in the app-data dir
(`%APPDATA%/com.jmvaz.dashboard/`). Copy `dashboard.db` somewhere — that's the backup.
A scheduled job lands with tasks/cron in Phase 4.