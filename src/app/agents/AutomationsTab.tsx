import { useCallback, useEffect, useState } from "react";
import { Pencil, Play, Plus, Trash2 } from "lucide-react";
import * as automationsRepo from "@/db/repo/automations";
import { listPipelines, listRuns } from "@/db/repo/pipelines";
import { listLevels } from "@/db/repo/permissions";
import { listProjects } from "@/db/repo/projects";
import { runAutomation } from "@/ai/automations/run";
import { appFetch } from "@/ai/providers/appFetch";
import { useRuntime } from "@/app/runtime";
import { PermissionLevelSelect } from "@/components/PermissionLevelSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
    Automation,
    PermissionLevel,
    Pipeline,
    PipelineRun,
    Project,
    ScheduleKind,
} from "@/lib/schemas";
import { RunHistory } from "./RunHistory";
import { TemplateChips } from "./PipelinesTab";
import { TemplateEditor } from "./TemplateEditor";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AutomationsTab() {
    const { settings } = useRuntime();
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [levels, setLevels] = useState<PermissionLevel[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [editing, setEditing] = useState<Automation | "new" | null>(null);
    const [runsFor, setRunsFor] = useState<string | null>(null);
    const [runs, setRuns] = useState<PipelineRun[]>([]);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setAutomations(await automationsRepo.listAutomations());
        setPipelines(await listPipelines());
        setLevels(await listLevels());
        setProjects(await listProjects());
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);

    const showRuns = async (a: Automation) => {
        setRunsFor(a.id);
        setRuns(await listRuns({ automationId: a.id }));
    };

    const runNow = async (a: Automation) => {
        setBusy(a.id);
        setError(null);
        try {
            // Same headless semantics as a scheduled fire: out-of-level denies.
            await runAutomation(a, { settings, fetch: appFetch });
            await showRuns(a);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(null);
        }
    };

    const pipelineName = (id: string) =>
        pipelines.find((p) => p.id === id)?.name ?? id;

    return (
        <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
                Automations fire while the app is open; anything outside the
                chosen permission level is denied — no approval cards, no
                surprises. Overdue schedules catch up once at launch.
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}

            {automations.map((a) => (
                <Card key={a.id}>
                    <CardHeader className="flex-row items-center gap-2">
                        <div className="flex-1">
                            <CardTitle>{a.name}</CardTitle>
                            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                {pipelineName(a.pipeline_id)} ·{" "}
                                {describeSchedule(a)} · next{" "}
                                {a.next_run_at
                                    ? new Date(a.next_run_at).toLocaleString()
                                    : "—"}
                                {a.last_run_at
                                    ? ` · last ${new Date(a.last_run_at).toLocaleString()}`
                                    : ""}
                            </p>
                        </div>
                        <Badge tone={a.enabled ? "success" : "neutral"}>
                            {a.enabled ? "enabled" : "paused"}
                        </Badge>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                void automationsRepo
                                    .setAutomationEnabled(a.id, !a.enabled)
                                    .then(reload)
                            }
                        >
                            {a.enabled ? "Pause" : "Enable"}
                        </Button>
                        <Button
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => void runNow(a)}
                        >
                            <Play className="mr-1 h-3.5 w-3.5" />
                            {busy === a.id ? "Running…" : "Run now"}
                        </Button>
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
                            aria-label={`Delete ${a.name}`}
                            onClick={() =>
                                void automationsRepo
                                    .deleteAutomation(a.id)
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
                                runsFor === a.id
                                    ? setRunsFor(null)
                                    : void showRuns(a)
                            }
                        >
                            {runsFor === a.id ? "hide runs" : "show runs"}
                        </button>
                        {runsFor === a.id && (
                            <RunHistory
                                runs={runs}
                                pipelineName={pipelineName(a.pipeline_id)}
                            />
                        )}
                    </CardContent>
                </Card>
            ))}

            {editing ? (
                <AutomationEditor
                    automation={editing === "new" ? null : editing}
                    pipelines={pipelines}
                    levels={levels}
                    projects={projects}
                    onDone={async () => {
                        setEditing(null);
                        await reload();
                    }}
                />
            ) : (
                <Button className="self-start" onClick={() => setEditing("new")}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> New automation
                </Button>
            )}
        </div>
    );
}

function describeSchedule(a: Automation): string {
    switch (a.schedule_kind) {
        case "interval":
            return `every ${a.interval_minutes} min`;
        case "daily":
            return `daily ${a.time_of_day}`;
        case "weekly":
            return `${DAYS[a.day_of_week ?? 0]} ${a.time_of_day}`;
    }
}

