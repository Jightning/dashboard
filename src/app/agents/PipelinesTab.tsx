import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Play, Plus, Trash2 } from "lucide-react";
import * as pipelinesRepo from "@/db/repo/pipelines";
import { listAgents } from "@/db/repo/agents";
import { listLevels, listGrants } from "@/db/repo/permissions";
import { toScopedGrant } from "@/ai/permissions/engine";
import { PermissionContext } from "@/ai/tools/context";
import { buildPipelineRuntime } from "@/ai/agents/runtime";
import { runPipeline } from "@/ai/pipelines/runner";
import { appFetch } from "@/ai/providers/appFetch";
import { useRuntime } from "@/app/runtime";
import { ApprovalCards } from "@/components/chat/ApprovalCard";
import { PermissionLevelSelect } from "@/components/PermissionLevelSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
    AgentDef,
    PermissionLevel,
    Pipeline,
    PipelineRun,
    PipelineStep,
} from "@/lib/schemas";
import { RunHistory } from "./RunHistory";
import { TemplateEditor } from "./TemplateEditor";

interface StepDraft {
    agentId: string;
    promptTemplate: string;
}

export function PipelinesTab() {
    const { settings } = useRuntime();
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [agents, setAgents] = useState<AgentDef[]>([]);
    const [levels, setLevels] = useState<PermissionLevel[]>([]);
    const [editing, setEditing] = useState<Pipeline | "new" | null>(null);
    const [runsFor, setRunsFor] = useState<string | null>(null);
    const [runs, setRuns] = useState<PipelineRun[]>([]);
    const [runInput, setRunInput] = useState("");
    const [levelId, setLevelId] = useState("");
    const [running, setRunning] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<PermissionContext | null>(
        null,
    );
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setPipelines(await pipelinesRepo.listPipelines());
        setAgents(await listAgents());
        setLevels(await listLevels());
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);

    const refreshRuns = useCallback(async (pipelineId: string) => {
        setRunsFor(pipelineId);
        setRuns(await pipelinesRepo.listRuns({ pipelineId }));
    }, []);

    const runNow = async (pipeline: Pipeline) => {
        if (running) return;
        setError(null);
        setRunning(pipeline.id);
        const perms = new PermissionContext();
        setPermissions(perms);
        try {
            if (levelId) {
                const grants = await listGrants(levelId);
                perms.levelGrants = grants.map(toScopedGrant);
            }
            const runtime = buildPipelineRuntime({
                settings,
                fetch: appFetch,
                permissions: perms,
            });
            await runPipeline({
                pipelineId: pipeline.id,
                input: runInput,
                runtime,
                onProgress: () => void refreshRuns(pipeline.id),
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            perms.broker.denyAll();
            setPermissions(null);
            setRunning(null);
            await refreshRuns(pipeline.id);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-end gap-3">
                <label className="flex flex-1 flex-col gap-1 text-sm">
                    What should this run start with?
                    <Input
                        value={runInput}
                        onChange={(e) => setRunInput(e.target.value)}
                        placeholder="e.g. https://news.ycombinator.com"
                    />
                </label>
                <label className="flex w-56 flex-col gap-1 text-sm">
                    Permission level for manual runs
                    <PermissionLevelSelect
                        levels={levels}
                        value={levelId || null}
                        onChange={(id) => setLevelId(id ?? "")}
                    />
                </label>
            </div>

            {permissions && <ApprovalCards broker={permissions.broker} />}
            {error && <p className="text-xs text-destructive">{error}</p>}

            {pipelines.map((p) => (
                <Card key={p.id}>
                    <CardHeader className="flex-row items-center gap-2">
                        <div className="flex-1">
                            <CardTitle>{p.name}</CardTitle>
                            {p.description && (
                                <p className="text-xs text-muted-foreground">
                                    {p.description}
                                </p>
                            )}
                        </div>
                        <Button
                            size="sm"
                            disabled={running !== null}
                            onClick={() => void runNow(p)}
                        >
                            <Play className="mr-1 h-3.5 w-3.5" />
                            {running === p.id ? "Running…" : "Run"}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${p.name}`}
                            onClick={() => setEditing(p)}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${p.name}`}
                            onClick={() =>
                                void pipelinesRepo
                                    .deletePipeline(p.id)
                                    .then(reload)
                            }
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        <button
                            className="cursor-pointer self-start font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                            onClick={() =>
                                runsFor === p.id
                                    ? setRunsFor(null)
                                    : void refreshRuns(p.id)
                            }
                        >
                            {runsFor === p.id ? "hide runs" : "show runs"}
                        </button>
                        {runsFor === p.id && <RunHistory runs={runs} />}
                    </CardContent>
                </Card>
            ))}

            {editing ? (
                <PipelineEditor
                    key={editing === "new" ? "new" : editing.id}
                    pipeline={editing === "new" ? null : editing}
                    agents={agents}
                    onDone={async () => {
                        setEditing(null);
                        await reload();
                    }}
                />
            ) : (
                <Button className="self-start" onClick={() => setEditing("new")}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> New pipeline
                </Button>
            )}
        </div>
    );
}

