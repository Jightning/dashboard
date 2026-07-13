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
    for (const def of opts.agents) {
        tools[delegationToolName(def)] = tool({
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
