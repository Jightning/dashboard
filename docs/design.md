# Design system — AI OS HUD

The visual language is **HUD / sci-fi FUI** (Jarvis-style): deep space navy,
holographic cyan, fine 1px linework, sparing corner brackets, monospaced data
readouts, and purposeful motion. Dark-committed — there is no light theme in
v1 (`:root` sets `color-scheme: dark` so native controls render dark too; the
token layer keeps a light theme possible later).

**The one rule:** components never hardcode colors, durations, or easings.
Everything comes from the tokens in `src/styles/globals.css`, consumed as
Tailwind utilities (`bg-primary`, `duration-(--dur-fast)`) or `var()`.

**Motion is deliberately restrained.** The interface itself stays calm — no
page-wide ambient animation. The app's sense of "life" is concentrated into
one element: the `NeuralCore` (below), which throbs gently at idle and shifts
around while the AI is thinking or talking. Everything else animates only in
response to a user action (hover, nav, message arrival).

## Tokens (`src/styles/globals.css`)

### Color

| Token | Role |
| --- | --- |
| `--background` / `--card` / `--surface-raised` | Elevation ladder, darkest → lightest |
| `--primary` (cyan) | The holographic core color: actions, focus, active nav, glows |
| `--secondary` (electric blue) | Secondary emphasis |
| `--accent` / `--muted` | Hover surfaces / quiet fills |
| `--warning` (amber) | **Approvals & attention** — approval cards are always amber |
| `--success` / `--destructive` | Status green / danger red |
| `--border` / `--input` / `--grid-line` | Translucent cyan-tinted linework |
| `--glow` | Shared box-shadow color for glow utilities |
| `--agent-orchestrator/knowledge/research` | Agent identity hues (cyan/violet/emerald) |

**Adding an agent:** add a `--agent-<name>` token + `@theme` alias, then an
entry in `IDENTITY` in `src/components/hud/AgentNode.tsx`. Everything else
(nodes, constellation, activity rows) picks it up.

### Type

- `font-display` — Orbitron. Page titles and the wordmark only; never body.
- `font-sans` — Space Grotesk. Default body/UI.
- `font-mono` — JetBrains Mono. All *data*: numbers, tool names, statuses,
  section labels (pattern: `font-mono text-[10px] uppercase tracking-wider`).

Fonts are self-hosted via `@fontsource` imports in `src/main.tsx` (the CSP
blocks CDNs; the app is offline-first).

### Motion

| Token | Value | Use |
| --- | --- | --- |
| `--dur-fast` 150ms | hover/press feedback |
| `--dur-med` 250ms | enters, page transitions |
| `--dur-slow` 400ms | large/ceremonial moves |
| `--ease-out-expo` | default ease for enters |
| `--ease-spring` | attention pops (approval cards) |

Rules: animate `transform`/`opacity` only; stagger list entrances by
~50ms/item; **no always-on ambient animation** except the `NeuralCore`; any
looping CSS animation must be disabled in the `prefers-reduced-motion` block
in globals.css; React-side one-shots use `motion/react` (respect
`useReducedMotion`). Panels (`hud-panel`) are intentionally **not** backdrop-
blurred — they stack in large numbers and blur is the dominant compositing
cost; only a few chrome surfaces (sidebar, headers, status bar) add
`backdrop-blur-sm`.

## Utility vocabulary

`hud-panel` (near-opaque panel, no blur), `hud-corners` (bracket frame; tint
with `--corner-color` — use sparingly, on focal panels only), `glow` /
`glow-sm` / `text-glow`, `hud-grid`, `shimmer` (in-flight tool rows),
`animate-pulse-core`.

## Component inventory

### Primitives — `src/components/ui/`

`Button` (variants: default/secondary/outline/ghost/destructive/**hud** —
`hud` is the mono-uppercase command style), `Card` (+`corners` prop),
`Input`/`Textarea`, `Select`, `Badge` (tones: neutral/primary/warning/
success/destructive), `Meter` (segmented bar; auto-escalates primary → amber
\>75% → red >90%).

### HUD kit — `src/components/hud/`

| Component | Purpose |
| --- | --- |
| `NeuralCore` | **The AI's signature.** A node network with traveling pulses. `state: idle\|listening\|thinking\|streaming` eases drift amplitude + pulse speed + brightness — calm at idle, shifting/energized when thinking or talking. rAF-driven imperatively (no per-frame React renders), pauses when hidden, static under reduced motion. Boot, home, chat empty state, and the streaming indicator. |
| `AgentNode` / `agentColor()` / `agentIcon()` | Agent avatar + the identity lookup used everywhere |
| `AgentConstellation` | Hub-and-spoke topology; takes any agent list — built for multi-agent growth |
| `GridBackground` | Static shell backdrop (faint grid + soft radial glow), rendered once in `Shell` |
| `StatusBar` | Bottom instrument strip (heartbeat, readouts, clock) |
| `Typewriter` | Char-by-char reveal; instant under reduced motion |
| `StubPanel` | Designed placeholder for unbuilt roadmap features |

## Patterns

- **Page skeleton**: `<div className="h-full overflow-y-auto p-6">` →
  centered `max-w-*` column → `<header>` with `font-display` h1 + muted
  subtitle. See `HomePage`/`AgentsPage`.
- **Page transitions** live in `Shell` (`AnimatePresence`, fade/slide 250ms).
  New pages: add to `Page` union in `Sidebar.tsx` + `PAGES` map in `Shell.tsx`.
- **Approval = amber.** Anything asking the user for permission uses
  `--warning` framing (see `ApprovalCards`).
- **Data is mono.** If it's a number, id, tool name, or status, it renders in
  `font-mono`.
- **Stub → real**: new roadmap feature ships by replacing its `StubPanel` on
  Home (and its `SOON` sidebar row) with a real page/widget using the same
  panel vocabulary.

## Accessibility floor

Body text ≥4.5:1 contrast on `--background`; visible focus
(`focus-visible:outline-ring` or glow border); `cursor-pointer` on
clickables; icons from lucide only (no emoji); ambient motion killed under
`prefers-reduced-motion`; icon-only buttons need `aria-label`.