function AutomationEditor({
    automation,
    pipelines,
    levels,
    projects,
    onDone,
}: {
    automation: Automation | null;
    pipelines: Pipeline[];
    levels: PermissionLevel[];
    projects: Project[];
    onDone: () => Promise<void>;
}) {
    const [form, setForm] = useState<automationsRepo.AutomationInput>(() =>
        automation
            ? {
                  name: automation.name,
                  pipelineId: automation.pipeline_id,
                  scheduleKind: automation.schedule_kind,
                  intervalMinutes: automation.interval_minutes,
                  timeOfDay: automation.time_of_day,
                  dayOfWeek: automation.day_of_week,
                  inputTemplate: automation.input_template,
                  permissionLevelId: automation.permission_level_id,
                  outputNoteFolder: automation.output_note_folder,
                  projectId: automation.project_id,
              }
            : {
                  name: "",
                  pipelineId: "",
                  scheduleKind: "daily",
                  intervalMinutes: null,
                  timeOfDay: "09:00",
                  dayOfWeek: null,
                  inputTemplate: "",
                  permissionLevelId: null,
                  outputNoteFolder: "/automations",
                  projectId: null,
              },
    );
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        setError(null);
        try {
            if (!form.pipelineId)
                throw new Error("pick a pipeline for this automation");
            if (automation)
                await automationsRepo.updateAutomation(automation.id, form);
            else await automationsRepo.createAutomation(form);
            await onDone();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    {automation ? `Edit ${automation.name}` : "New automation"}
                </CardTitle>
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
                        Pipeline
                        <Select
                            value={form.pipelineId}
                            onChange={(e) =>
                                setForm({ ...form, pipelineId: e.target.value })
                            }
                        >
                            <option value="">Select pipeline…</option>
                            {pipelines.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </Select>
                    </label>
                </div>
                <div className="flex gap-3">
                    <label className="flex w-36 flex-col gap-1 text-sm">
                        Schedule
                        <Select
                            value={form.scheduleKind}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    scheduleKind: e.target
                                        .value as ScheduleKind,
                                })
                            }
                        >
                            <option value="interval">Interval</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                        </Select>
                    </label>
                    {form.scheduleKind === "interval" && (
                        <label className="flex w-36 flex-col gap-1 text-sm">
                            Every N minutes
                            <Input
                                type="number"
                                min={1}
                                value={form.intervalMinutes ?? ""}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        intervalMinutes: e.target.value
                                            ? Number(e.target.value)
                                            : null,
                                    })
                                }
                            />
                        </label>
                    )}
                    {form.scheduleKind !== "interval" && (
                        <label className="flex w-32 flex-col gap-1 text-sm">
                            Time (HH:MM)
                            <Input
                                value={form.timeOfDay ?? ""}
                                placeholder="09:00"
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        timeOfDay: e.target.value || null,
                                    })
                                }
                            />
                        </label>
                    )}
                    {form.scheduleKind === "weekly" && (
                        <label className="flex w-32 flex-col gap-1 text-sm">
                            Day
                            <Select
                                value={String(form.dayOfWeek ?? 1)}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        dayOfWeek: Number(e.target.value),
                                    })
                                }
                            >
                                {DAYS.map((d, i) => (
                                    <option key={d} value={i}>
                                        {d}
                                    </option>
                                ))}
                            </Select>
                        </label>
                    )}
                </div>
                <label className="flex flex-col gap-1 text-sm">
                    What each run starts with
                    <TemplateEditor
                        rows={1}
                        value={form.inputTemplate}
                        placeholder="e.g. Summarize https://news.ycombinator.com for {{date}}"
                        onChange={(v) => setForm({ ...form, inputTemplate: v })}
                        knownTokens={["date"]}
                    />
                </label>
                <TemplateChips
                    tokens={[{ token: "{{date}}", label: "today's date" }]}
                    onInsert={(t) =>
                        setForm({
                            ...form,
                            inputTemplate: form.inputTemplate + t,
                        })
                    }
                />
                <div className="flex gap-3">
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Permission level (out-of-level calls are denied)
                        <PermissionLevelSelect
                            levels={levels}
                            value={form.permissionLevelId ?? null}
                            nullLabel="None (deny all tool calls)"
                            onChange={(id) =>
                                setForm({ ...form, permissionLevelId: id })
                            }
                        />
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Save output as note in folder (blank = don't)
                        <Input
                            value={form.outputNoteFolder ?? ""}
                            placeholder="/automations"
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    outputNoteFolder: e.target.value || null,
                                })
                            }
                        />
                    </label>
                </div>
                <label className="flex w-64 flex-col gap-1 text-sm">
                    Project
                    <Select
                        value={form.projectId ?? ""}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                projectId: e.target.value || null,
                            })
                        }
                    >
                        <option value="">No project</option>
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </Select>
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
