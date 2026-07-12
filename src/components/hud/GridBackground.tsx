/**
 * Ambient shell backdrop: a faint blueprint grid and a soft radial glow from
 * the top. Static — no animation — so it stays calm and cheap to composite.
 */
export function GridBackground() {
    return (
        <div
            aria-hidden
            className="pointer-events-none fixed inset-0 overflow-hidden"
        >
            <div className="hud-grid absolute inset-0" />
            <div
                className="absolute inset-0"
                style={{
                    background:
                        "radial-gradient(ellipse 80% 50% at 50% -10%, oklch(0.8 0.125 210 / 6%), transparent 70%)",
                }}
            />
        </div>
    );
}
