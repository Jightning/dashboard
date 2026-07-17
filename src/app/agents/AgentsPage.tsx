import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NetworkSphere } from "@/components/hud/NetworkSphere";
import { buildAgentTypeNetwork } from "@/components/hud/networkData";
import { agentColor } from "@/components/hud/AgentNode";
import * as agentsRepo from "@/db/repo/agents";
import { agentSlug, agentToolNames, type AgentDef } from "@/lib/schemas";
import { AgentEditor } from "./AgentEditor";
import { AgentTestBench } from "./AgentTestBench";
import { PipelinesTab } from "./PipelinesTab";
import { AutomationsTab } from "./AutomationsTab";
import { TabBar } from "@/components/ui/tabs";
import { ChatWorkspace } from "@/app/chat/ChatWorkspace";
import type { NavTarget } from "@/app/Sidebar";

type Tab = "chat" | "roster" | "pipelines" | "automations";
const TABS: { id: Tab; label: string }[] = [
    { id: "chat", label: "Chat" },
    { id: "roster", label: "Roster" },
    { id: "pipelines", label: "Pipelines" },
    { id: "automations", label: "Automations" },
];
const isTab = (t: string | undefined): t is Tab => TABS.some((x) => x.id === t);

export function AgentsPage({
    tab,
    sessionId,
    onNavigate,
    onTabChange,
    onSessionOpened,
}: {
    tab?: string;
    sessionId?: string | null;
    onNavigate?: (t: NavTarget) => void;
    onTabChange?: (tab: string) => void;
    onSessionOpened?: (id: string | null) => void;
} = {}) {
    const [active, setActive] = useState<Tab>(isTab(tab) ? tab : "chat");
    useEffect(() => {
        if (isTab(tab)) setActive(tab);
    }, [tab]);

    return (
        <div className="flex h-full flex-col">
            <div className="px-6 pt-4">
                <TabBar
                    tabs={TABS}
                    active={active}
                    onSelect={(t) => {
                        setActive(t);
                        onTabChange?.(t);
                    }}
                />
            </div>
            {active === "chat" ? (
                <div className="min-h-0 flex-1">
                    <ChatWorkspace
                        initialSessionId={sessionId}
                        onNavigate={onNavigate}
                        onSessionOpened={onSessionOpened}
                    />
                </div>
            ) : (
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                    <div className="mx-auto flex max-w-4xl flex-col gap-6">
                        <header>
                            <h1 className="font-display text-2xl font-semibold tracking-wide">
                                Agents
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {TAB_BLURBS[active]}
                            </p>
                        </header>
                        {active === "roster" && <RosterTab />}
                        {active === "pipelines" && <PipelinesTab />}
                        {active === "automations" && <AutomationsTab />}
                    </div>
                </div>
            )}
        </div>
    );
}

const TAB_BLURBS: Record<Exclude<Tab, "chat">, string> = {
    roster: "Your specialists. Each one is just instructions + a set of tools + a model — edit anything, or duplicate a builtin to start from a working example.",
    pipelines:
        "Chain agents into a sequence of steps. Each step sends a prompt to one agent; a step can reuse what earlier steps produced.",
    automations:
        "Put a pipeline on a schedule. Every tool call still passes the permission engine — nothing runs silently.",
};

function RosterTab() {
    const [agents, setAgents] = useState<AgentDef[]>([]);
    const [editing, setEditing] = useState<AgentDef | "new" | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setAgents(await agentsRepo.listAgents());
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);

    const network = useMemo(() => buildAgentTypeNetwork(agents), [agents]);

    const act = async (fn: () => Promise<unknown>) => {
        setError(null);
        try {
            await fn();
            await reload();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    return (
        <div className="flex flex-col gap-6">
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
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {agents.map((a) => {
                    const color = a.color ?? agentColor(agentSlug(a.name));
                    return (
                        <Card
                            key={a.id}
                            id={`agent-card-${a.id}`}
                            style={{
                                borderLeft: `2px solid ${color}`,
                                boxShadow:
                                    selected === a.id
                                        ? `0 0 0 1px ${color}`
                                        : undefined,
                            }}
                        >
                            <CardHeader className="flex-row items-center gap-2">
                                <CardTitle className="flex-1 text-sm">
                                    {a.name}
                                </CardTitle>
                                {a.is_builtin === 1 && (
                                    <Badge tone="primary">builtin</Badge>
                                )}
                                {a.model && (
                                    <code className="font-mono text-[10px] text-muted-foreground">
                                        {a.model}
                                    </code>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Edit ${a.name}`}
                                    onClick={() => setEditing(a)}
                                >
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Duplicate ${a.name}`}
                                    onClick={() =>
                                        void act(() =>
                                            agentsRepo.duplicateAgent(a.id),
                                        )
                                    }
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                                {a.is_builtin === 0 && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Delete ${a.name}`}
                                        onClick={() =>
                                            void act(() =>
                                                agentsRepo.deleteAgent(a.id),
                                            )
                                        }
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
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
            {editing ? (
                <AgentEditor
                    agent={editing === "new" ? null : editing}
                    onDone={async () => {
                        setEditing(null);
                        await reload();
                    }}
                />
            ) : (
                <Button className="self-start" onClick={() => setEditing("new")}>
                    New agent
                </Button>
            )}
            <AgentTestBench agents={agents} />
        </div>
    );
}
