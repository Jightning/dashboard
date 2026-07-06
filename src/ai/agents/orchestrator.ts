import { ToolLoopAgent, stepCountIs, tool, type ToolSet } from "ai";
import { z } from "zod";
import type { AgentName } from "@/lib/schemas";
import { createKnowledgeAgent } from "./knowledge";
import { createResearchAgent } from "./research";
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
 * The orchestrator: runs on the cheap router model, sees specialists as tools,
 * and can always answer directly (Quick Q&A presets simply enable no agents).
 */
export function createOrchestrator(
    runtime: AgentRuntime,
    opts: { systemPrompt: string; enabledAgents: AgentName[] },
) {
    const tools: ToolSet = {};

    if (opts.enabledAgents.includes("knowledge")) {
        tools.ask_knowledge_agent = tool({
            description:
                "Ask the knowledge agent, which searches and reads the user's stored documents (notes, PDFs). Use for anything that could be answered from the user's own material.",
            inputSchema: delegationInput,
            execute: async ({ task }) =>
                runSpecialist("knowledge", runtime, task),
        });
    }

    if (opts.enabledAgents.includes("research")) {
        tools.ask_research_agent = tool({
            description:
                "Ask the research agent, which reads specific web pages. Use when the user provides URLs or asks about the content of a particular site.",
            inputSchema: delegationInput,
            execute: async ({ task }) =>
                runSpecialist("research", runtime, task),
        });
    }

    const hasAgents = Object.keys(tools).length > 0;

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
    name: AgentName,
    runtime: AgentRuntime,
    task: string,
): Promise<string> {
    const agent =
        name === "knowledge"
            ? createKnowledgeAgent(runtime)
            : createResearchAgent(runtime);
    const result = await agent.generate({ prompt: task });
    runtime.onUsage?.({
        agent: name,
        model: runtime.mainModelId,
        usage: result.totalUsage,
    });
    return result.text || "(the specialist returned no text)";
}
