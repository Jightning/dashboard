import type { LanguageModel, LanguageModelUsage } from "ai";
import type { PermissionContext } from "@/ai/tools/context";

/** Reported after every agent run so callers can persist token usage. */
export interface AgentUsageEvent {
    /** "orchestrator" or an agent slug (agentSlug of its name). */
    agent: string;
    model: string;
    usage: LanguageModelUsage;
}

/** Everything agents need at construction time; built per session from a preset. */
export interface AgentRuntime {
    permissions: PermissionContext;
    /** Preset's main model — default for specialists. */
    mainModel: LanguageModel;
    mainModelId: string;
    /** Preset's router model — runs the orchestrator. Falls back to mainModel. */
    routerModel: LanguageModel;
    routerModelId: string;
    /** Builds a model for a per-agent model override (same provider). */
    resolveModel: (modelId: string) => LanguageModel;
    /** Injected fetch (plugin-http in the app, mocks in tests). */
    fetch: typeof globalThis.fetch;
    onUsage?: (event: AgentUsageEvent) => void;
}
