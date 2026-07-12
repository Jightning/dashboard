# The Observatory Atlas — UI Art Direction & Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Visual tasks verify by running the app and comparing against the direction in §1; logic extracted along the way (astronomy math) is TDD'd like any other code.

**Goal:** Re-skin the entire dashboard from generic sci-fi HUD ("Jarvis cockpit") to a space theme with a specific point of view — a working astronomer's star atlas — while keeping every page, flow, component API, and the network graph structurally identical.

**Architecture:** The app already forbids hardcoded colors — everything consumes tokens from `src/styles/globals.css`. So the restyle lands in layers: (1) a token swap that retints the whole app at once, (2) a shape-language pass on the five components that *draw* rather than inherit (GridBackground, NetworkSphere, NeuralCore, hud-corners, StatusBar), (3) a typography/copy pass, (4) docs. Component names, class names (`hud-panel`, `hud-corners`, `glow`), and the `Page`/UX structure do not change — only what they render.

**Tech Stack:** Existing stack. One new font package: `@fontsource/cinzel` (OFL, $0). No other dependencies.

---

## 1. Art direction — "The Observatory Atlas"

### Thesis

Not space as *cockpit* (cyan HUDs, corner brackets, scanlines — the current look, and every AI dashboard's look), but space as *the thing astronomers actually make*: the deep-field photographic plate and the engraved star atlas laid over it. The interface is a chart of your own system — agents are constellations, sessions are star systems, tool calls are observations. Dark indigo plate, warm starlight, hairline graticules, engraved capitals, and stars drawn the way telescopes actually render them: with diffraction spikes.

One sentence to test every decision against: **"Would this look at home printed in a 19th-century star atlas, photographed through a modern telescope?"** Brackets, grids, and neon fail that test; ticks, arcs, spectral colors, and engraved caps pass it.

### What stays (the client's constraint, honored exactly)

- Every page, route, flow, and component API. The network graph remains the centerpiece — it *becomes* the celestial globe.
- The restraint philosophy: no page-wide ambient animation; the one living element stays the core (reskinned as a star's corona).
- The accessibility floor: ≥4.5:1 body contrast, visible focus, reduced-motion kills loops, lucide icons only (no emoji).
- Utility class names and token names — `hud-panel`, `--primary`, `--warning` keep their names so ~40 consuming files don't churn; their *values* change.

### Palette — photographic plate + starlight

| Token | Name | Value (oklch) | ~Hex | Role |
| --- | --- | --- | --- | --- |
| `--background` | Plate | `oklch(0.11 0.02 275)` | `#0A0A18` | The deep-field plate — darker and violet-shifted vs. today's navy |
| `--card` | Deep field | `oklch(0.14 0.022 272)` | `#111226` | Panel fill |
| `--surface-raised` | Nebula | `oklch(0.18 0.025 270)` | `#1A1B33` | Raised surfaces |
| `--primary` | Starlight | `oklch(0.85 0.09 85)` | `#EBCB8B` | **The identity shift: warm gold starlight replaces cyan.** Actions, focus, active nav, glow |
| `--secondary` | Comet | `oklch(0.75 0.09 240)` | `#7BA8D9` | Cool counterpoint, used sparingly |
| `--warning` | Flare | `oklch(0.72 0.17 45)` | `#F08C4A` | **Approvals & attention** — solar-flare orange (must read distinctly from gold; see critique) |
| `--success` | Aurora | `oklch(0.78 0.13 165)` | `#63D6A4` | Status green, aurora-tinted |
| `--destructive` | Red giant | `oklch(0.62 0.19 25)` | `#E85D4C` | Danger (barely moved — it worked) |
| `--border` | Hairline | `oklch(0.85 0.03 85 / 16%)` | — | Warm-white engraving lines replace cyan-tinted ones |
| `--glow` | — | `oklch(0.85 0.09 85 / 25%)` | — | All glow utilities become starlight |

Agent identity becomes **stellar spectral classes** — a real astronomical system, which is exactly the kind of structure-that-encodes-truth this direction wants:

| Token | Star | Value | Class |
| --- | --- | --- | --- |
| `--agent-orchestrator` | Polaris | `oklch(0.9 0.05 85)` | F — the gold-white navigation star at the hub |
| `--agent-knowledge` | Vega | `oklch(0.75 0.11 290)` | A — violet-blue (continuity with today's violet) |
| `--agent-research` | Sirius | `oklch(0.8 0.1 235)` | A — ice blue |
| *(future planner)* | Aurora | `oklch(0.78 0.13 165)` | — reuse `--success` family |

Custom agents pick any CSS color; the editor placeholder suggests spectral values.

### Typography — engraved caps over modern instrument text

| Role | Face | Treatment |
| --- | --- | --- |
| `--font-display` | **Cinzel** (replaces Orbitron) | The engraved brass-plate capitals of atlas cartouches. Page titles + wordmark only, tracked wide (`tracking-[0.18em]`+), weight 400/600. Never body text. |
| `--font-sans` | Space Grotesk (kept) | It's literally named for this brief and reads as clean instrument labeling. Keeping it also halves the churn. |
| `--font-mono` | JetBrains Mono (kept) | All data. But the *label pattern* changes: section labels lose the techno urgency (`text-[10px] uppercase tracking-wider` stays, cyan text-glow goes). |

### Signature element (the one memorable thing)

**Diffraction-spike stars on the celestial globe.** Primary nodes in `NetworkSphere` render as telescope stars — a bright point with a fine four-point cross of light — connected by hairline constellation lines, over a faint graticule ring. Nothing else in the app gets this treatment; the globe is where the boldness budget is spent. Supporting cast, kept quiet: a static star-field-plus-great-circle backdrop, and an ephemeris strip (status bar) showing Julian Date and moon phase — real, computed astronomy, not decoration.

### Motion & copy voice

- Motion rules unchanged: only the core animates ambiently; everything else responds to user action; reduced-motion kills loops. The core's reskin (Task 4) shifts its metaphor from "neural net" to "star + corona" without touching its rAF architecture.
- Copy: **flavor lives in subtitles, empty states, and status readouts; functional labels stay plain.** "Chat" stays "Chat"; the boot line becomes "developing the plate · charting constellations · syncing the ephemeris". Errors keep explaining exactly what happened — the observatory voice is calm and precise, never mystical.

### Self-critique (run before building, per the design process)

- *Is gold-on-near-black just default #2 (dark + single accent)?* It would be if gold were the only move. The direction survives without it: spectral agent colors, graticule geometry, diffraction spikes, engraved caps, and computed ephemeris data are the identity; gold is the lighting. Also the accent isn't acid — it's warm starlight against a violet plate, plus a systematic multi-hue star palette.
- *Named risk:* gold + serif caps can drift toward "luxury hotel". Counterweights: the scientific apparatus everywhere (mono data, graticule hairlines at ≤16% alpha, spectral classification), Cinzel confined to titles, and zero gradients on panels. If Cinzel still reads too imperial in situ, the documented fallback is **Julius Sans One** (engraved *sans* caps) — swap is one token + one import.
- *Rejected:* Mission-control CRT amber (still a cockpit — the thing the client called generic) and JWST nebula gradients (gradient-dark-mode is its own template).

## 2. Vocabulary map (old → new)

| Element | Today (HUD) | Atlas treatment |
| --- | --- | --- |
| Backdrop | Blueprint grid + cyan glow | Static star field (canvas, drawn once) + two faint great-circle arcs + violet nebula breath at top |
| `hud-corners` | Corner brackets | Cartographic frame ticks: fine ticks at corners **and** edge midpoints, like an engraved chart border |
| `glow`/`text-glow` | Cyan halo | Warm starlight halo (token swap only) |
| Network graph | Colored circles + colored edges | Diffraction-spike stars; hairline warm-white constellation lines; graticule ring; star-designation labels (letterspaced caps) |
| NeuralCore | Neural mesh | Corona star: same mesh, gold star points, brighter center, violet accent points |
| StatusBar | "sys online" + clock | Ephemeris strip: "telemetry nominal" + Julian Date + moon phase + clock |
| Approval cards | Amber brackets | Flare-orange frame ticks (same amber-means-ask rule, hotter hue) |
| Wordmark | Orbitron "Hugh" | Cinzel "HUGH" with a 4-point star glyph (inline SVG, not emoji) |
| Boot copy | "migrating db · loading keys · linking providers" | "developing the plate · charting constellations · syncing the ephemeris" |
| Shimmer | Cyan sweep | Starlight sweep (token follows `--primary` — update the literal) |

## Global Constraints

- **Perf (hard, learned on this machine):** no per-frame SVG `filter`/`drop-shadow`, no new `backdrop-blur` surfaces — WSLg software rendering chokes on them (see docs/design.md's blur note). Star field renders **once** to a canvas; diffraction spikes are plain `<line>` elements animated by the existing single rAF via transforms/opacity only.
- No ambient animation outside the core. Star field does **not** twinkle. Under `prefers-reduced-motion` the corona freezes exactly as the mesh does today.
- Contrast floor: body text ≥4.5:1 on `--background`; verify `--muted-foreground` (`oklch(0.68 0.02 265)`) against the darker plate before committing Task 1.
- Components never hardcode colors — the rule that makes this plan cheap stays law. Any literal oklch found while editing gets tokenized, not re-hardcoded.
- Class names, component names, props, tests, and UX structure unchanged. `npm test && npm run typecheck` green before every commit.
- Fonts self-hosted via @fontsource (CSP blocks CDNs). New dep: `@fontsource/cinzel` only.

## File structure

```txt
Create:
  src/lib/astro.ts                       julianDate(), moonPhase() (pure, tested)
  src/lib/astro.test.ts
Modify:
  src/styles/globals.css                 token values, hud-corners ticks, shimmer hue,
                                         selection/scrollbar tints, font-display
  src/main.tsx                           @fontsource/cinzel imports (drop orbitron)
  package.json                           swap @fontsource/orbitron → @fontsource/cinzel
  src/components/hud/GridBackground.tsx  star field + graticule backdrop
  src/components/hud/NetworkSphere.tsx   diffraction spikes, constellation edges,
                                         graticule ring, label/tooltip styling
  src/components/hud/NeuralCore.tsx      corona-star constants (colors, center weight)
  src/components/hud/StatusBar.tsx       ephemeris strip
  src/components/hud/AgentNode.tsx       spectral IDENTITY values (token-driven — verify only)
  src/app/Sidebar.tsx                    wordmark + star glyph
  src/App.tsx                            boot copy
  src/app/home/HomePage.tsx              subtitle/empty-state copy
  src/components/chat/ApprovalCard.tsx   flare framing (mostly token-driven — verify)
  docs/design.md                         rewritten for the Atlas system
Delete: (nothing)
```

---

### Task 1: the token swap — retint the whole app in one commit

**Files:**
- Modify: `src/styles/globals.css`, `src/main.tsx`, `package.json`

**Interfaces:**
- Produces: the full Atlas palette under the existing token names. Every later task assumes these values. `--font-display` becomes Cinzel.

- [ ] **Step 1: Swap the display font package**

```bash
npm uninstall @fontsource/orbitron && npm install @fontsource/cinzel
```

In `src/main.tsx`, replace the orbitron import(s) with:

```ts
import "@fontsource/cinzel/400.css";
import "@fontsource/cinzel/600.css";
```

- [ ] **Step 2: Replace the `:root` token block in `globals.css`**

Replace the values (comments updated to match — the header comment becomes "Observatory Atlas design tokens"):

```css
:root {
    /* Surfaces — the photographic plate: indigo-black, lighter as elevation rises */
    --background: oklch(0.11 0.02 275);
    --foreground: oklch(0.93 0.01 90);
    --card: oklch(0.14 0.022 272);
    --card-foreground: oklch(0.93 0.01 90);
    --surface-raised: oklch(0.18 0.025 270);

    /* Starlight — the warm core color that replaced holographic cyan */
    --primary: oklch(0.85 0.09 85);
    --primary-foreground: oklch(0.18 0.04 80);
    --secondary: oklch(0.75 0.09 240);
    --secondary-foreground: oklch(0.12 0.02 275);

    --muted: oklch(0.18 0.02 270);
    --muted-foreground: oklch(0.68 0.02 265);
    --accent: oklch(0.21 0.03 270);
    --accent-foreground: oklch(0.95 0.01 90);

    /* Status. --warning is "flare": approvals & attention, hotter than starlight */
    --destructive: oklch(0.62 0.19 25);
    --destructive-foreground: oklch(0.97 0.01 90);
    --warning: oklch(0.72 0.17 45);
    --warning-foreground: oklch(0.16 0.05 45);
    --success: oklch(0.78 0.13 165);
    --success-foreground: oklch(0.16 0.05 165);

    /* Engraving lines & focus — warm-white hairlines, not cyan */
    --border: oklch(0.85 0.03 85 / 16%);
    --input: oklch(0.85 0.03 85 / 24%);
    --ring: oklch(0.85 0.09 85);
    --grid-line: oklch(0.8 0.04 260 / 5%);
    --glow: oklch(0.85 0.09 85 / 25%);

    /* Agent identity — stellar spectral classes; add a token per new agent */
    --agent-orchestrator: oklch(0.9 0.05 85);   /* Polaris */
    --agent-knowledge: oklch(0.75 0.11 290);    /* Vega */
    --agent-research: oklch(0.8 0.1 235);       /* Sirius */

    --radius: 0.375rem;
    color-scheme: dark;
    accent-color: var(--primary);

    --dur-fast: 150ms;
    --dur-med: 250ms;
    --dur-slow: 400ms;
    --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
    --ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
}
```

- [ ] **Step 3: Sweep the literal oklch values elsewhere in `globals.css`**

These bypass tokens today; make them follow the new palette:

- `--font-display: "Cinzel", "Space Grotesk Variable", serif;` in the `@theme inline` block.
- `::selection` → `background: oklch(0.85 0.09 85 / 25%);`
- Scrollbar thumb → `oklch(0.85 0.03 85 / 20%)`, hover → `oklch(0.85 0.09 85 / 40%)`.
- `hud-corners` default `--corner-color` → `oklch(0.85 0.09 85 / 45%)` (shape changes in Task 2).
- `shimmer` gradient midpoint → `oklch(0.85 0.09 85 / 10%)`.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm test` — Expected: clean (tokens are data, not types).
Manual sweep (`npm run dev`): every page reads warm starlight-on-plate; approval cards render flare orange and remain clearly distinct from gold primary buttons (put an ApprovalCard and a default Button side by side in chat to confirm); check `--muted-foreground` legibility on `--background` (WebAIM ratio from the hex approximations; must be ≥4.5:1 — if short, raise L to 0.7). Page titles render in Cinzel capitals — set page `<h1>`s' visual check: they already use `font-display` + `tracking-wide`, which Cinzel needs; note any title that now wraps.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/main.tsx src/styles/globals.css
git commit -m "art: Observatory Atlas palette + Cinzel display face"
```

### Task 2: backdrop and frame language (GridBackground + hud-corners)

**Files:**
- Modify: `src/components/hud/GridBackground.tsx`, `src/styles/globals.css`

**Interfaces:**
- Produces: `GridBackground` (same name/usage in Shell) renders the star-field plate; `hud-corners` draws chart ticks. `hud-grid` utility becomes unused by the app but keeps working (notes panels may use it — grep before deleting; if unused, delete the utility).

- [ ] **Step 1: Rewrite `GridBackground.tsx`**

Star field drawn once to a canvas (no React re-renders, no animation, DPR-aware), plus an SVG graticule of two great-circle arcs, plus the nebula breath. Density is deliberately sparse — a plate, not a screensaver:

```tsx
import { useEffect, useRef } from "react";

/**
 * The photographic plate: a static star field (drawn once to canvas), two
 * faint great-circle graticule arcs, and a violet nebula breath at the top.
 * Deliberately static — the sky does not blink. Same perf contract as before:
 * zero per-frame work, no filters, no blur.
 */
export function GridBackground() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(dpr, dpr);

        // Deterministic layout so the sky doesn't reshuffle between mounts.
        let seed = 137;
        const rand = () => {
            seed = (seed * 16807) % 2147483647;
            return seed / 2147483647;
        };

        const STARS = 160;
        for (let i = 0; i < STARS; i++) {
            const x = rand() * w;
            const y = rand() * h;
            const mag = rand(); // brightness class
            const r = mag < 0.85 ? 0.6 : mag < 0.97 ? 1.1 : 1.7;
            // Mostly warm white, a few cool blue stragglers.
            const warm = rand() > 0.25;
            ctx.fillStyle = warm
                ? `oklch(0.9 0.03 85 / ${0.25 + mag * 0.5})`
                : `oklch(0.85 0.05 240 / ${0.25 + mag * 0.4})`;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
            // The brightest few get a fine diffraction cross — the signature,
            // whispered here, spoken at full volume on the network globe.
            if (mag > 0.97) {
                ctx.strokeStyle = `oklch(0.9 0.03 85 / 0.25)`;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(x - r * 5, y);
                ctx.lineTo(x + r * 5, y);
                ctx.moveTo(x, y - r * 5);
                ctx.lineTo(x, y + r * 5);
                ctx.stroke();
            }
        }
    }, []);

    return (
        <div
            aria-hidden
            className="pointer-events-none fixed inset-0 overflow-hidden"
        >
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
            {/* Graticule: two great-circle arcs, engraved at whisper opacity */}
            <svg
                className="absolute inset-0 h-full w-full"
                preserveAspectRatio="xMidYMid slice"
                viewBox="0 0 100 100"
            >
                <ellipse
                    cx="50"
                    cy="18"
                    rx="85"
                    ry="38"
                    fill="none"
                    stroke="var(--grid-line)"
                    strokeWidth="0.1"
                />
                <ellipse
                    cx="42"
                    cy="120"
                    rx="95"
                    ry="55"
                    fill="none"
                    stroke="var(--grid-line)"
                    strokeWidth="0.1"
                />
            </svg>
            <div
                className="absolute inset-0"
                style={{
                    background:
                        "radial-gradient(ellipse 80% 50% at 50% -10%, oklch(0.45 0.09 300 / 7%), transparent 70%)",
                }}
            />
        </div>
    );
}
```

(Resize handling: the canvas draws at mount size; a window resize leaves it letterboxed until next mount. Acceptable for a desktop shell — if it bothers in practice, re-run the draw in a debounced `resize` listener; still zero steady-state cost.)

- [ ] **Step 2: Re-draw `hud-corners` as cartographic frame ticks**

Replace the utility's gradient stack in `globals.css` — corners keep short L-ticks, and each edge gains a midpoint tick, which reads as an engraved chart border rather than a targeting bracket:

```css
/* Chart-frame ticks: short corner ticks + edge midpoint ticks, like the
   border of an engraved star chart. Tint via --corner-color. */
@utility hud-corners {
    --corner-color: oklch(0.85 0.09 85 / 45%);
    --corner-size: 8px;
    background-image:
        /* corner ticks: horizontal then vertical, all four corners */
        linear-gradient(var(--corner-color), var(--corner-color)),
        linear-gradient(var(--corner-color), var(--corner-color)),
        linear-gradient(var(--corner-color), var(--corner-color)),
        linear-gradient(var(--corner-color), var(--corner-color)),
        linear-gradient(var(--corner-color), var(--corner-color)),
        linear-gradient(var(--corner-color), var(--corner-color)),
        linear-gradient(var(--corner-color), var(--corner-color)),
        linear-gradient(var(--corner-color), var(--corner-color)),
        /* midpoint ticks: top, bottom, left, right */
        linear-gradient(var(--corner-color), var(--corner-color)),
        linear-gradient(var(--corner-color), var(--corner-color)),
        linear-gradient(var(--corner-color), var(--corner-color)),
        linear-gradient(var(--corner-color), var(--corner-color));
    background-repeat: no-repeat;
    background-size:
        var(--corner-size) 1px, 1px var(--corner-size),
        var(--corner-size) 1px, 1px var(--corner-size),
        var(--corner-size) 1px, 1px var(--corner-size),
        var(--corner-size) 1px, 1px var(--corner-size),
        var(--corner-size) 1px, var(--corner-size) 1px,
        1px var(--corner-size), 1px var(--corner-size);
    background-position:
        top left, top left,
        top right, top right,
        bottom left, bottom left,
        bottom right, bottom right,
        top center, bottom center,
        left center, right center;
}
```

Also: `grep -rn "hud-grid" src/` — if `GridBackground` was its only consumer, delete the `hud-grid` utility block.

- [ ] **Step 3: Verify + commit**

Run: `npm run typecheck && npm test`. Manual: backdrop shows a sparse, still star field with two barely-there arcs; no visible seams; approval cards and focal panels show the new tick frame; CPU stays flat at idle (watch the WSLg window — the plate must cost nothing).

```bash
git add src/components/hud/GridBackground.tsx src/styles/globals.css
git commit -m "art: star-field plate backdrop + cartographic frame ticks"
```
### Task 3: the celestial globe — diffraction-spike stars on NetworkSphere

The signature. Everything bold in this restyle happens here; every other surface stays quiet so this one can speak.

**Files:**
- Modify: `src/components/hud/NetworkSphere.tsx`

**Interfaces:**
- Consumes/produces: no API change — same `nodes`/`edges`/`size`/`onSelect` props, same single-rAF architecture, same hit-circle interaction. Only rendering changes. (`AgentConstellation` and both pages that mount the sphere need zero edits.)

**The three rendering changes:**

1. **Stars, not discs.** Primary nodes (`n.primary`) gain a four-point diffraction cross: two thin `<line>` elements in a `<g>` per node, colored by the node, length ~3.2× the node radius, opacity tied to the node's projected depth. Non-primary nodes (tools/context) stay small plain circles — background stars. The existing core circle stays (it's the star's body); spikes render *behind* it in paint order.
2. **Constellation lines, not colored wires.** Edges switch from per-node color at 0.15 to a single hairline: `stroke="oklch(0.85 0.03 85 / 1)"` with the existing depth-driven `stroke-opacity` scaled to a 0.04–0.18 range, `strokeWidth 0.35`. Reading: faint engraved lines connecting stars, exactly like a printed constellation figure.
3. **The graticule ring.** One static `<circle>` at the sphere's projected equator radius (`cx/cy` center, `r` = sphere radius in viewBox units), `stroke="var(--grid-line)"`, `strokeWidth 0.3`, `fill="none"` — drawn first so everything renders inside a chart circle, the way every star atlas frames its maps.

- [ ] **Step 1: Add the spike elements**

In the JSX, immediately before the visible-node `<circle>` map, add a parallel map producing the spike groups, mirroring the `labelEls` ref-array pattern already in the file:

```tsx
{/* Diffraction spikes — primary stars only, positioned by the rAF loop */}
{nodes.map((n, i) =>
    n.primary ? (
        <g
            key={`spike-${n.id}`}
            ref={(el) => {
                spikeEls.current[i] = el;
            }}
            stroke={n.color}
            strokeWidth={0.4}
        >
            <line x1={-1} y1={0} x2={1} y2={0} />
            <line x1={0} y1={-1} x2={0} y2={1} />
        </g>
    ) : null,
)}
```

with the companion ref beside the existing ones:

```tsx
const spikeEls = useRef<(SVGGElement | null)[]>([]);
```

- [ ] **Step 2: Drive them from the existing rAF loop**

In the per-node section of the animation loop (where the node circle's `cx/cy/r/fill-opacity` are set), add — transforms and opacity only, no filters:

```tsx
const spike = spikeEls.current[i];
if (spike) {
    const len = node.r * rScale * 3.2;
    spike.setAttribute(
        "transform",
        `translate(${p.cx} ${p.cy}) scale(${len})`,
    );
    // Slightly dimmer than the star body; vanishes with depth like everything else.
    spike.setAttribute("stroke-opacity", String(op * 0.55));
    // Keep hairline weight constant regardless of scale.
    spike.setAttribute("stroke-width", String(0.4 / len));
}
```

(`p`, `op`, `rScale` are the loop's existing projected-position, opacity, and radius-scale locals — reuse whatever those are actually named.)

- [ ] **Step 3: Constellation edges + graticule ring + labels**

- Edge elements: change `stroke={nodes[e.ai]!.color}` → `stroke="oklch(0.85 0.03 85)"`, `strokeWidth={0.35}`; in the loop where `stroke-opacity` is computed from depth, scale its output by ~0.7 so the range lands near 0.04–0.18.
- Before all node/edge rendering, add the chart circle (static, outside the rAF):

```tsx
<circle
    cx={CENTER}
    cy={CENTER}
    r={SPHERE_R}
    fill="none"
    stroke="var(--grid-line)"
    strokeWidth={0.3}
/>
```

(`CENTER`/`SPHERE_R` = the component's existing viewBox center and sphere radius constants — reuse their real names.)
- Labels become star designations: on the `<text>` elements add `letterSpacing="0.12em"` and render `{truncate(n.label).toUpperCase()}`; keep the existing font-size/positioning/opacity logic.
- Tooltip ("star card"): in the hover card div, retitle visually — the title line gains `tracking-wider uppercase`; everything else (chips, body, foot) is already token-styled and needs nothing.

- [ ] **Step 4: Verify + commit**

Run: `npm run typecheck && npm test` — Expected: clean (the sphere has no unit tests; the networkData builders' tests are untouched).
Manual, on all three mounts (Agents roster, Chat empty state, Chat instances): primary stars show fine crosses that rotate with the globe and dim with depth; edges read as faint engraved lines; the chart circle frames the globe; hover still raises the star card; click still navigates; drag/rotation performance is unchanged from today (same element count class — ~N extra `<g>` transforms in the existing loop). Under `prefers-reduced-motion` the globe behaves exactly as it does today.

```bash
git add src/components/hud/NetworkSphere.tsx
git commit -m "art: celestial globe — diffraction-spike stars, constellation lines, graticule"
```

### Task 4: NeuralCore becomes the corona star

**Files:**
- Modify: `src/components/hud/NeuralCore.tsx`

**Interfaces:**
- No API change: same `size`/`state`/`className` props, same rAF/perf/reduced-motion contract. Boot screen, Home, chat empty state, and streaming indicator keep working untouched.

- [ ] **Step 1: Reskin by constants, not architecture**

The mesh already breathes correctly; it just wears the wrong colors and reads "neural net" instead of "star". Three changes, all in existing constants/attributes (exact names verified in-file when editing):

1. Base node/edge color follows `--primary` (it should already — after Task 1 the mesh is gold; verify no literal cyan remains in the file).
2. `ACCENT` stays `var(--agent-knowledge)` — now Vega violet: a gold star with a few violet points reads as a star cluster; nothing to change but confirm.
3. Give it a heart: add one static circle at the sphere center, radius ~7% of size, `fill="var(--primary)"`, `fillOpacity 0.9`, plus a concentric corona ring `r` ~11%, `fill="none"`, `stroke="var(--primary)"`, `strokeOpacity 0.25`, `strokeWidth 1`. Both rendered before the mesh so points pass in front. The existing state-driven brightness/drift logic already animates around them — the center reads as the star, the mesh as its corona.

- [ ] **Step 2: Verify + commit**

Run: `npm run typecheck && npm test`. Manual: boot screen shows a gold star waking up; `state="thinking"` visibly energizes; reduced-motion shows a static star; no new per-frame attribute writes beyond what existed.

```bash
git add src/components/hud/NeuralCore.tsx
git commit -m "art: NeuralCore reads as a corona star"
```

### Task 5: the ephemeris strip (StatusBar) + real astronomy math

The status bar becomes an almanac line — and the astronomy is *computed, not painted*: Julian Date and moon phase are pure functions with unit tests. This is the "structure encodes truth" principle applied to decoration.

**Files:**
- Create: `src/lib/astro.ts`
- Modify: `src/components/hud/StatusBar.tsx`
- Test: `src/lib/astro.test.ts`

**Interfaces:**
- Produces: `julianDate(ms: number): number`; `moonPhase(ms: number): { ageDays: number; illumination: number; name: string }` with names `"new" | "waxing crescent" | "first quarter" | "waxing gibbous" | "full" | "waning gibbous" | "last quarter" | "waning crescent"`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/astro.test.ts
import { describe, expect, it } from "vitest";
import { julianDate, moonPhase } from "./astro";

// Reference new moon: 2000-01-06 18:14 UTC.
const EPOCH = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC_DAYS = 29.530588853;
const DAY = 86_400_000;

describe("julianDate", () => {
    it("matches the Unix-epoch identity", () => {
        // 1970-01-01T00:00Z is JD 2440587.5 by definition.
        expect(julianDate(0)).toBeCloseTo(2440587.5, 6);
    });

    it("advances one unit per day", () => {
        expect(julianDate(DAY) - julianDate(0)).toBeCloseTo(1, 9);
    });
});

describe("moonPhase", () => {
    it("is new at the reference epoch", () => {
        const m = moonPhase(EPOCH);
        expect(m.ageDays).toBeCloseTo(0, 3);
        expect(m.illumination).toBeCloseTo(0, 3);
        expect(m.name).toBe("new");
    });

    it("is full half a synodic month later", () => {
        const m = moonPhase(EPOCH + (SYNODIC_DAYS / 2) * DAY);
        expect(m.illumination).toBeGreaterThan(0.99);
        expect(m.name).toBe("full");
    });

    it("waxes through first quarter at ~50% lit", () => {
        const m = moonPhase(EPOCH + (SYNODIC_DAYS / 4) * DAY);
        expect(m.illumination).toBeCloseTo(0.5, 1);
        expect(m.name).toBe("first quarter");
    });

    it("wanes after full", () => {
        const m = moonPhase(EPOCH + SYNODIC_DAYS * 0.7 * DAY);
        expect(m.name).toContain("waning");
    });
});
```

Run: `npx vitest run src/lib/astro.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 2: Implement `src/lib/astro.ts`**

```ts
/** Astronomy for the ephemeris strip. Approximations good to the display's
 *  precision (JD to 0.1 day; moon phase to ~half a day) — not for navigation. */

const DAY = 86_400_000;
const SYNODIC_DAYS = 29.530588853;
/** A reference new moon: 2000-01-06 18:14 UTC. */
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14);

/** Julian Date from a Unix timestamp (ms). JD 2440587.5 = 1970-01-01T00:00Z. */
export function julianDate(ms: number): number {
    return ms / DAY + 2440587.5;
}

const PHASE_NAMES = [
    "new",
    "waxing crescent",
    "first quarter",
    "waxing gibbous",
    "full",
    "waning gibbous",
    "last quarter",
    "waning crescent",
] as const;

export function moonPhase(ms: number): {
    ageDays: number;
    illumination: number;
    name: (typeof PHASE_NAMES)[number];
} {
    const ageDays =
        (((ms - NEW_MOON_EPOCH) / DAY) % SYNODIC_DAYS + SYNODIC_DAYS) %
        SYNODIC_DAYS;
    const illumination =
        (1 - Math.cos((2 * Math.PI * ageDays) / SYNODIC_DAYS)) / 2;
    // Eight octants centered on the cardinal phases.
    const octant =
        Math.floor(((ageDays / SYNODIC_DAYS) * 8 + 0.5) % 8);
    return { ageDays, illumination, name: PHASE_NAMES[octant]! };
}
```

Run: `npx vitest run src/lib/astro.test.ts` — Expected: PASS.

- [ ] **Step 3: Restyle `StatusBar.tsx` into the ephemeris strip**

Same component shape; heartbeat copy changes, two readouts added (computed once a minute — the moon does not need 60fps):

```tsx
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { julianDate, moonPhase } from "@/lib/astro";

/**
 * Bottom shell strip, styled as an observatory almanac line: telemetry
 * heartbeat, caller-provided readouts, live ephemeris (JD + moon), clock.
 */
export function StatusBar({ children }: { children?: ReactNode }) {
    return (
        <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-border bg-background/85 px-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-1.5">
                <span className="animate-pulse-core h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_6px_var(--success)]" />
                telemetry nominal
            </span>
            {children}
            <span className="flex-1" />
            <Ephemeris />
            <Clock />
        </footer>
    );
}

function Ephemeris() {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(timer);
    }, []);
    const moon = moonPhase(now);
    return (
        <>
            <span>jd {julianDate(now).toFixed(1)}</span>
            <span>
                {moon.name} {Math.round(moon.illumination * 100)}%
            </span>
        </>
    );
}

function Clock() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    return (
        <time dateTime={now.toISOString()}>
            {now.toLocaleTimeString(undefined, { hour12: false })}
        </time>
    );
}
```

- [ ] **Step 4: Verify + commit**

Run: `npm test && npm run typecheck` — Expected: PASS. Manual: strip reads like `● telemetry nominal · db linked · google/gemini-2.5-flash · jd 2461233.9 · waxing gibbous 82% · 21:41` and the moon value matches any almanac to within a day.

```bash
git add src/lib/astro.ts src/lib/astro.test.ts src/components/hud/StatusBar.tsx
git commit -m "art: ephemeris strip with computed Julian date + moon phase"
```
### Task 6: chrome, copy, and the component sweep

**Files:**
- Modify: `src/app/Sidebar.tsx`, `src/App.tsx`, `src/app/home/HomePage.tsx`
- Verify-only (token-driven, touch only if a literal survives): `src/components/chat/ApprovalCard.tsx`, `src/components/hud/AgentNode.tsx`, `src/components/ui/*` (Button/Badge/Meter/Card), `src/components/chat/TokenMeter.tsx`

**Interfaces:** none — leaf styling and copy.

- [ ] **Step 1: Wordmark and sidebar**

In `Sidebar.tsx`, the brand block becomes an engraved cartouche — Cinzel caps with a four-point star glyph (inline SVG; the no-emoji rule stands):

```tsx
<div className="px-4 pb-4 pt-5">
    <div className="flex items-center gap-2">
        <svg
            aria-hidden
            viewBox="0 0 12 12"
            className="h-3 w-3 text-primary"
        >
            {/* Four-point star — the app's mark, echoing the globe's spikes */}
            <path
                fill="currentColor"
                d="M6 0 L7.1 4.9 L12 6 L7.1 7.1 L6 12 L4.9 7.1 L0 6 L4.9 4.9 Z"
            />
        </svg>
        <div className="font-display text-lg font-semibold tracking-[0.25em] text-primary">
            HUGH
        </div>
    </div>
    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        personal observatory
    </div>
</div>
```

(Drop the `text-glow` from the wordmark — engraving, not neon. Cinzel is caps-native; the literal string becomes uppercase.) Section headings (`Command` / `Workspace` / `Config`) keep their treatment — they already read as chart labels.

- [ ] **Step 2: Boot + voice pass (flavor in ambience, function in labels)**

- `src/App.tsx` BootScreen: wordmark line matches the sidebar treatment (`HUGH`, no glow class); Typewriter line → `"developing the plate · charting constellations · syncing the ephemeris"`.
- `src/app/home/HomePage.tsx`: subtitle `"All systems nominal — awaiting directive."` → `"Clear skies. The plate is developed — what are we looking for?"`. Stat labels stay exactly as they are (they're functional).
- Shell's StatusBar children: `"db linked"` → `"plate archived"` is tempting — **don't**. It's a functional status; keep it literal.
- Agents page subtitle (whichever plan's version is live): keep the permission sentence verbatim — it's the product's core promise, not flavor.

- [ ] **Step 3: The verify-only sweep**

For each file below, `grep -n "oklch\|#[0-9a-fA-F]\{3,6\}" <file>` and confirm zero literals (the design rule says there should be none); fix by tokenizing anything found. Then eyeball in the running app:

| Surface | Expected read after Tasks 1–5 |
| --- | --- |
| `ApprovalCard.tsx` | Flare-orange tick frame + `--warning` copy; the one literal shadow (`shadow-[0_0_18px_oklch(0.79_0.14_80/20%)]`) **must** be updated → `shadow-[0_0_18px_oklch(0.72_0.17_45/20%)]` |
| `AgentNode.tsx` | IDENTITY map is token-driven (`var(--agent-*)`) — Polaris/Vega/Sirius arrive free; confirm the fallback color for unknown agents still contrasts on Plate |
| `Button` `hud` variant | Mono caps + starlight border — verify, no change expected |
| `Meter` | Escalation gold → flare → red giant comes from tokens — verify the >75%/>90% steps still read as escalation now that primary is warm |
| `TokenMeter`, `Composer`, `MessageList` | Token-driven; verify streaming shimmer reads as starlight sweep |

- [ ] **Step 4: Verify + commit**

Run: `npm test && npm run typecheck`. Manual: full click-through of every page; screenshot Home, Chat (with a pending approval), Agents globe, and Settings; check each against §1's test sentence — anything that still reads "cockpit" gets a note in the commit body for Task 7's punch list.

```bash
git add src/app/Sidebar.tsx src/App.tsx src/app/home/HomePage.tsx src/components/chat/ApprovalCard.tsx
git commit -m "art: cartouche wordmark, observatory voice, literal-color sweep"
```

### Task 7: rewrite docs/design.md + final QA

**Files:**
- Modify: `docs/design.md`

**Interfaces:** none — but this file is the contract every future UI change (including plan.md / plan_2.md tasks) reads first, so it must describe the Atlas system, not the HUD.

- [ ] **Step 1: Rewrite `docs/design.md`**

Keep the document's structure (tokens → type → motion → utilities → components → patterns → a11y) and its rules; update the identity. The sections that change:

- Header: visual language is **"Observatory Atlas"** — photographic plate, starlight gold, engraved hairlines, spectral agent colors, computed ephemeris. Include §1's test sentence as the taste heuristic.
- Color table: the Task 1 palette with the star names (Plate, Starlight, Comet, Flare, Aurora, Red giant); the rule **"Approval = flare"** replaces "Approval = amber" (same token, same meaning: `--warning` framing on anything that asks permission).
- Agent colors: document the spectral-class system and that new agents should pick from it (`--agent-<name>` token + `IDENTITY` entry, unchanged mechanics).
- Type: Cinzel display (titles/wordmark only, caps, tracked ≥0.18em; never body), Space Grotesk body, JetBrains Mono data. Note the documented fallback (Julius Sans One) and when to pull that lever.
- Motion: unchanged rules; NeuralCore's description becomes the corona star; add: **the sky never twinkles** — GridBackground stays static, spikes animate only via the globe's existing rotation.
- Utilities: `hud-corners` now documented as chart-frame ticks; `hud-grid` removed (if deleted in Task 2); `glow` = starlight.
- Component inventory: NetworkSphere entry describes diffraction spikes/constellation lines/graticule; StatusBar becomes the ephemeris strip (and note `src/lib/astro.ts` as its tested math).
- Perf notes: carry forward verbatim the no-per-frame-filters / no-stacked-blur rules — they are why this theme is cheap.

- [ ] **Step 2: Final QA pass (the mirror check)**

1. `npm test && npm run typecheck` — green.
2. Contrast audit: `--muted-foreground`, `--primary-foreground` on gold buttons, flare text on plate — all ≥4.5:1 (WebAIM on the hex approximations).
3. Reduced-motion: OS toggle on → corona static, shimmer off, globe still rotates only on drag (same as today's contract).
4. Perf: idle CPU flat with the app visible under WSLg; globe drag smooth on the Agents page with 10+ agents seeded.
5. The Chanel pass — remove one accessory: view every page and delete the least-earning decorative element found (candidate list from Task 6 screenshots). Commit whatever it was; if genuinely nothing, say so in the commit message.
6. Cinzel verdict: if the wordmark/titles read "imperial fantasy" rather than "engraved atlas" in situ, execute the documented fallback (swap `@fontsource/cinzel` → `@fontsource/julius-sans-one`, one import + one token line) before closing the plan.

- [ ] **Step 3: Commit**

```bash
git add docs/design.md
git commit -m "art: design.md now documents the Observatory Atlas system"
```

---

## Final verification

1. Side-by-side smoke: `git stash`-era screenshots (or the pre-Task-1 commit) vs. now — same layouts, same interactions, entirely different world. The client's test: *cool but not generic*.
2. Every acceptance behavior from plan.md/plan_2.md still passes untouched — this plan changed zero logic outside `src/lib/astro.ts` (which only added).
3. The three mounts of the globe all show the signature; nothing else in the app competes with it.
4. `grep -rn "Orbitron" src/` → nothing; `grep -rn "0.8 0.125 210" src/` (old cyan) → nothing.

## Execution handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, screenshots reviewed between tasks (superpowers:subagent-driven-development).
2. **Inline Execution** — task-by-task with visual checkpoints (superpowers:executing-plans).

Tasks 1–2 are the 80% win (palette + backdrop); 3 is the signature; 4–7 finish the world. They must land in order — every later task assumes Task 1's tokens.
