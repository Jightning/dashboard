import { createContext, useContext } from "react";
import type { SettingsStore, Settings } from "@/ai/providers/keys";

/** App-wide runtime created by bootstrap(): settings store + loaded settings. */
export interface AppRuntime {
    settingsStore: SettingsStore;
    settings: Settings;
    refreshSettings: () => Promise<void>;
}

export const RuntimeContext = createContext<AppRuntime | null>(null);

export function useRuntime(): AppRuntime {
    const runtime = useContext(RuntimeContext);
    if (!runtime) throw new Error("useRuntime called outside RuntimeContext");
    return runtime;
}
