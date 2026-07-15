import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { presetSchema, type Preset } from "@/lib/schemas";
import { BUILTIN_LEVELS } from "./permissions";
import { BUILTIN_AGENT_IDS } from "./agents";

export interface PresetInput {
    name: string;
    description?: string | null;
    systemPrompt: string;
    provider: string;
    model: string;
    routerModel?: string | null;
    enabledAgents: string[];
    permissionLevelId?: string | null;
    tokenBudget?: number | null;
    compactionThreshold?: number | null;
}

/** Default compaction threshold (tokens of estimated context). */
export const DEFAULT_COMPACTION_THRESHOLD = 24_000;

export async function seedBuiltinPresets(defaults: {
    provider: string;
    model: string;
    routerModel: string;
}): Promise<void> {
    const seeds: Array<{ id: string } & PresetInput> = [
        {
            id: "pre_quick_qa",
            name: "Quick Q&A",
            description: "Direct answers, no agents, no tools, cheap model.",
            systemPrompt:
                "You are a concise personal assistant. Answer directly from your own knowledge. Keep answers short.",
            provider: defaults.provider,
            model: defaults.routerModel,
            routerModel: defaults.routerModel,
            enabledAgents: [],
            permissionLevelId: null,
            tokenBudget: 30_000,
            compactionThreshold: 12_000,
        },
        {
            id: "pre_study",
            name: "Study",
            description: "Knowledge agent over your documents, read-only.",
            systemPrompt:
                "You are a study assistant. Ground answers in the user's documents via the knowledge agent whenever the question could relate to stored material. Cite which document you used.",
            provider: defaults.provider,
            model: defaults.model,
            routerModel: defaults.routerModel,
            enabledAgents: [BUILTIN_AGENT_IDS.knowledge],
            permissionLevelId: BUILTIN_LEVELS.readDocuments,
            tokenBudget: 100_000,
            compactionThreshold: DEFAULT_COMPACTION_THRESHOLD,
        },
        {
            id: "pre_research",
            name: "Research",
            description:
                "Knowledge + research agents; web fetches ask unless granted.",
            systemPrompt:
                "You are a research assistant. Use the knowledge agent for stored material and the research agent to read specific web pages. Distinguish clearly between stored knowledge and fetched sources.",
            provider: defaults.provider,
            model: defaults.model,
            routerModel: defaults.routerModel,
            enabledAgents: [
                BUILTIN_AGENT_IDS.knowledge,
                BUILTIN_AGENT_IDS.research,
            ],
            permissionLevelId: BUILTIN_LEVELS.readDocuments,
            tokenBudget: 150_000,
            compactionThreshold: DEFAULT_COMPACTION_THRESHOLD,
        },
    ];

    const t = now();
    for (const s of seeds) {
        await getDb().execute(
            `INSERT OR IGNORE INTO presets
         (id, name, description, system_prompt, provider, model, router_model,
          enabled_agents_json, permission_level_id, token_budget, compaction_threshold,
          is_builtin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
            [
                s.id,
                s.name,
                s.description ?? null,
                s.systemPrompt,
                s.provider,
                s.model,
                s.routerModel ?? null,
                JSON.stringify(s.enabledAgents),
                s.permissionLevelId ?? null,
                s.tokenBudget ?? null,
                s.compactionThreshold ?? null,
                t,
                t,
            ],
        );
    }
}

export async function createPreset(input: PresetInput): Promise<Preset> {
    const id = newId("pre");
    const t = now();
    await getDb().execute(
        `INSERT INTO presets
       (id, name, description, system_prompt, provider, model, router_model,
        enabled_agents_json, permission_level_id, token_budget, compaction_threshold,
        is_builtin, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
            id,
            input.name,
            input.description ?? null,
            input.systemPrompt,
            input.provider,
            input.model,
            input.routerModel ?? null,
            JSON.stringify(input.enabledAgents),
            input.permissionLevelId ?? null,
            input.tokenBudget ?? null,
            input.compactionThreshold ?? null,
            t,
            t,
        ],
    );
    return getPreset(id);
}

export async function updatePreset(
    id: string,
    input: PresetInput,
): Promise<Preset> {
    await getDb().execute(
        `UPDATE presets SET
       name = ?, description = ?, system_prompt = ?, provider = ?, model = ?,
       router_model = ?, enabled_agents_json = ?, permission_level_id = ?,
       token_budget = ?, compaction_threshold = ?, updated_at = ?
     WHERE id = ?`,
        [
            input.name,
            input.description ?? null,
            input.systemPrompt,
            input.provider,
            input.model,
            input.routerModel ?? null,
            JSON.stringify(input.enabledAgents),
            input.permissionLevelId ?? null,
            input.tokenBudget ?? null,
            input.compactionThreshold ?? null,
            now(),
            id,
        ],
    );
    return getPreset(id);
}

export async function getPreset(id: string): Promise<Preset> {
    const rows = await getDb().select("SELECT * FROM presets WHERE id = ?", [
        id,
    ]);
    if (!rows[0]) throw new Error(`preset not found: ${id}`);
    return presetSchema.parse(rows[0]);
}

export async function listPresets(): Promise<Preset[]> {
    const rows = await getDb().select(
        "SELECT * FROM presets ORDER BY created_at ASC",
    );
    return rows.map((r) => presetSchema.parse(r));
}

export async function deletePreset(id: string): Promise<void> {
    const preset = await getPreset(id);
    if (preset.is_builtin)
        throw new Error("built-in presets cannot be deleted");
    await getDb().execute("DELETE FROM presets WHERE id = ?", [id]);
}
