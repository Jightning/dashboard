import { useEffect, useState } from "react";
import { useRuntime } from "@/app/runtime";
import { settingsSchema, type Settings } from "@/ai/providers/keys";
import {
    PROVIDERS,
    SUGGESTED_MODELS,
    type ProviderId,
} from "@/ai/providers/registry";
import { appFetch } from "@/ai/providers/appFetch";
import { availableProviders, isTauri } from "@/lib/env";
import { runDailyBackup, exportNotesMarkdown } from "@/lib/backup";
import { usageByDay, type DailyUsage } from "@/db/repo/usage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SettingsPage() {
    const { settingsStore, settings, refreshSettings } = useRuntime();
    const [form, setForm] = useState<Settings>(settings);
    const [saved, setSaved] = useState(false);
    const [backupStatus, setBackupStatus] = useState<string | null>(null);
    const [usage, setUsage] = useState<DailyUsage[]>([]);
    const [ollamaStatus, setOllamaStatus] = useState<string | null>(null);
    const [ollamaModels, setOllamaModels] = useState<string[]>([]);

    useEffect(() => {
        usageByDay(14).then(setUsage).catch((e) => console.error(e));
    }, []);

    const testOllama = async () => {
        setOllamaStatus("checking…");
        setOllamaModels([]);
        try {
            const res = await appFetch(`${form.ollamaBaseUrl}/api/tags`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = (await res.json()) as { models?: { name: string }[] };
            const names = (data.models ?? []).map((m) => m.name);
            setOllamaModels(names);
            setOllamaStatus(
                names.length
                    ? `connected — ${names.length} model${names.length === 1 ? "" : "s"} installed`
                    : "connected, but no models installed — run: ollama pull llama3.2:3b",
            );
        } catch (e) {
            setOllamaStatus(
                `not reachable (${e instanceof Error ? e.message : String(e)}) — is Ollama running?`,
            );
        }
    };

    const backUpNow = async () => {
        setBackupStatus("backing up…");
        try {
            const path = await runDailyBackup();
            setBackupStatus(path ? `backed up to ${path}` : "already backed up today");
        } catch (e) {
            setBackupStatus(`backup failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    const exportNotes = async () => {
        const blob = await exportNotesMarkdown();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `notes-${new Date().toISOString().slice(0, 10)}.md`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
        setSaved(false);
        setForm((f) => ({ ...f, [key]: value }));
    };

    const save = async () => {
        await settingsStore.save(settingsSchema.parse(form));
        await refreshSettings();
        setSaved(true);
    };

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mx-auto flex max-w-xl flex-col gap-4">
                <header>
                    <h1 className="font-display text-2xl font-semibold tracking-wide">
                        Settings
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Providers, keys, and default models.
                    </p>
                </header>
                <Card>
                    <CardHeader>
                        <CardTitle>API keys</CardTitle>
                        <p className="text-xs text-muted-foreground">
                            Stored in a local file in the app data directory —
                            never in the database.
                        </p>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <label className="flex flex-col gap-1 text-sm">
                            Google Gemini (free tier)
                            <Input
                                type="password"
                                value={form.googleApiKey}
                                onChange={(e) =>
                                    set("googleApiKey", e.target.value)
                                }
                                placeholder="AIza…"
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                            Anthropic (optional, BYOK)
                            <Input
                                type="password"
                                value={form.anthropicApiKey}
                                onChange={(e) =>
                                    set("anthropicApiKey", e.target.value)
                                }
                                placeholder="sk-ant-…"
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                            OpenAI (optional, BYOK)
                            <Input
                                type="password"
                                value={form.openaiApiKey}
                                onChange={(e) =>
                                    set("openaiApiKey", e.target.value)
                                }
                                placeholder="sk-…"
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                            Ollama base URL
                            <Input
                                value={form.ollamaBaseUrl}
                                onChange={(e) =>
                                    set("ollamaBaseUrl", e.target.value)
                                }
                            />
                        </label>
                        <div className="flex items-center gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={testOllama}
                            >
                                Test connection
                            </Button>
                            {ollamaStatus && (
                                <span className="font-mono text-xs text-muted-foreground">
                                    {ollamaStatus}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Free local models: llama3.2:3b (fast, ~2GB) or
                            qwen3:4b (better reasoning, ~2.6GB). Install
                            Ollama from ollama.com, then{" "}
                            <code>ollama pull llama3.2:3b</code>. If you open
                            this app from a hosted URL instead of localhost,
                            Ollama must allow that origin: set{" "}
                            <code>OLLAMA_ORIGINS=https://your-site.example</code>{" "}
                            before starting Ollama. Requests go straight from
                            your browser to localhost — your machine, your
                            model, nothing leaves.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Default models</CardTitle>
                        <p className="text-xs text-muted-foreground">
                            Used by new presets. The router model handles
                            orchestration and compaction — pick something cheap
                            and fast.
                        </p>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <label className="flex flex-col gap-1 text-sm">
                            Default provider
                            <Select
                                value={form.defaultProvider}
                                onChange={(e) =>
                                    set(
                                        "defaultProvider",
                                        e.target.value as ProviderId,
                                    )
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
                        <label className="flex flex-col gap-1 text-sm">
                            Default model
                            <Input
                                value={form.defaultModel}
                                onChange={(e) =>
                                    set("defaultModel", e.target.value)
                                }
                                list="model-suggestions"
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                            Router model
                            <Input
                                value={form.routerModel}
                                onChange={(e) =>
                                    set("routerModel", e.target.value)
                                }
                                list="model-suggestions"
                            />
                        </label>
                        <datalist id="model-suggestions">
                            {(form.defaultProvider === "ollama" &&
                            ollamaModels.length > 0
                                ? ollamaModels
                                : SUGGESTED_MODELS[form.defaultProvider]
                            ).map((m) => (
                                <option key={m} value={m} />
                            ))}
                        </datalist>
                    </CardContent>
                </Card>

                <div className="flex items-center gap-3">
                    <Button onClick={save}>Save</Button>
                    {saved && (
                        <span className="font-mono text-xs uppercase tracking-wider text-success">
                            saved
                        </span>
                    )}
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Data</CardTitle>
                        <p className="text-xs text-muted-foreground">
                            Daily backups run automatically on launch. Export
                            is a manual escape hatch that works on any target.
                        </p>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                            {isTauri() && (
                                <Button variant="outline" onClick={backUpNow}>
                                    Back up now
                                </Button>
                            )}
                            <Button variant="outline" onClick={exportNotes}>
                                Export notes (.md)
                            </Button>
                        </div>
                        {backupStatus && (
                            <span className="font-mono text-xs text-muted-foreground">
                                {backupStatus}
                            </span>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Usage</CardTitle>
                        <p className="text-xs text-muted-foreground">
                            Gemini free tier resets daily; Ollama is always
                            $0.
                        </p>
                    </CardHeader>
                    <CardContent>
                        {usage.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                No token usage recorded yet.
                            </p>
                        ) : (
                            <table className="w-full font-mono text-xs">
                                <thead>
                                    <tr className="text-left text-muted-foreground">
                                        <th className="pr-4 pb-1 font-medium">day</th>
                                        <th className="pr-4 pb-1 font-medium">model</th>
                                        <th className="pr-4 pb-1 font-medium">in</th>
                                        <th className="pb-1 font-medium">out</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usage.map((row) => (
                                        <tr key={`${row.day}-${row.model}`}>
                                            <td className="pr-4 py-0.5">{row.day}</td>
                                            <td className="pr-4 py-0.5">{row.model}</td>
                                            <td className="pr-4 py-0.5">{row.inputTokens}</td>
                                            <td className="py-0.5">{row.outputTokens}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
