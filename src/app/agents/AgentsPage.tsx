import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NetworkSphere } from "@/components/hud/NetworkSphere";
import { buildAgentTypeNetwork } from "@/components/hud/networkData";
import { agentColor } from "@/components/hud/AgentNode";
import { listAgents } from "@/db/repo/agents";
import { agentSlug, agentToolNames, type AgentDef } from "@/lib/schemas";

export function AgentsPage() {
    const [agents, setAgents] = useState<AgentDef[]>([]);
    useEffect(() => {
        void listAgents().then(setAgents);
    }, []);
    const network = useMemo(() => buildAgentTypeNetwork(agents), [agents]);

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
                    />
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {agents.map((a) => {
                        const color = a.color ?? agentColor(agentSlug(a.name));
                        return (
                            <Card
                                key={a.id}
                                style={{ borderLeft: `2px solid ${color}` }}
                            >
                                <CardHeader>
                                    <CardTitle className="text-sm">
                                        {a.name}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-2">
                                    <p className="text-xs text-muted-foreground">
                                        {a.description}
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {agentToolNames(a).map((t) => (
                                            <code
                                                key={t}
                                                className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground/80"
                                            >
                                                {t}
                                            </code>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
