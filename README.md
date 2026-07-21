# Personal Dashboard

A Tauri 2 + React/TypeScript AI OS:
a multi-agent assistant over personal data, protected by defined permission levels.

## Windows setup

1. Install [Node.js 22+](https://nodejs.org) and the
   [Rust toolchain](https://www.rust-lang.org/tools/install) (`rustup`, MSVC target —
   the installer will prompt for Visual Studio Build Tools if missing).
   WebView2 ships with Windows 11.
2. ```sh
   npm install
   npm run tauri dev
   ```
   First launch compiles the Rust shell, then opens the window,
   creates the database in `%APPDATA%`, and runs migrations.
3. In **Settings**, paste a [Gemini API key](https://aistudio.google.com/apikey)
   (free tier), or point at a local [Ollama](https://ollama.com) — and save.
4. Start a chat from a preset. Documents you drop as PDFs become searchable by the
   knowledge agent under the permission level you select.

> `npm run tauri build` (installer) additionally needs app icons: run
> `npm run tauri icon <path-to-1024px-png>` once first.

## Verification checkpoints

Cloud/CI sessions can't open a Tauri window, so these three checks run on Windows:

| # | After | Check |
| --- | --- | --- |
| W1 | setup | App opens; DB file exists; startup FTS5 check passes (app fails loudly if not) |
| W2 | adding a key | A Gemini chat streams end-to-end; token meter fills in after the reply |
| W3 | multimodal | Pasted screenshot described; dropped PDF answerable via Study preset; mic button types for you |

Everything else is machine-checkable anywhere:

```sh
npm run typecheck
npm test
npm run build
npm run eval
```

## Evals

```sh
GOOGLE_GENERATIVE_AI_API_KEY=... npm run eval
EVAL_OLLAMA_MODEL=qwen3 npm run eval
```

The router suite is the regression gate: **≥ 85%** (`npx evalite run --threshold 85`)
before shipping any model or prompt change. `npm run eval:watch` opens the local UI.

## Backups

All state is one SQLite file plus attachments, in the app-data dir
(`%APPDATA%/com.jmvaz.dashboard/`). Copy `dashboard.db` somewhere to backup.