export function TemplateChips({
    tokens,
    onInsert,
}: {
    tokens: { token: string; label: string }[];
    onInsert: (token: string) => void;
}) {
    return (
        <div className="flex flex-wrap items-center gap-1">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                insert
            </span>
            {tokens.map((t) => (
                <button
                    key={t.token}
                    type="button"
                    onClick={() => onInsert(t.token)}
                    className="cursor-pointer rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                    {t.label}
                </button>
            ))}
        </div>
    );
}

function PipelineEditor({
    pipeline,
    agents,
    onDone,
}: {
    pipeline: Pipeline | null;
    agents: AgentDef[];
    onDone: () => Promise<void>;
}) {
    const [name, setName] = useState(pipeline?.name ?? "");
    const [description, setDescription] = useState(pipeline?.description ?? "");
    const [steps, setSteps] = useState<StepDraft[]>([]);
    const [error, setError] = useState<string | null>(null);
    const taRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

    useEffect(() => {
        if (!pipeline) return;
        void pipelinesRepo
            .listPipelineSteps(pipeline.id)
            .then((existing: PipelineStep[]) =>
                setSteps(
                    existing.map((s) => ({
                        agentId: s.agent_id,
                        promptTemplate: s.prompt_template,
                    })),
                ),
            );
    }, [pipeline]);

    const save = async () => {
        setError(null);
        try {
            if (steps.length === 0)
                throw new Error("a pipeline needs at least one step");
            if (steps.some((s) => !s.agentId))
                throw new Error("every step needs an agent");
            const target = pipeline
                ? await pipelinesRepo.updatePipeline(pipeline.id, {
                      name,
                      description: description || null,
                  })
                : await pipelinesRepo.createPipeline({
                      name,
                      description: description || null,
                  });
            await pipelinesRepo.setPipelineSteps(target.id, steps);
            await onDone();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    const setStep = (i: number, patch: Partial<StepDraft>) =>
        setSteps((all) =>
            all.map((s, j) => (j === i ? { ...s, ...patch } : s)),
        );

    const insertToken = (i: number, token: string) => {
        const ta = taRefs.current[i];
        const cur = steps[i]!.promptTemplate;
        if (!ta) {
            setStep(i, { promptTemplate: cur + token });
            return;
        }
        const start = ta.selectionStart ?? cur.length;
        const end = ta.selectionEnd ?? cur.length;
        setStep(i, {
            promptTemplate: cur.slice(0, start) + token + cur.slice(end),
        });
        requestAnimationFrame(() => {
            ta.focus();
            ta.selectionStart = ta.selectionEnd = start + token.length;
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    {pipeline ? `Edit ${pipeline.name}` : "New pipeline"}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                    Steps run top to bottom. Each step sends its prompt to
                    one agent. Use the insert buttons to reference the run
                    input or an earlier step's output — no syntax to
                    memorize.
                </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <div className="flex gap-3">
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Name
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Description
                        <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </label>
                </div>
                {steps.map((s, i) => (
                    <div
                        key={i}
                        className="flex flex-col gap-2 rounded-md border border-border p-3"
                    >
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                step {i + 1}
                            </span>
                            <Select
                                aria-label={`Agent for step ${i + 1}`}
                                value={s.agentId}
                                onChange={(e) =>
                                    setStep(i, { agentId: e.target.value })
                                }
                                className="w-52"
                            >
                                <option value="">Select agent…</option>
                                {agents.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}
                                    </option>
                                ))}
                            </Select>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Remove step ${i + 1}`}
                                onClick={() =>
                                    setSteps((all) =>
                                        all.filter((_, j) => j !== i),
                                    )
                                }
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                        <TemplateEditor
                            taRef={(el) => {
                                taRefs.current[i] = el;
                            }}
                            rows={2}
                            placeholder="What should this agent do? e.g. Summarize the key points of {{prev}}"
                            value={s.promptTemplate}
                            onChange={(v) => setStep(i, { promptTemplate: v })}
                            knownTokens={[
                                "input",
                                "date",
                                ...(i > 0 ? ["prev"] : []),
                                ...steps.slice(0, i).map((_, j) => `step${j + 1}`),
                            ]}
                        />
                        <TemplateChips
                            tokens={[
                                { token: "{{input}}", label: "run input" },
                                ...(i > 0
                                    ? [{ token: "{{prev}}", label: "previous step" }]
                                    : []),
                                ...steps.slice(0, i).map((_, j) => ({
                                    token: `{{step${j + 1}}}`,
                                    label: `step ${j + 1} output`,
                                })),
                                { token: "{{date}}", label: "today's date" },
                            ]}
                            onInsert={(t) => insertToken(i, t)}
                        />
                    </div>
                ))}
                <Button
                    variant="outline"
                    className="self-start"
                    onClick={() =>
                        setSteps((all) => [
                            ...all,
                            { agentId: "", promptTemplate: "{{prev}}" },
                        ])
                    }
                >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add step
                </Button>
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
