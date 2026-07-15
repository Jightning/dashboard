# Design system — Observatory Atlas

The visual language is **Observatory Atlas**: a photographic plate rendered
in indigo-black, warm starlight gold, engraved warm-white hairlines, spectral
agent colors, and a computed ephemeris. The taste test for any new surface:
*"Would this look at home printed in a 19th-century star atlas, photographed
through a modern telescope?"* Dark-committed — there is no light theme in v1
(`:root` sets `color-scheme: dark` so native controls render dark too; the
token layer keeps a light theme possible later).

**The one rule:** components never hardcode colors, durations, or easings.
Everything comes from the tokens in `src/styles/globals.css`, consumed as
Tailwind utilities (`bg-primary`, `duration-(--dur-fast)`) or `var()`.

**Motion is deliberately restrained.** The interface itself stays calm — no
page-wide ambient animation. The app's sense of "life" is concentrated into
one element: the `NeuralCore` (below), which throbs gently at idle and shifts
around while the AI is thinking or talking. Everything else animates only in
response to a user action (hover, nav, message arrival). **The sky never
twinkles** — `GridBackground`'s star field is drawn once to canvas and never
animates; the only diffraction spikes that move are the `NetworkSphere`'s,
and only because the globe itself rotates (drag or idle auto-spin) — there is
no independent sparkle animation anywhere.

## Tokens (`src/styles/globals.css`)

### Color

| Token | Role |
| --- | --- |
| `--background` (Plate) / `--card` (Deep field) / `--surface-raised` (Nebula) | Elevation ladder, indigo-black, lighter as elevation rises |
| `--primary` (Starlight, warm gold) | Core color: actions, focus, active nav, glows |
| `--secondary` (Comet, cool blue) | Secondary emphasis — used sparingly |
| `--accent` / `--muted` | Hover surfaces / quiet fills |
| `--warning` (Flare, hot solar-flare orange) | **Approvals & attention** — approval = flare |
| `--success` (Aurora) / `--destructive` (Red giant) | Status green / danger red |
| `--border` / `--input` / `--grid-line` | Warm-white engraved hairlines (not cyan-tinted) |
| `--glow` | Shared box-shadow color for glow utilities — starlight |
| `--nebula-tint` | Violet radial-gradient tint for `GridBackground`'s nebula breath; consumed via `var()`, not mirrored into `@theme inline` |
| `--constellation-line` | `NetworkSphere` edge/hairline color, alpha-free so the rAF loop drives `stroke-opacity` for depth |
| `--agent-orchestrator/knowledge/research` | Agent identity hues — stellar spectral classes (see below) |

**Agent identity is a stellar spectral-class system**, not arbitrary hues:
`--agent-orchestrator` is Polaris (F-class gold-white), `--agent-knowledge`
is Vega (A-class violet-blue), `--agent-research` is Sirius (A-class ice
blue). **Adding an agent:** add a `--agent-<name>` token (pick a spectral-
class-appropriate value — hot/white for prominent roles, cooler for quieter
ones) + `@theme` alias, then an entry in `IDENTITY` in
`src/components/hud/AgentNode.tsx`. Everything else (nodes, constellation,
activity rows) picks it up.

### Type

- `font-display` — Cinzel. Engraved capitals, tracked wide
  (`tracking-[0.18em]`+), weight 400/600. Page titles and the wordmark only;
  never body. **Fallback:** if Cinzel reads "imperial fantasy" rather than
  "engraved atlas" in practice, swap to `@fontsource/julius-sans-one` — one
  import in `src/main.tsx`, one `--font-display` value in `globals.css`. Not
  currently exercised; Cinzel is the shipped choice.
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

`hud-panel` (near-opaque panel, no blur), `hud-corners` (chart-frame ticks —
short corner ticks + edge-midpoint ticks, reading as an engraved star-chart
border; tint with `--corner-color`, size with `--corner-size` — use sparingly,
on focal panels only), `glow` / `glow-sm` / `text-glow` (starlight-colored),
`shimmer` (in-flight tool rows, follows the starlight hue), `animate-pulse-core`.

## Component inventory

### Primitives — `src/components/ui/`

