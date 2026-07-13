import { useCallback, useEffect, useState } from "react";
import { Shell } from "./app/Shell";
import { bootstrap, type BootResult } from "./app/bootstrap";
import { RuntimeContext } from "./app/runtime";
import { NeuralCore } from "@/components/hud/NeuralCore";
import { Typewriter } from "@/components/hud/Typewriter";
import { startAutomationScheduler } from "@/ai/automations/scheduler";
import { appFetch } from "@/ai/providers/appFetch";
import type { Settings } from "@/ai/providers/keys";

function BootScreen() {
    return (
        <div className="flex h-screen flex-col items-center justify-center gap-5">
            <NeuralCore size={260} state="thinking" />
            <div className="font-display text-glow text-xl font-bold tracking-[0.25em] text-primary">
                Hugh
            </div>
            <div className="h-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                <Typewriter text="migrating db · loading keys · linking providers" />
            </div>
        </div>
    );
}

export default function App() {
    const [boot, setBoot] = useState<BootResult | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        bootstrap()
            .then((b) => {
                setBoot(b);
                setSettings(b.settings);
            })
            .catch((e: unknown) =>
                setError(e instanceof Error ? e.message : String(e)),
            );
    }, []);

    const refreshSettings = useCallback(async () => {
        if (!boot) return;
        setSettings(await boot.settingsStore.load());
    }, [boot]);

    useEffect(() => {
        if (!boot || !settings) return;
        return startAutomationScheduler({ settings, fetch: appFetch });
    }, [boot, settings]);

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center p-8">
                <div
                    className="hud-panel hud-corners max-w-lg p-5 text-sm"
                    style={
                        {
                            "--corner-color": "var(--destructive)",
                            borderColor:
                                "color-mix(in oklab, var(--destructive) 50%, transparent)",
                        } as React.CSSProperties
                    }
                >
                    <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-destructive">
                        startup failure
                    </div>
                    <div className="font-mono text-xs">{error}</div>
                </div>
            </div>
        );
    }

    if (!boot || !settings) {
        return <BootScreen />;
    }

    return (
        <RuntimeContext.Provider
            value={{
                settingsStore: boot.settingsStore,
                settings,
                refreshSettings,
            }}
        >
            <Shell />
        </RuntimeContext.Provider>
    );
}
