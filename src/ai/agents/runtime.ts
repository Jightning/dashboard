import { generateText, type LanguageModel } from "ai";
import { createModel, type ProviderId } from "@/ai/providers/registry";
import type { Settings } from "@/ai/providers/keys";
import { PermissionContext } from "@/ai/tools/context";
import { listGrants } from "@/db/repo/permissions";
import { toScopedGrant } from "@/ai/permissions/engine";
import { presetAgents, type Preset } from "@/lib/schemas";
import { createOrchestrator } from "./orchestrator";
import type { AgentRuntime, AgentUsageEvent } from "./types";

/**
 * Builds the per-session agent stack from a preset: models from the registry,
 * a fresh PermissionContext loaded with the active level's grants, and the
 * orchestrator wired to the enabled specialists.
 */
export async function buildSessionAgent(opts: {
    preset: Preset;
    settings: Settings;
    permissionLevelId: string | null;
    fetch: typeof globalThis.fetch;
    onUsage?: (event: AgentUsageEvent) => void;
}) {
    const { preset, settings } = opts;
    const provider = preset.provider as ProviderId;
    const runtimeBase = { settings, fetch: opts.fetch };

    const mainModel = createModel(
        { provider, modelId: preset.model },
        runtimeBase,
    );
    const routerModelId = preset.router_model ?? preset.model;
    const routerModel = createModel(
        { provider, modelId: routerModelId },
        runtimeBase,
    );

    const permissions = new PermissionContext();
    if (opts.permissionLevelId) {
        const grants = await listGrants(opts.permissionLevelId);
        permissions.levelGrants = grants.map(toScopedGrant);
    }

    const runtime: AgentRuntime = {
        permissions,
        mainModel,
        mainModelId: preset.model,
        routerModel,
        routerModelId,
        fetch: opts.fetch,
        onUsage: opts.onUsage,
    };

    const orchestrator = createOrchestrator(runtime, {
        systemPrompt: preset.system_prompt,
        enabledAgents: presetAgents(preset),
    });

    return {
        orchestrator,
        permissions,
        runtime,
        summarize: createSummarizer(routerModel),
    };
}

/** Compaction summarizer on the (cheap) router model. */
export function createSummarizer(model: LanguageModel) {
    return async (prompt: string): Promise<string> => {
        const result = await generateText({ model, prompt });
        return result.text;
    };
}

/** Swap the active permission level mid-session (dropdown in the chat header). */
export async function applyPermissionLevel(
    permissions: PermissionContext,
    permissionLevelId: string | null,
): Promise<void> {
    if (!permissionLevelId) {
        permissions.levelGrants = [];
        return;
    }
    const grants = await listGrants(permissionLevelId);
    permissions.levelGrants = grants.map(toScopedGrant);
}
