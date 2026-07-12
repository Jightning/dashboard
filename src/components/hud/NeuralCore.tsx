import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { fibonacciSphere, project, type Vec3 } from "./sphere";

export type CoreState = "idle" | "listening" | "thinking" | "streaming";

interface SphereNode extends Vec3 {
    /** Base draw radius (viewBox units). */
    r: number;
    /** Accent nodes use the violet knowledge hue instead of the base color. */
    accent: boolean;
}

interface Sphere {
    nodes: SphereNode[];
    edges: [number, number][];
}

const ACCENT = "var(--agent-knowledge)";

/**
 * Even point distribution on a unit sphere via the golden-angle (Fibonacci)
 * lattice, then a fixed near-neighbor mesh so the points read as a network.
 * Connectivity depends only on the base positions, so it's computed once —
 * the render loop just rotates and projects these.
 */
function buildSphere(n: number, neighbors: number): Sphere {
    const nodes: SphereNode[] = fibonacciSphere(n).map((v, i) => ({
        ...v,
        r: 1.4,
        accent: i % 7 === 0,
    }));

    // Connect each node to its k nearest neighbors (3D), deduped.
    const seen = new Set<string>();
    const edges: [number, number][] = [];
    for (let i = 0; i < n; i++) {
        const a = nodes[i]!;
        const dists = nodes
            .map((b, j) => {
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dz = a.z - b.z;
                return { j, d: dx * dx + dy * dy + dz * dz };
            })
            .filter((e) => e.j !== i)
            .sort((p, q) => p.d - q.d);
        for (let k = 0; k < neighbors && k < dists.length; k++) {
            const j = dists[k]!.j;
            const key = i < j ? `${i}-${j}` : `${j}-${i}`;
            if (seen.has(key)) continue;
            seen.add(key);
            edges.push([i, j]);
        }
    }
    return { nodes, edges };
}

const FULL = buildSphere(64, 3);
const SPARSE = buildSphere(24, 3);

/** Per-state motion: spin rate (rad/s), sphere radius (viewBox units), brightness. */
const CFG: Record<
    CoreState,
    { spin: number; radius: number; bright: number }
> = {
    idle: { spin: 0.1, radius: 40, bright: 0.7 },
    listening: { spin: 0.16, radius: 42, bright: 0.85 },
    thinking: { spin: 0.4, radius: 47, bright: 1 },
    streaming: { spin: 0.34, radius: 46, bright: 1 },
};

/**
 * The AI's signature: a rotating spherical network. Points sit on a sphere,
 * connected by solid lines; the sphere spins gently and the points separate
 * outward (larger radius) while thinking or talking. Far-side geometry fades
 * for a 3D read.
 *
 * One rAF drives everything imperatively (no per-frame React renders); it
 * pauses when hidden and renders static under reduced motion. Deliberately
 * FILTER-FREE — per-frame SVG filters tank the FPS under software rendering.
 */
export function NeuralCore({
    size = 180,
    state = "idle",
    className,
}: {
    size?: number;
    state?: CoreState;
    className?: string;
}) {
    const reduced = useReducedMotion();
    const detailed = size >= 110;
    const sphere = detailed ? FULL : SPARSE;
    const { nodes, edges } = sphere;

    const stateRef = useRef(state);
    stateRef.current = state;

    const nodeEls = useRef<(SVGCircleElement | null)[]>([]);
    const edgeEls = useRef<(SVGLineElement | null)[]>([]);

    useEffect(() => {
        if (reduced) return;
        let raf = 0;
        let last = performance.now();
        let yaw = 0;
        const cur = { ...CFG.idle };

        const frame = (nowMs: number) => {
            const dt = Math.min(0.05, (nowMs - last) / 1000);
            last = nowMs;

            const tgt = CFG[stateRef.current];
            cur.spin += (tgt.spin - cur.spin) * 0.05;
            cur.radius += (tgt.radius - cur.radius) * 0.05;
            cur.bright += (tgt.bright - cur.bright) * 0.05;
            yaw += cur.spin * dt;

            const proj = nodes.map((n) => project(n, yaw, cur.radius));

            for (let i = 0; i < proj.length; i++) {
                const p = proj[i]!;
                const c = nodeEls.current[i];
                if (!c) continue;
                c.setAttribute("cx", String(p.cx));
                c.setAttribute("cy", String(p.cy));
                c.setAttribute("r", String(nodes[i]!.r * (0.55 + 0.45 * p.depth)));
                c.setAttribute(
                    "fill-opacity",
                    String((0.3 + 0.7 * p.depth) * cur.bright),
                );
            }

            for (let i = 0; i < edges.length; i++) {
                const l = edgeEls.current[i];
                if (!l) continue;
                const [ai, bi] = edges[i]!;
                const a = proj[ai]!;
                const b = proj[bi]!;
                l.setAttribute("x1", String(a.cx));
                l.setAttribute("y1", String(a.cy));
                l.setAttribute("x2", String(b.cx));
                l.setAttribute("y2", String(b.cy));
                const dAvg = (a.depth + b.depth) / 2;
                l.setAttribute(
                    "stroke-opacity",
                    String((0.06 + 0.3 * dAvg) * cur.bright),
                );
            }

            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);

        const onVisibility = () => {
            if (document.hidden) {
                cancelAnimationFrame(raf);
            } else {
                last = performance.now();
                raf = requestAnimationFrame(frame);
            }
        };
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            cancelAnimationFrame(raf);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [reduced, nodes, edges]);

    const color = state === "listening" ? "var(--warning)" : "var(--primary)";
    // Seed positions for first paint / reduced-motion static render.
    const seedRadius = CFG[state].radius;
    const seed = nodes.map((n) => project(n, 0, seedRadius));

    return (
        <div
            role="img"
            aria-label={`assistant core: ${state}`}
            className={cn("pointer-events-none", className)}
            style={{ width: size, height: size, color }}
        >
            <svg
                viewBox="0 0 100 100"
                className="h-full w-full overflow-visible"
            >
                {/* Edges */}
                {edges.map((edge, i) => {
                    const a = seed[edge[0]]!;
                    const b = seed[edge[1]]!;
                    const dAvg = (a.depth + b.depth) / 2;
                    return (
                        <line
                            key={i}
                            ref={(el) => {
                                edgeEls.current[i] = el;
                            }}
                            x1={a.cx}
                            y1={a.cy}
                            x2={b.cx}
                            y2={b.cy}
                            stroke="currentColor"
                            strokeOpacity={0.06 + 0.3 * dAvg}
                            strokeWidth={0.5}
                        />
                    );
                })}

                {/* Nodes */}
                {nodes.map((n, i) => {
                    const p = seed[i]!;
                    return (
                        <circle
                            key={i}
                            ref={(el) => {
                                nodeEls.current[i] = el;
                            }}
                            cx={p.cx}
                            cy={p.cy}
                            r={n.r * (0.55 + 0.45 * p.depth)}
                            fill={n.accent ? ACCENT : "currentColor"}
                            fillOpacity={0.3 + 0.7 * p.depth}
                        />
                    );
                })}
            </svg>
        </div>
    );
}
