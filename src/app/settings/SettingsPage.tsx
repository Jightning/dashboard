import { useState } from "react";
import { useRuntime } from "@/app/runtime";
import { settingsSchema, type Settings } from "@/ai/providers/keys";
import {
    PROVIDERS,
    SUGGESTED_MODELS,
    type ProviderId,
} from "@/ai/providers/registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SettingsPage() {
    const { settingsStore, settings, refreshSettings } = useRuntime();
    const [form, setForm] = useState<Settings>(settings);
    const [saved, setSaved] = useState(false);

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
                                {Object.entries(PROVIDERS).map(([id, p]) => (
                                    <option key={id} value={id}>
                                        {p.label}
                                    </option>
                                ))}
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
                            {SUGGESTED_MODELS[form.defaultProvider].map((m) => (
                                <option key={m} value={m} />
                            ))}
                        </datalist>
                    </CardContent>
                </Card>

                <div className="flex items-center gap-3">
                    <Button onClick={save}>Save</Button>
                    {saved && (
                        <span className="text-xs text-muted-foreground">
                            Saved.
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
