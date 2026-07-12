import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import {
    projectQuat,
    quatFromAxisAngle,
    quatMul,
    quatNormalize,
    type Quat,
} from "./sphere";
import type { NetworkEdge, NetworkNode } from "./networkData";

const RADIUS = 40; // sphere radius in the 0–100 viewBox
const SPIN = 0.12; // idle spin (rad/s)
const IDLE_MS = 3000; // resume auto-spin after this long without interaction
const SENS = 0.01; // drag sensitivity (rad per px)
const DRAG_THRESH = 4; // px of movement before a gesture counts as a drag

/** Slight initial downward tilt so the poles aren't dead-on. */
const INITIAL_ORIENT = quatFromAxisAngle(1, 0, 0, 0.3);

function rootOf(n: NetworkNode): string {
    return n.parentId ?? n.id;
}

function truncate(s: string, n = 18): string {
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/**
 * Data-driven interactive sphere: renders a network of meaningful nodes
 * (agent instances + their context) as a gently rotating globe. Hovering a
 * node stills the spin, highlights its subtree, and shows an info card;
 * clicking a primary node fires `onSelect`.
 *
 * Same performance contract as NeuralCore: one imperative rAF, filter-free,
 * pauses when hidden, static under reduced motion.
 */
export function NetworkSphere({
    nodes,
    edges,
    size = 300,
    onSelect,
    onHover,
    highlightId,
    className,
}: {
    nodes: NetworkNode[];
    edges: NetworkEdge[];
    size?: number;
    onSelect?: (node: NetworkNode) => void;
    /** Fires as the pointer enters/leaves a node (null on leave). */
    onHover?: (node: NetworkNode | null) => void;
    /** Node id to highlight externally (e.g. from a hovered sidebar row). */
    highlightId?: string | null;
    className?: string;
}) {
    const reduced = useReducedMotion();
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const hoveredRef = useRef<string | null>(null);
    const highlightRef = useRef<string | null>(highlightId ?? null);

    // Orientation + drag state (refs so handlers mutate without re-rendering).
    const orientRef = useRef<Quat>(INITIAL_ORIENT);
    const draggingRef = useRef(false);
    const movedRef = useRef(false);
    const lastPtrRef = useRef({ x: 0, y: 0 });
    const lastInteractionRef = useRef(0);

    const setHovered = useCallback((id: string | null) => {
        hoveredRef.current = id;
        lastInteractionRef.current = performance.now();
        setHoveredId(id);
    }, []);

    // Precompute lookups + resolved edge index pairs (recomputed on data change).
    const { byId, roots, edgePairs } = useMemo(() => {
        const idx = new Map(nodes.map((n, i) => [n.id, i]));
        return {
            byId: idx,
            roots: nodes.map(rootOf),
            edgePairs: edges
                .map((e) => ({ ai: idx.get(e.a), bi: idx.get(e.b) }))
                .filter(
                    (e): e is { ai: number; bi: number } =>
                        e.ai !== undefined && e.bi !== undefined,
                ),
        };
    }, [nodes, edges]);

    const nodeEls = useRef<(SVGCircleElement | null)[]>([]);
    const hitEls = useRef<(SVGCircleElement | null)[]>([]);
    const labelEls = useRef<(SVGTextElement | null)[]>([]);
    const edgeEls = useRef<(SVGLineElement | null)[]>([]);
    const cardRef = useRef<HTMLDivElement | null>(null);

    // One projection + attribute-write pass at the current orientation. Shared
    // by the rAF loop (motion) and the one-shot effect (reduced motion).
    const draw = useCallback(
        () => {
            const orient = orientRef.current;
            const pointerHov = hoveredRef.current;
            // Highlight subtree from pointer hover OR an external source (a
            // hovered sidebar row); the info card tracks pointer hover only.
            const hov = pointerHov ?? highlightRef.current;
            const hoveredRoot =
                hov && byId.has(hov) ? roots[byId.get(hov)!]! : null;

            const proj: { cx: number; cy: number; depth: number }[] = [];
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i]!;
                const p = projectQuat(node.unit, orient, RADIUS);
                proj.push(p);
                const focus = hoveredRoot ? roots[i] === hoveredRoot : true;
                const dim = hoveredRoot != null && !focus;

                let op = 0.35 + 0.65 * p.depth;
                if (node.kind === "tool") op *= 0.8;
                if (dim) op *= 0.22;
                else if (hoveredRoot && focus) op = Math.min(1, op * 1.4);

                const rScale =
                    (0.6 + 0.4 * p.depth) * (hoveredRoot && focus ? 1.15 : 1);

                const c = nodeEls.current[i];
                if (c) {
                    c.setAttribute("cx", String(p.cx));
                    c.setAttribute("cy", String(p.cy));
                    c.setAttribute("r", String(node.r * rScale));
                    c.setAttribute("fill-opacity", String(op));
                }
                const hit = hitEls.current[i];
                if (hit) {
                    hit.setAttribute("cx", String(p.cx));
                    hit.setAttribute("cy", String(p.cy));
                    hit.setAttribute("r", String(node.r * 2 + 3));
                    // Back-hemisphere nodes shouldn't intercept front clicks.
                    hit.style.pointerEvents = p.depth > 0.45 ? "auto" : "none";
                }
                const label = labelEls.current[i];
                if (label) {
                    let lop = 0;
                    if (node.primary && !dim) lop = 0.5 + 0.5 * p.depth;
                    if (hoveredRoot && focus) lop = 0.92;
                    label.setAttribute("x", String(p.cx));
                    label.setAttribute("y", String(p.cy - node.r * rScale - 1.5));
                    label.setAttribute("opacity", String(lop));
                }
            }

            for (let i = 0; i < edgePairs.length; i++) {
                const l = edgeEls.current[i];
                if (!l) continue;
                const { ai, bi } = edgePairs[i]!;
                const a = proj[ai]!;
                const b = proj[bi]!;
                l.setAttribute("x1", String(a.cx));
                l.setAttribute("y1", String(a.cy));
                l.setAttribute("x2", String(b.cx));
                l.setAttribute("y2", String(b.cy));
                const focus = hoveredRoot
                    ? roots[ai] === hoveredRoot && roots[bi] === hoveredRoot
                    : true;
                let eop = 0.05 + 0.28 * ((a.depth + b.depth) / 2);
                if (hoveredRoot && !focus) eop *= 0.18;
                else if (hoveredRoot && focus) eop = Math.min(0.6, eop * 2.2);
                l.setAttribute("stroke-opacity", String(eop));
            }

            // Track the pointer-hovered node with the info card.
            if (pointerHov && byId.has(pointerHov) && cardRef.current) {
                const p = proj[byId.get(pointerHov)!]!;
                cardRef.current.style.left = `${(p.cx / 100) * size}px`;
                cardRef.current.style.top = `${(p.cy / 100) * size}px`;
            }
        },
        [nodes, edgePairs, byId, roots, size],
    );

    // Motion: continuous rAF. Auto-spin only when idle — not dragging, not
    // hovering, and 3s past the last interaction (so a drag holds still first).
    useEffect(() => {
        if (reduced) {
            draw();
            return;
        }
        let raf = 0;
        let last = performance.now();
        let spin = SPIN;

        const frame = (now: number) => {
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            const idle =
                !draggingRef.current &&
                !hoveredRef.current &&
                !highlightRef.current &&
                now - lastInteractionRef.current > IDLE_MS;
            const target = idle ? SPIN : 0;
            spin += (target - spin) * 0.08;
            // Idle spin about the screen-vertical axis (predictable turntable).
            orientRef.current = quatNormalize(
                quatMul(
                    quatFromAxisAngle(0, 1, 0, spin * dt),
                    orientRef.current,
                ),
            );
            draw();
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
    }, [reduced, draw]);

    // Keep the external-highlight ref in sync; redraw under reduced motion
    // (the rAF loop already picks it up in motion mode).
    useEffect(() => {
        highlightRef.current = highlightId ?? null;
        if (reduced) draw();
    }, [highlightId, reduced, draw]);

    // Reduced motion: no rAF, but re-draw on hover change (static positions).
    useEffect(() => {
        if (reduced) draw();
    }, [reduced, hoveredId, draw]);

    // Pointer drag → rotate. Attached to the wrapper so it covers both empty
    // space and nodes (their pointer events bubble up here).
    const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        draggingRef.current = true;
        movedRef.current = false;
        lastPtrRef.current = { x: e.clientX, y: e.clientY };
        lastInteractionRef.current = performance.now();
    }, []);

    const onPointerMove = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (!draggingRef.current) return;
            const dx = e.clientX - lastPtrRef.current.x;
            const dy = e.clientY - lastPtrRef.current.y;
            if (!movedRef.current && Math.abs(dx) + Math.abs(dy) > DRAG_THRESH) {
                // Real drag now: capture so it tracks even if the pointer leaves.
                // Deferred until here so a plain click never captures (keeps
                // node selection reliable).
                movedRef.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
            }
            // Trackball: rotate about the screen axes so the sphere follows the
            // pointer. Pre-multiply = rotation applied in the fixed screen frame.
            const dq = quatMul(
                quatFromAxisAngle(0, 1, 0, dx * SENS),
                quatFromAxisAngle(1, 0, 0, dy * SENS),
            );
            orientRef.current = quatNormalize(quatMul(dq, orientRef.current));
            lastPtrRef.current = { x: e.clientX, y: e.clientY };
            lastInteractionRef.current = performance.now();
            if (reduced) draw(); // no rAF to pick it up otherwise
        },
        [reduced, draw],
    );

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        draggingRef.current = false;
        lastInteractionRef.current = performance.now();
        if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
    }, []);

    const hoveredNode =
        hoveredId && byId.has(hoveredId) ? nodes[byId.get(hoveredId)!]! : null;

    // Seed positions for first paint (before the loop runs).
    const seed = useMemo(
        () => nodes.map((n) => projectQuat(n.unit, INITIAL_ORIENT, RADIUS)),
        [nodes],
    );

    return (
        <div
            className={cn(
                "relative cursor-grab touch-none select-none active:cursor-grabbing",
                className,
            )}
            style={{ width: size, height: size }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            <svg
                viewBox="0 0 100 100"
                className="absolute inset-0 h-full w-full overflow-visible"
            >
                {/* Edges */}
                {edgePairs.map((e, i) => (
                    <line
                        key={i}
                        ref={(el) => {
                            edgeEls.current[i] = el;
                        }}
                        x1={seed[e.ai]!.cx}
                        y1={seed[e.ai]!.cy}
                        x2={seed[e.bi]!.cx}
                        y2={seed[e.bi]!.cy}
                        stroke={nodes[e.ai]!.color}
                        strokeOpacity={0.15}
                        strokeWidth={0.5}
                    />
                ))}

                {/* Visible nodes (non-interactive; hit circles handle events) */}
                {nodes.map((n, i) => (
                    <circle
                        key={n.id}
                        ref={(el) => {
                            nodeEls.current[i] = el;
                        }}
                        cx={seed[i]!.cx}
                        cy={seed[i]!.cy}
                        r={n.r}
                        fill={n.color}
                        fillOpacity={0.35 + 0.65 * seed[i]!.depth}
                        className="pointer-events-none"
                    />
                ))}

                {/* Labels */}
                {nodes.map((n, i) => (
                    <text
                        key={n.id}
                        ref={(el) => {
                            labelEls.current[i] = el;
                        }}
                        x={seed[i]!.cx}
                        y={seed[i]!.cy - n.r - 1.5}
                        textAnchor="middle"
                        className="pointer-events-none select-none font-mono uppercase"
                        style={{
                            fontSize: n.primary ? 3 : 2.4,
                            letterSpacing: "0.05em",
                            fill: n.color,
                        }}
                        opacity={0}
                    >
                        {truncate(n.label)}
                    </text>
                ))}

                {/* Transparent hit targets (on top) */}
                {nodes.map((n, i) => (
                    <circle
                        key={n.id}
                        ref={(el) => {
                            hitEls.current[i] = el;
                        }}
                        cx={seed[i]!.cx}
                        cy={seed[i]!.cy}
                        r={n.r * 2 + 3}
                        fill="transparent"
                        style={{ cursor: n.primary ? "pointer" : "default" }}
                        onPointerEnter={() => {
                            setHovered(n.id);
                            onHover?.(n);
                        }}
                        onPointerLeave={() => {
                            setHovered(null);
                            onHover?.(null);
                        }}
                        onClick={() => {
                            // Suppress selection if this gesture was a drag-rotate.
                            if (n.primary && !movedRef.current) onSelect?.(n);
                        }}
                    />
                ))}
            </svg>

            {/* Info card, positioned imperatively at the hovered node */}
            <div
                ref={cardRef}
                className={cn(
                    "pointer-events-none absolute z-10 w-max max-w-56 -translate-x-1/2 rounded-md border border-border bg-background/95 p-2 shadow-lg transition-opacity",
                    hoveredNode ? "opacity-100" : "opacity-0",
                )}
                style={{ transform: "translate(-50%, calc(-100% - 8px))" }}
            >
                {hoveredNode && <HoverContent node={hoveredNode} />}
            </div>
        </div>
    );
}

function HoverContent({ node }: { node: NetworkNode }) {
    const { meta } = node;
    return (
        <div className="flex flex-col gap-1">
            <div
                className="font-mono text-[11px] font-semibold"
                style={{ color: node.color }}
            >
                {meta.title}
            </div>
            {meta.subtitle && (
                <div className="text-[10px] leading-snug text-muted-foreground">
                    {meta.subtitle}
                </div>
            )}
            {meta.chips && meta.chips.length > 0 && (
                <div className="mt-0.5 flex flex-wrap gap-1">
                    {meta.chips.map((c) => (
                        <span
                            key={c.label}
                            className="rounded-sm px-1 py-0.5 font-mono text-[9px]"
                            style={{
                                color: c.color ?? "var(--foreground)",
                                background: `color-mix(in oklab, ${
                                    c.color ?? "var(--muted-foreground)"
                                } 15%, transparent)`,
                            }}
                        >
                            {c.label}
                        </span>
                    ))}
                </div>
            )}
            {meta.foot && (
                <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {meta.foot}
                </div>
            )}
        </div>
    );
}
