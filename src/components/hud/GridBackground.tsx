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
                        "radial-gradient(ellipse 80% 50% at 50% -10%, var(--nebula-tint), transparent 70%)",
                }}
            />
        </div>
    );
}