`Button` (variants: default/secondary/outline/ghost/destructive/**hud** —
`hud` is the mono-uppercase command style), `Card` (+`corners` prop),
`Input`/`Textarea`, `Select`, `Badge` (tones: neutral/primary/warning/
success/destructive), `Meter` (segmented bar; auto-escalates primary → flare
\>75% → destructive >90%).

### HUD kit — `src/components/hud/`

| Component | Purpose |
| --- | --- |
| `NeuralCore` | **The AI's signature.** A rotating spherical point network over a static gold heart-circle + corona ring — "corona star." `state: idle\|listening\|thinking\|streaming` eases drift amplitude + pulse speed + brightness — calm at idle, shifting/energized when thinking or talking. The corona itself never animates; only the mesh rotates. rAF-driven imperatively (no per-frame React renders), pauses when hidden, static under reduced motion. Boot, home, chat empty state, and the streaming indicator. |
| `NetworkSphere` | **The celestial globe** — data-driven interactive sphere rendering agent instances + context as a star chart. Primary nodes draw as diffraction-spike stars (a four-point cross of hairline `<line>`s, scaled and faded via `transform`/`stroke-opacity` in the same rAF loop, never filters); constellation edges render in a single hairline color (`--constellation-line`) with depth-driven opacity; one static graticule ring frames the sphere. Drag-to-rotate, hover info card, click-to-select — same props/API/interaction model regardless of the rendering change. Auto-spins when idle (3s after last interaction), pauses when hidden, static under reduced motion. Mounted via `AgentConstellation` on the Agents roster and both chat states. |
| `AgentNode` / `agentColor()` / `agentIcon()` | Agent avatar + the spectral-class identity lookup used everywhere |
| `AgentConstellation` | Hub-and-spoke topology; takes any agent list — built for multi-agent growth |
| `GridBackground` | The photographic plate backdrop: a static canvas star field (160 deterministically-seeded stars, mostly warm white with a few cool-blue stragglers, a handful with whisper-opacity diffraction crosses), two faint SVG great-circle graticule arcs, and a violet nebula-breath radial gradient at top (`--nebula-tint`). Rendered once in `Shell`, zero per-frame cost, no animation. |
| `StatusBar` | The **ephemeris strip** — heartbeat, caller-provided readouts, live-computed Julian Date + moon phase (name + illumination %, recomputed every 60s — the moon does not need 60fps), clock. The astronomy is real, tested math in `src/lib/astro.ts` (`julianDate()`, `moonPhase()`): structure encodes truth here, not just decoration. |
| `Typewriter` | Char-by-char reveal; instant under reduced motion |
| `StubPanel` | Designed placeholder for unbuilt roadmap features |

## Patterns

- **Page skeleton**: `<div className="h-full overflow-y-auto p-6">` →
  centered `max-w-*` column → `<header>` with `font-display` h1 + muted
  subtitle. See `HomePage`/`AgentsPage`.
- **Page transitions** live in `Shell` (`AnimatePresence`, fade/slide 250ms).
  New pages: add to `Page` union in `Sidebar.tsx` + `PAGES` map in `Shell.tsx`.
- **Approval = flare.** Anything asking the user for permission uses
  `--warning` framing (see `ApprovalCard`).
- **Wordmark**: Sidebar renders "HUGH" in Cinzel caps beside an inline
  four-point-star SVG glyph (not emoji — the no-emoji rule holds everywhere).
  No `text-glow` on the wordmark — it's engraving, not neon.
- **Data is mono.** If it's a number, id, tool name, or status, it renders in
  `font-mono`.
- **Stub → real**: new roadmap feature ships by replacing its `StubPanel` on
  Home (and its `SOON` sidebar row) with a real page/widget using the same
  panel vocabulary.

**Perf notes:** no per-frame SVG `filter`/`drop-shadow` (WSLg software
rendering chokes on them), no new `backdrop-blur` surfaces, the star field
renders once to canvas, diffraction spikes are plain `<line>` elements
animated via transform/opacity only through the existing single rAF loops
(`NetworkSphere`'s own loop; `NeuralCore`'s corona circles are fully static,
not animated at all). This is why the theme is cheap.

## Accessibility floor

Body text ≥4.5:1 contrast on `--background`; visible focus
(`focus-visible:outline-ring` or glow border); `cursor-pointer` on
clickables; icons from lucide only (no emoji); ambient motion killed under
`prefers-reduced-motion`; icon-only buttons need `aria-label`.
