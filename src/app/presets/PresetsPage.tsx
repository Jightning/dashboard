import { useCallback, useEffect, useState } from "react";
import { Trash2, Pencil } from "lucide-react";
import * as presetsRepo from "@/db/repo/presets";
import { listLevels } from "@/db/repo/permissions";
import { listAgents } from "@/db/repo/agents";
import {
    presetAgents,
    type AgentDef,
    type PermissionLevel,
    type Preset,
} from "@/lib/schemas";
import { PROVIDERS, type ProviderId } from "@/ai/providers/registry";
import { availableProviders } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PresetsPage() {
    const [presets, setPresets] = useState<Preset[]>([]);
    const [levels, setLevels] = useState<PermissionLevel[]>([]);
    const [agents, setAgents] = useState<AgentDef[]>([]);
    const [editing, setEditing] = useState<Preset | "new" | null>(null);

    const reload = useCallback(async () => {
        setPresets(await presetsRepo.listPresets());
        setLevels(await listLevels());
        setAgents(await listAgents());
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mx-auto flex max-w-2xl flex-col gap-4">
                <header>
                    <h1 className="font-display text-2xl font-bold tracking-wide">
                        Context presets
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        A preset bundles a system prompt, models, agents, a
                        permission level, and a token budget. Pick one when
                        starting a chat.
                    </p>
                </header>

                {presets.map((p) => (
                    <Card key={p.id}>
                        <CardHeader className="flex-row items-center justify-between">
                            <div>
                                <CardTitle>{p.name}</CardTitle>
                                <p className="text-xs text-muted-foreground">
                                    {p.provider}/{p.model}
                                    {p.router_model
                                        ? ` · router ${p.router_model}`
                                        : ""}{" "}
                                    · agents:{" "}
                                    {presetAgents(p)
                                        .map(
                                            (id) =>
                                                agents.find(
                                                    (a) => a.id === id,
                                                )?.name ?? id,
                                        )
                                        .join(", ") || "none"}
                                </p>
                            </div>
                            <div className="flex gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Edit preset"
                                    onClick={() => setEditing(p)}
                                >
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                {!p.is_builtin && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Delete preset"
                                        onClick={() =>
                                            void presetsRepo
                                                .deletePreset(p.id)
                                                .then(reload)
                                        }
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                    </Card>
                ))}

                {editing ? (
                    <PresetForm
                        preset={editing === "new" ? null : editing}
                        levels={levels}
                        agents={agents}
                        onDone={async () => {
                            setEditing(null);
                            await reload();
                        }}
                    />
                ) : (
                    <Button
                        className="self-start"
                        onClick={() => setEditing("new")}
                    >
                        New preset
                    </Button>
                )}
            </div>
        </div>
    );
}

function PresetForm({
    preset,
    levels,
    agents,
    onDone,
}: {
    preset: Preset | null;
    levels: PermissionLevel[];
    agents: AgentDef[];
    onDone: () => Promise<void>;
}) {
    const [form, setForm] = useState<presetsRepo.PresetInput>(() =>
        preset
            ? {
                  name: preset.name,
                  description: preset.description,
                  systemPrompt: preset.system_prompt,
                  provider: preset.provider,
                  model: preset.model,
                  routerModel: preset.router_model,
                  enabledAgents: presetAgents(preset),
                  permissionLevelId: preset.permission_level_id,
                  tokenBudget: preset.token_budget,
                  compactionThreshold: preset.compaction_threshold,
              }
            : {
                  name: "",
                  description: null,
                  systemPrompt: "You are a helpful personal assistant.",
                  provider: "google",
                  model: "gemini-2.5-flash",
                  routerModel: "gemini-2.5-flash-lite",
                  enabledAgents: [],
                  permissionLevelId: null,
                  tokenBudget: 100_000,
                  compactionThreshold: presetsRepo.DEFAULT_COMPACTION_THRESHOLD,
              },
    );
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        setError(null);
        try {
            if (preset) await presetsRepo.updatePreset(preset.id, form);
            else await presetsRepo.createPreset(form);
            await onDone();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    const toggleAgent = (id: string) => {
        setForm((f) => ({
            ...f,
            enabledAgents: f.enabledAgents.includes(id)
                ? f.enabledAgents.filter((a) => a !== id)
                : [...f.enabledAgents, id],
        }));
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    {preset ? `Edit ${preset.name}` : "New preset"}
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-sm">
                    Name
                    <Input
                        value={form.name}
                        onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                        }
                    />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                    System prompt
                    <Textarea
                        rows={4}
                        value={form.systemPrompt}
                        onChange={(e) =>
                            setForm({ ...form, systemPrompt: e.target.value })
                        }
                    />
                </label>
                <div className="flex gap-3">
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Provider
                        <Select
                            value={form.provider}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    provider: e.target.value as ProviderId,
                                })
                            }
                        >
                            {Object.entries(PROVIDERS).map(([id, p]) => {
                                const available = availableProviders().includes(
                                    id as ProviderId,
                                );
                                return (
                                    <option
                                        key={id}
                                        value={id}
                                        disabled={!available}
                                    >
                                        {p.label}
                                        {!available && " (desktop only)"}
                                    </option>
                                );
                            })}
                        </Select>
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Model
                        <Input
                            value={form.model}
                            onChange={(e) =>
                                setForm({ ...form, model: e.target.value })
                            }
                        />
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Router model
                        <Input
                            value={form.routerModel ?? ""}
                            placeholder="(same as model)"
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    routerModel: e.target.value || null,
                                })
                            }
                        />
                    </label>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                    Agents:
                    {agents.map((a) => (
                        <label key={a.id} className="flex items-center gap-1.5">
                            <input
                                type="checkbox"
                                checked={form.enabledAgents.includes(a.id)}
                                onChange={() => toggleAgent(a.id)}
                            />
                            {a.name}
                        </label>
                    ))}
                </div>
                <div className="flex gap-3">
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Permission level
                        <Select
                            value={form.permissionLevelId ?? ""}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    permissionLevelId: e.target.value || null,
                                })
                            }
                        >
                            <option value="">Ask everything (no level)</option>
                            {levels.map((l) => (
                                <option key={l.id} value={l.id}>
                                    {l.name}
                                </option>
                            ))}
                        </Select>
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Token budget
                        <Input
                            type="number"
                            value={form.tokenBudget ?? ""}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    tokenBudget: e.target.value
                                        ? Number(e.target.value)
                                        : null,
                                })
                            }
                        />
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Compaction threshold
                        <Input
                            type="number"
                            value={form.compactionThreshold ?? ""}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    compactionThreshold: e.target.value
                                        ? Number(e.target.value)
                                        : null,
                                })
                            }
                        />
                    </label>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={() => void save()}>Save</Button>
                    <Button variant="ghost" onClick={() => void onDone()}>
                        Cancel
                    </Button>
                    {error && (
                        <span className="text-xs text-destructive">
                            {error}
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
