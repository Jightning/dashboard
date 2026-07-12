import { cn } from "@/lib/utils";

/**
 * Segmented HUD progress bar. Tone escalates automatically with fill unless
 * one is forced: <75% primary, 75–90% warning, >90% destructive.
 */
export function Meter({
    pct,
    segments = 20,
    tone,
    className,
    label,
}: {
    /** Fill percentage, 0–100. */
    pct: number;
    segments?: number;
    tone?: "primary" | "warning" | "destructive" | "success";
    className?: string;
    /** Accessible name for the meter. */
    label?: string;
}) {
    const clamped = Math.max(0, Math.min(100, pct));
    const resolved =
        tone ??
        (clamped > 90 ? "destructive" : clamped > 75 ? "warning" : "primary");
    const lit = Math.round((clamped / 100) * segments);
    const fill = {
        primary: "bg-primary shadow-[0_0_6px_var(--glow)]",
        warning: "bg-warning",
        destructive: "bg-destructive",
        success: "bg-success",
    }[resolved];

    return (
        <div
            role="progressbar"
            aria-valuenow={Math.round(clamped)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={label}
            className={cn("flex h-2 items-stretch gap-px", className)}
        >
            {Array.from({ length: segments }, (_, i) => (
                <span
                    key={i}
                    className={cn(
                        "flex-1 rounded-[1px] transition-colors duration-(--dur-med)",
                        i < lit ? fill : "bg-muted",
                    )}
                />
            ))}
        </div>
    );
}
