import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Designed placeholder for a feature that exists on the roadmap but isn't
 * built yet: icon, phase badge, ghost preview rows, offline footer.
 * When the feature lands, replace the StubPanel with the real widget.
 */
export function StubPanel({
    icon: Icon,
    title,
    phase,
    description,
    className,
}: {
    icon: LucideIcon;
    title: string;
    /** Roadmap phase, e.g. "Phase 3". */
    phase: string;
    description: string;
    className?: string;
}) {
    return (
        <Card
            corners
            className={cn(
                "group flex flex-col gap-3 p-4 opacity-80 transition-opacity duration-(--dur-med) hover:opacity-100",
                className,
            )}
        >
            <div className="flex items-center gap-2">
                <Icon aria-hidden className="h-4 w-4 text-primary/70" />
                <span className="flex-1 text-sm font-semibold tracking-wide">
                    {title}
                </span>
                <Badge tone="primary">{phase}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
            <div aria-hidden className="mt-auto flex flex-col gap-1.5">
                {["w-3/4", "w-1/2", "w-2/3"].map((w, i) => (
                    <div
                        key={i}
                        className={cn("h-2 rounded-sm bg-muted/70", w)}
                    />
                ))}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                offline · awaiting build
            </div>
        </Card>
    );
}
