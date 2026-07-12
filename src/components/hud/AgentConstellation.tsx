import { AgentNode, agentColor, type AgentStatus } from "./AgentNode";
import { cn } from "@/lib/utils";

export interface ConstellationAgent {
    name: string;
    label: string;
    status?: AgentStatus;
}

/**
 * Hub-and-spoke topology: the orchestrator at center, specialist agents on a
 * ring around it. Handles any agent count — future agents just append.
 */
export function AgentConstellation({
    agents,
    hubStatus = "idle",
    size = 320,
    className,
}: {
    /** Specialist agents on the ring (orchestrator hub is implicit). */
    agents: ConstellationAgent[];
    hubStatus?: AgentStatus;
    /** Square container edge in px. */
    size?: number;
    className?: string;
}) {
    const center = size / 2;
    const radius = size * 0.36;
    const positions = agents.map((agent, i) => {
        // Start at 12 o'clock, distribute evenly
        const angle = (2 * Math.PI * i) / agents.length - Math.PI / 2;
        return {
            agent,
            x: center + radius * Math.cos(angle),
            y: center + radius * Math.sin(angle),
        };
    });

    return (
        <div
            className={cn("relative", className)}
            style={{ width: size, height: size }}
        >
            {/* Spokes */}
            <svg
                className="absolute inset-0"
                viewBox={`0 0 ${size} ${size}`}
                aria-hidden
            >
                {positions.map(({ agent, x, y }) => {
                    const busy = (agent.status ?? "idle") !== "idle";
                    return (
                        <line
                            key={agent.name}
                            x1={center}
                            y1={center}
                            x2={x}
                            y2={y}
                            stroke={
                                busy ? agentColor(agent.name) : "var(--border)"
                            }
                            strokeWidth="1"
                            strokeDasharray={busy ? "4 4" : "2 5"}
                        >
                            {busy && (
                                <animate
                                    attributeName="stroke-dashoffset"
                                    from="16"
                                    to="0"
                                    dur="0.8s"
                                    repeatCount="indefinite"
                                />
                            )}
                        </line>
                    );
                })}
            </svg>

            {/* Hub */}
            <div
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: center, top: center }}
            >
                <AgentNode
                    name="orchestrator"
                    label="orchestrator"
                    status={hubStatus}
                    size={72}
                />
            </div>

            {/* Ring agents */}
            {positions.map(({ agent, x, y }) => (
                <div
                    key={agent.name}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: x, top: y }}
                >
                    <AgentNode
                        name={agent.name}
                        label={agent.label}
                        status={agent.status}
                    />
                </div>
            ))}
        </div>
    );
}
