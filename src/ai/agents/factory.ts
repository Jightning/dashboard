import { ToolLoopAgent, stepCountIs } from "ai";
import { buildToolSet } from "@/ai/tools/catalog";
import { agentToolNames, type AgentDef } from "@/lib/schemas";
import type { AgentRuntime } from "./types";

/**
 * Instantiates a runnable specialist from its DB definition: instructions as
 * the system prompt, catalog tool subset, and the preset main model unless the
 * definition overrides it.
 */
export function createAgentFromDef(def: AgentDef, runtime: AgentRuntime) {
    const model = def.model
        ? runtime.resolveModel(def.model)
        : runtime.mainModel;
    const agent = new ToolLoopAgent({
        model,
        instructions: def.instructions,
        tools: buildToolSet(agentToolNames(def), {
            permissions: runtime.permissions,
            fetch: runtime.fetch,
        }),
        stopWhen: stepCountIs(def.max_steps),
    });
    return { agent, modelId: def.model ?? runtime.mainModelId };
}
