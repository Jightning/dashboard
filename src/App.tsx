import { useCallback, useEffect, useState } from "react";
import { Shell } from "./app/Shell";
import { bootstrap, type BootResult } from "./app/bootstrap";
import { RuntimeContext } from "./app/runtime";
import type { Settings } from "@/ai/providers/keys";

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

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center p-8">
                <div className="max-w-lg rounded-md border border-destructive p-4 text-sm">
                    <div className="mb-1 font-semibold text-destructive">
                        Startup failed
                    </div>
                    {error}
                </div>
            </div>
        );
    }

    if (!boot || !settings) {
        return (
            <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
                Starting…
            </div>
        );
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
