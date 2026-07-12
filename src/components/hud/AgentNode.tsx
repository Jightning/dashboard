import type { LucideIcon } from "lucide-react";
import { BookOpenText, Cpu, Globe, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export type AgentStatus = "idle" | "active" | "tool";

/** Visual identity per agent. Add an entry (and a --agent-* token) per new agent. */
const IDENTITY: Record<string, { color: string; icon: LucideIcon }> = {
    orchestrator: { color: "var(--agent-orchestrator)", icon: Cpu },
    knowledge: { color: "var(--agent-knowledge)", icon: BookOpenText },
    research: { color: "var(--agent-research)", icon: Globe },
};

export function agentColor(name: string): string {
    return IDENTITY[name]?.color ?? "var(--primary)";
}

export function agentIcon(name: string): LucideIcon {
    return IDENTITY[name]?.icon ?? Bot;
}

/** Circular agent avatar with identity color and status glow. */
export function AgentNode({
    name,
    label,
    status = "idle",
    size = 56,
    className,
}: {
    name: string;
    label?: string;
    status?: AgentStatus;
    /** Circle diameter in px. */
    size?: number;
    className?: string;
}) {
    const color = agentColor(name);
    const Icon = agentIcon(name);
    const busy = status !== "idle";

    return (
        <div className={cn("flex flex-col items-center gap-1.5", className)}>
            <div
                className={cn(
                    "flex items-center justify-center rounded-full border transition-[box-shadow,border-color] duration-(--dur-med)",
                    busy && "animate-pulse-core",
                )}
                style={{
                    width: size,
                    height: size,
                    borderColor: color,
                    background: `color-mix(in oklab, ${color} ${busy ? 18 : 8}%, transparent)`,
                    boxShadow: busy ? `0 0 14px ${color}` : undefined,
                }}
            >
                <Icon
                    aria-hidden
                    style={{ color, width: size * 0.4, height: size * 0.4 }}
                />
            </div>
            {label && (
                <span
                    className="font-mono text-[10px] uppercase tracking-wider"
                    style={{ color }}
                >
                    {label}
                </span>
            )}
        </div>
    );
}
