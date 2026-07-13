import { useMemo, useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { marked } from "marked";
import { createModel, type ProviderId } from "@/ai/providers/registry";
import { appFetch } from "@/ai/providers/appFetch";
import { PermissionContext } from "@/ai/tools/context";
import { createAgentFromDef } from "@/ai/agents/factory";
import type { AgentRuntime, AgentUsageEvent } from "@/ai/agents/types";
import { useRuntime } from "@/app/runtime";
import { ApprovalCards } from "@/components/chat/ApprovalCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgentDef } from "@/lib/schemas";

// Same options as NotesPage's markdown preview — the only other markdown
// renderer in the app (chat messages render as plain text, no marked).
marked.setOptions({ breaks: true, gfm: true });

export function AgentTestBench({ agents }: { agents: AgentDef[] }) {
    const { settings } = useRuntime();
    const [agentId, setAgentId] = useState("");
    const [task, setTask] = useState("");
    const [running, setRunning] = useState(false);
    const [output, setOutput] = useState<string | null>(null);
    const [usage, setUsage] = useState<AgentUsageEvent | null>(null);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Fresh per mount; level-less → every tool call raises an approval card.
    const permissions = useMemo(() => new PermissionContext(), []);

    const run = async () => {
        const def = agents.find((a) => a.id === agentId);
        if (!def || !task.trim() || running) return;
        setRunning(true);
        setOutput(null);
        setUsage(null);
        setError(null);
        const abort = new AbortController();
        abortRef.current = abort;
        try {
            const provider = settings.defaultProvider as ProviderId;
            const base = { settings, fetch: appFetch };
            const runtime: AgentRuntime = {
                permissions,
                mainModel: createModel(
                    { provider, modelId: settings.defaultModel },
                    base,
                ),
                mainModelId: settings.defaultModel,
                routerModel: createModel(
                    { provider, modelId: settings.routerModel },
                    base,
                ),
                routerModelId: settings.routerModel,
                resolveModel: (modelId) =>
                    createModel({ provider, modelId }, base),
                fetch: appFetch,
                onUsage: setUsage,
            };
            const { agent, modelId } = createAgentFromDef(def, runtime);
            const result = await agent.generate({
                prompt: task,
                abortSignal: abort.signal,
            });
            runtime.onUsage?.({
                agent: def.name,
                model: modelId,
                usage: result.totalUsage,
            });
            setOutput(result.text || "(no text returned)");
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            permissions.broker.denyAll();
            abortRef.current = null;
            setRunning(false);
        }
    };

    const stop = () => {
        permissions.broker.denyAll();
        abortRef.current?.abort();
    };

    return (
        <Card corners>
            <CardHeader>
                <CardTitle>Test bench</CardTitle>
                <p className="text-xs text-muted-foreground">
                    Run one task against an agent with your default models.
                    Ungoverned by any level — every tool call asks.
                </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <div className="flex gap-3">
                    <Select
                        aria-label="Agent under test"
                        value={agentId}
                        onChange={(e) => setAgentId(e.target.value)}
                        className="w-56"
                    >
                        <option value="">Select agent…</option>
                        {agents.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </Select>
                    {running ? (
                        <Button variant="destructive" onClick={stop}>
                            <Square className="mr-1 h-3.5 w-3.5" /> Stop
                        </Button>
                    ) : (
                        <Button
                            disabled={!agentId || !task.trim()}
                            onClick={() => void run()}
                        >
                            <Play className="mr-1 h-3.5 w-3.5" /> Run
                        </Button>
                    )}
                </div>
                <Textarea
                    rows={3}
                    placeholder="Task for the agent — self-contained, it has no chat context."
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                />
                <ApprovalCards broker={permissions.broker} />
                {running && (
                    <p className="shimmer font-mono text-xs text-muted-foreground">
                        running…
                    </p>
                )}
                {error && (
                    <p className="font-mono text-xs text-destructive">{error}</p>
                )}
                {output !== null && (
                    <div
                        className="markdown rounded-sm border border-border bg-background/60 p-3 text-sm"
                        // Same marked config as NotesPage's markdown preview.
                        dangerouslySetInnerHTML={{
                            __html: marked.parse(output) as string,
                        }}
                    />
                )}
                {usage && (
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {usage.model} · in {usage.usage.inputTokens ?? "?"} ·
                        out {usage.usage.outputTokens ?? "?"}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
