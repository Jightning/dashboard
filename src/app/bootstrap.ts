import { setDb } from "@/db/client";
import { createTauriDbClient } from "@/db/tauriClient";
import { createWebDbClient } from "@/db/webClient";
import { seedBuiltinLevels } from "@/db/repo/permissions";
import { seedBuiltinPresets } from "@/db/repo/presets";
import {
    createTauriSettingsStore,
    createLocalStorageSettingsStore,
    type SettingsStore,
    type Settings,
} from "@/ai/providers/keys";
import { isTauri } from "@/lib/env";

export interface BootResult {
    settingsStore: SettingsStore;
    settings: Settings;
}

let bootPromise: Promise<BootResult> | null = null;

/**
 * Runs once at startup: DB (incl. FTS5 check), settings, idempotent seeds.
 * Branches on isTauri() to pick the desktop (SQLite via Rust) or web (WASM
 * SQLite + OPFS) backends — every other module only ever sees DbClient/
 * SettingsStore and never needs to know which one is active.
 *
 * Memoized as a singleton promise: React 19 StrictMode double-invokes
 * effects in dev, and App.tsx calls this from a useEffect — without this
 * guard, a second concurrent call would race to open the web target's OPFS
 * VFS twice under the same name, which it rejects ("only one instance of
 * this VFS can use the same directory concurrently").
 */
export function bootstrap(): Promise<BootResult> {
    bootPromise ??= runBootstrap();
    return bootPromise;
}

async function runBootstrap(): Promise<BootResult> {
    const db = isTauri() ? await createTauriDbClient() : await createWebDbClient();
    setDb(db);

    const settingsStore = isTauri()
        ? await createTauriSettingsStore()
        : createLocalStorageSettingsStore();
    const settings = await settingsStore.load();

    await seedBuiltinLevels();
    await seedBuiltinPresets({
        provider: settings.defaultProvider,
        model: settings.defaultModel,
        routerModel: settings.routerModel,
    });

    return { settingsStore, settings };
}
