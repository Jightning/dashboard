import { useState } from "react";
import * as agentsRepo from "@/db/repo/agents";
import { TOOL_CATALOG } from "@/ai/tools/catalog";
import { agentToolNames, type AgentDef } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GROUPS = ["documents", "notes", "web", "tasks"] as const;

export function AgentEditor({
    agent,
    onDone,
}: {
    agent: AgentDef | null; // null = create
    onDone: () => Promise<void>;
}) {
    const [form, setForm] = useState<agentsRepo.AgentInput>(() =>
        agent
            ? {
                  name: agent.name,
                  description: agent.description,
                  instructions: agent.instructions,
                  tools: agentToolNames(agent),
                  model: agent.model,
                  maxSteps: agent.max_steps,
                  color: agent.color,
              }
            : {
                  name: "",
                  description: "",
                  instructions: "You are a helpful specialist agent.",
                  tools: [],
                  model: null,
                  maxSteps: 6,
                  color: null,
              },
    );
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        setError(null);
        try {
            if (agent) await agentsRepo.updateAgent(agent.id, form);
            else await agentsRepo.createAgent(form);
            await onDone();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    const toggleTool = (name: string) => {
        setForm((f) => ({
            ...f,
            tools: f.tools.includes(name)
                ? f.tools.filter((t) => t !== name)
                : [...f.tools, name],
        }));
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{agent ? `Edit ${agent.name}` : "New agent"}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <div className="flex gap-3">
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Name
                        <Input
                            value={form.name}
                            onChange={(e) =>
                                setForm({ ...form, name: e.target.value })
                            }
                        />
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Model override
                        <Input
                            value={form.model ?? ""}
                            placeholder="(preset main model)"
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    model: e.target.value || null,
                                })
                            }
                        />
                    </label>
                    <label className="flex w-28 flex-col gap-1 text-sm">
                        Max steps
                        <Input
                            type="number"
                            min={1}
                            value={form.maxSteps ?? 6}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    maxSteps: Number(e.target.value) || 6,
                                })
                            }
                        />
                    </label>
                </div>
                <label className="flex flex-col gap-1 text-sm">
                    Description
                    <Input
                        value={form.description}
                        placeholder="What the orchestrator reads when deciding to delegate"
                        onChange={(e) =>
                            setForm({ ...form, description: e.target.value })
                        }
                    />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                    Instructions (system prompt)
                    <Textarea
                        rows={6}
                        value={form.instructions}
                        onChange={(e) =>
                            setForm({ ...form, instructions: e.target.value })
                        }
                    />
                </label>
                <div className="flex flex-col gap-2 text-sm">
                    Tools
                    {GROUPS.map((group) => (
                        <div
                            key={group}
                            className="flex flex-wrap items-center gap-3"
                        >
                            <span className="w-20 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                {group}
                            </span>
                            {TOOL_CATALOG.filter((t) => t.group === group).map(
                                (t) => (
                                    <label
                                        key={t.name}
                                        className="flex items-center gap-1.5"
                                        title={t.label}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={form.tools.includes(t.name)}
                                            onChange={() => toggleTool(t.name)}
                                        />
                                        <code className="font-mono text-xs">
                                            {t.name}
                                        </code>
                                        {t.access === "write" && (
                                            <span className="font-mono text-[10px] uppercase text-warning">
                                                write
                                            </span>
                                        )}
                                    </label>
                                ),
                            )}
                        </div>
                    ))}
                </div>
                <label className="flex w-56 flex-col gap-1 text-sm">
                    Color (CSS value, optional)
                    <Input
                        value={form.color ?? ""}
                        placeholder="var(--agent-knowledge)"
                        onChange={(e) =>
                            setForm({ ...form, color: e.target.value || null })
                        }
                    />
                </label>
                <div className="flex items-center gap-3">
                    <Button onClick={() => void save()}>Save</Button>
                    <Button variant="ghost" onClick={() => void onDone()}>
                        Cancel
                    </Button>
                    {error && (
                        <span className="text-xs text-destructive">{error}</span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
