import { ToolLoopAgent, stepCountIs, tool, type ToolSet } from "ai";
import { z } from "zod";
import { agentSlug, delegationToolName, type AgentDef } from "@/lib/schemas";
import { createAgentFromDef } from "./factory";
import type { AgentRuntime } from "./types";

const delegationInput = z.object({
    task: z
        .string()
        .describe(
            "The complete, self-contained task for the specialist, including any context it needs — it cannot see this conversation.",
        ),
});

const ROUTING_ADDENDUM = `
Routing: answer directly when you can. Delegate to a specialist only when the task
needs their capability. Delegations are self-contained — restate any needed context
in the task. After a specialist reports back, compose the final answer yourself.`;

/**
 * The orchestrator: runs on the cheap router model and sees each enabled
 * agent definition as one delegation tool. No agents = plain direct answers.
 */
export function createOrchestrator(
    runtime: AgentRuntime,
    opts: { systemPrompt: string; agents: AgentDef[] },
) {
    const tools: ToolSet = {};
    // Two names can slug to the same delegation tool (e.g. "HN Digest" and
    // "HN-Digest" both -> ask_hn_digest_agent). The agents table only enforces
    // UNIQUE(name), not unique slug, so fail fast rather than silently letting
    // the second agent's tool overwrite the first — a silent loss of the ability
    // to delegate to whichever agent got clobbered.
    const toolOwner = new Map<string, string>();
    for (const def of opts.agents) {
        const toolName = delegationToolName(def);
        const owner = toolOwner.get(toolName);
        if (owner !== undefined) {
            throw new Error(
                `agents "${owner}" and "${def.name}" both map to the delegation tool "${toolName}" ` +
                    `— their names slug identically; rename one so both can be delegated to.`,
            );
        }
        toolOwner.set(toolName, def.name);
        tools[toolName] = tool({
            description: `Ask the ${def.name} agent. ${def.description}`,
            inputSchema: delegationInput,
            execute: async ({ task }) => runSpecialist(def, runtime, task),
        });
    }

    const hasAgents = opts.agents.length > 0;

    return new ToolLoopAgent({
        model: runtime.routerModel,
        instructions: hasAgents
            ? opts.systemPrompt + ROUTING_ADDENDUM
            : opts.systemPrompt,
        tools,
        stopWhen: stepCountIs(6),
        // The chat transport injects the compaction summary as a system message.
        allowSystemInMessages: true,
        onEnd: (event) => {
            runtime.onUsage?.({
                agent: "orchestrator",
                model: runtime.routerModelId,
                usage: event.totalUsage,
            });
        },
    });
}

async function runSpecialist(
    def: AgentDef,
    runtime: AgentRuntime,
    task: string,
): Promise<string> {
    const { agent, modelId } = createAgentFromDef(def, runtime);
    const result = await agent.generate({ prompt: task });
    runtime.onUsage?.({
        agent: agentSlug(def.name),
        model: modelId,
        usage: result.totalUsage,
    });
    return result.text || "(the specialist returned no text)";
}
