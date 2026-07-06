import type { LanguageModel, LanguageModelUsage } from "ai";
import type { PermissionContext } from "@/ai/tools/context";
import type { AgentName } from "@/lib/schemas";

/** Reported after every agent run so the chat layer can persist token usage. */
export interface AgentUsageEvent {
    agent: "orchestrator" | AgentName;
    model: string;
    usage: LanguageModelUsage;
}

/** Everything agents need at construction time; built per session from a preset. */
export interface AgentRuntime {
    permissions: PermissionContext;
    /** Preset's main model — runs the specialists. */
    mainModel: LanguageModel;
    mainModelId: string;
    /** Preset's router model — runs the orchestrator. Falls back to mainModel. */
    routerModel: LanguageModel;
    routerModelId: string;
    /** Injected fetch for the research agent (plugin-http in the app, mocks in tests). */
    fetch: typeof globalThis.fetch;
    onUsage?: (event: AgentUsageEvent) => void;
}
