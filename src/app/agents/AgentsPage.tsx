import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NetworkSphere } from "@/components/hud/NetworkSphere";
import { buildAgentTypeNetwork } from "@/components/hud/networkData";
import { agentColor, agentIcon } from "@/components/hud/AgentNode";
import { AGENT_SPECS, type AgentSpec } from "@/components/hud/agentCatalog";

export function AgentsPage() {
    const network = useMemo(() => buildAgentTypeNetwork(), []);
    const [selected, setSelected] = useState<string | null>(null);

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mx-auto flex max-w-4xl flex-col gap-6">
                <header>
                    <h1 className="font-display text-2xl font-bold tracking-wide">
                        Agent network
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Every tool call — orchestrator or specialist — passes
                        through the permission engine. Nothing runs silently.
                    </p>
                </header>

                <div className="flex justify-center">
                    <NetworkSphere
                        nodes={network.nodes}
                        edges={network.edges}
                        size={320}
                        onSelect={(node) => {
                            const agent = (
                                node.payload as { agent?: string } | undefined
                            )?.agent;
                            if (!agent) return;
                            setSelected(agent);
                            document
                                .getElementById(`agent-card-${agent}`)
                                ?.scrollIntoView({
                                    behavior: "smooth",
                                    block: "center",
                                });
                        }}
                    />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {AGENT_SPECS.map((spec, i) => (
                        <AgentCard
                            key={spec.name}
                            spec={spec}
                            index={i}
                            selected={spec.name === selected}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function AgentCard({
    spec,
    index,
    selected,
}: {
    spec: AgentSpec;
    index: number;
    selected: boolean;
}) {
    const color = agentColor(spec.name);
    const Icon = agentIcon(spec.name);

    return (
        <motion.div
            id={`agent-card-${spec.name}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                delay: 0.05 * index,
                duration: 0.3,
                ease: [0.16, 1, 0.3, 1],
            }}
        >
            <Card
                className={spec.future ? "opacity-70" : undefined}
                style={
                    {
                        borderLeft: `2px solid ${color}`,
                        boxShadow: selected ? `0 0 0 1px ${color}` : undefined,
                    } as React.CSSProperties
                }
            >
                <CardHeader className="flex-row items-center gap-2">
                    <Icon aria-hidden className="h-4 w-4" style={{ color }} />
                    <CardTitle className="flex-1 text-sm">
                        {spec.title}
                    </CardTitle>
                    {spec.future && <Badge tone="primary">{spec.future}</Badge>}
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">{spec.role}</p>
                    <div className="flex flex-wrap gap-1">
                        {spec.tools.map((tool) => (
                            <code
                                key={tool}
                                className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground/80"
                            >
                                {tool}
                            </code>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
