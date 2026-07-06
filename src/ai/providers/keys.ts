import { z } from "zod";

export const settingsSchema = z.object({
    googleApiKey: z.string().default(""),
    anthropicApiKey: z.string().default(""),
    openaiApiKey: z.string().default(""),
    ollamaBaseUrl: z.string().default("http://localhost:11434"),
    defaultProvider: z
        .enum(["google", "anthropic", "openai", "ollama"])
        .default("google"),
    defaultModel: z.string().default("gemini-2.5-flash"),
    routerModel: z.string().default("gemini-2.5-flash-lite"),
});
export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

export interface SettingsStore {
    load(): Promise<Settings>;
    save(settings: Settings): Promise<void>;
}

/** Real store: tauri-plugin-store JSON file in the app-data dir. */
export async function createTauriSettingsStore(): Promise<SettingsStore> {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load("settings.json");
    return {
        async load() {
            const raw = (await store.get("settings")) ?? {};
            return settingsSchema.parse(raw);
        },
        async save(settings) {
            await store.set("settings", settings);
            await store.save();
        },
    };
}

/** In-memory store for tests and non-Tauri contexts. */
export function createMemorySettingsStore(
    initial?: Partial<Settings>,
): SettingsStore {
    let value = settingsSchema.parse(initial ?? {});
    return {
        async load() {
            return value;
        },
        async save(settings) {
            value = settings;
        },
    };
}
