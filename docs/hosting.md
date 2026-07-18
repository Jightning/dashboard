# Hosting

The desktop build (Tauri) is the primary target and needs no hosting at all. This
doc covers the secondary target: a browser build served as a static site, for
trying the app or using it from a machine without the desktop installer.

## What hosting means here

There is no backend. The web build is a static single-page app plus one small
proxy function (`functions/__proxy.ts`, used only so the research agent's web
tools can fetch arbitrary cross-origin URLs — real sites don't send CORS
headers, and the browser can't bypass that itself). There are no accounts, no
server-side database, and nothing about "your data" that lives anywhere except
the visitor's own browser:

- The SQLite database (chat history, documents, presets, everything) is
  compiled to WASM and persisted via OPFS, entirely inside that browser
  profile. See `src/db/webClient.ts` / `src/db/webClient.worker.ts`.
- API keys (Gemini/Anthropic/OpenAI/etc.) live in that browser's
  `localStorage` (`createLocalStorageSettingsStore` in
  `src/ai/providers/keys.ts`), never sent anywhere except straight to the
  provider the key belongs to.
- **The web target has no full backup path.** The in-app markdown export
  (`exportNotesMarkdown` in `src/lib/backup.ts`) covers **notes only** —
  chat history, documents, tasks, and everything else in the browser
  database currently has no export. There is no scheduled file-system
  backup like the desktop build's `runDailyBackup` (no filesystem to write
  to). Treat hosted data as expendable until a whole-database export
  exists: clearing site data or switching browsers loses everything except
  what you exported.

Two people hitting the same hosted URL do not share a database, a session, or
anything else — each browser is its own isolated instance.

## Cloudflare Pages (recommended)

1. Push this repo to GitHub/GitLab and connect it in the Cloudflare Pages
   dashboard.
2. Build command: `npm run build`. Build output directory: `dist`.
3. Deploy. Two things Vite/Pages wire up automatically, no extra config:
   - `public/_headers` is copied verbatim into `dist/` by Vite and read by
     Pages at serve time — it sets `Cross-Origin-Opener-Policy: same-origin`
     and `Cross-Origin-Embedder-Policy: require-corp` on every response,
     matching the headers the dev/preview servers already set in
     `vite.config.ts`.
   - `functions/__proxy.ts` is a Cloudflare Pages Function — anything under
     `functions/` at the repo root auto-deploys as a serverless route, so
     `/__proxy?url=` is live with no separate deploy step.

That's the whole setup. Cloudflare's free tier caps Pages Functions at
100,000 requests/day, far beyond what a personal deployment's proxy traffic
will ever hit.

## Why not GitHub Pages

GitHub Pages serves static files with a fixed header set — it has no
mechanism to attach custom response headers, so `_headers` (or any
equivalent) has no effect there. That rules it out for this app specifically,
not just as a general limitation.

Checked against the actual code (`src/db/webClient.worker.ts`): the worker
calls `sqlite3.installOpfsSAHPoolVfs()` unconditionally, with no capability
check beforehand and no fallback path afterward. If that call rejects for any
reason, `main()`'s catch handler posts `{ type: "init-error" }` back to
`webClient.ts`, whose startup promise rejects with that error; `bootstrap()`
(`src/app/bootstrap.ts`) propagates it; `App.tsx` catches it and renders a
full-screen "startup failure" panel instead of the app. There is no
degraded/in-memory mode — it's a hard error, not a silent fallback.

Whether the *specific* failure is "missing COOP/COEP" depends on the browser:
this project's own dev/preview servers and the upstream `@sqlite.org/sqlite-wasm`
docs both treat those headers as a requirement for OPFS, so that's the
supported contract this app ships against — GitHub Pages, unable to set them,
is unsupported for the web build regardless of whether a given browser
version happens to tolerate their absence today. Use Cloudflare Pages (or any
host that can set `_headers`/equivalent response headers).

## Ollama for hosted visitors

Ollama itself isn't hosted — it still runs on the visitor's own machine at
`localhost:11434`, same as the desktop build. The only difference: by default
Ollama only accepts requests from `localhost`-origin pages, and a hosted URL
is a different origin. To let a hosted deployment reach a visitor's local
Ollama, the visitor sets `OLLAMA_ORIGINS=https://your-site.example` before
starting the Ollama server, then uses that hosted URL instead of `localhost`
in the app's Settings page. Requests still go straight from that visitor's
browser to `localhost:11434` — their machine, their model, nothing leaves.
(Same copy as the Settings page's Ollama card, `src/app/settings/SettingsPage.tsx`.)

## Security notes

- `functions/__proxy.ts` is an open fetch relay: anyone who can reach the
  hosted URL can make it fetch any `http(s)` URL and read back the response.
  It forwards no cookies or auth headers and only copies back `content-type`,
  so it can't be used to read the visitor's own credentials — but it can be
  used as a generic SSRF-style relay against whatever the Cloudflare edge can
  reach. If the deployment should be private, put it behind [Cloudflare
  Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
  (free for small teams) rather than relying on the URL being unlisted.
- Provider API keys never leave the visitor's browser except in the direct
  request to that provider's API — the proxy function only ever sees web-tool
  fetches (`fetch_url`/`search_web`), never provider calls, and never sees
  keys at all.

## Desktop remains first-class

None of the above changes the desktop (Tauri) build: it doesn't use OPFS
(SQLite goes through `tauri-plugin-sql`/Rust), doesn't use the proxy function
(outbound fetches exit via `tauri-plugin-http`, no CORS wall to route
around), and reads/writes its own database file in the OS app-data directory.
A hosted deployment and a desktop install are two entirely separate
instances with two separate databases — nothing syncs between them.
