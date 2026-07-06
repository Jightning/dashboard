import { setDb } from "@/db/client";
import { createTauriDbClient } from "@/db/tauriClient";
import { seedBuiltinLevels } from "@/db/repo/permissions";
import { seedBuiltinPresets } from "@/db/repo/presets";
import {
    createTauriSettingsStore,
    type SettingsStore,
    type Settings,
} from "@/ai/providers/keys";

export interface BootResult {
    settingsStore: SettingsStore;
    settings: Settings;
}

/** Runs once at startup: DB (incl. FTS5 check), settings, idempotent seeds. */
export async function bootstrap(): Promise<BootResult> {
    const db = await createTauriDbClient();
    setDb(db);

    const settingsStore = await createTauriSettingsStore();
    const settings = await settingsStore.load();

    await seedBuiltinLevels();
    await seedBuiltinPresets({
        provider: settings.defaultProvider,
        model: settings.defaultModel,
        routerModel: settings.routerModel,
    });

    return { settingsStore, settings };
}
