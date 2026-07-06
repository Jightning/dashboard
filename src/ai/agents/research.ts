import { ToolLoopAgent, stepCountIs } from "ai";
import { createWebTools } from "@/ai/tools/web";
import type { AgentRuntime } from "./types";

export const RESEARCH_AGENT_INSTRUCTIONS = `You are the research agent: you read specific web pages with fetch_url and report
what they say. Only fetch URLs that were given to you or that appear in pages you
already fetched. Quote or closely paraphrase sources and name the URL for each claim.
If a tool result reports {denied: true}, the user refused that fetch — do not retry
the same domain; report what you could not access.`;

export function createResearchAgent(runtime: AgentRuntime) {
    return new ToolLoopAgent({
        model: runtime.mainModel,
        instructions: RESEARCH_AGENT_INSTRUCTIONS,
        tools: createWebTools(runtime.permissions, runtime.fetch),
        stopWhen: stepCountIs(6),
    });
}
