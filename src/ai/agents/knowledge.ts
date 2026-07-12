import { ToolLoopAgent, stepCountIs } from "ai";
import { createDocumentTools } from "@/ai/tools/documents";
import { createNoteTools } from "@/ai/tools/notes";
import type { AgentRuntime } from "./types";

export const KNOWLEDGE_AGENT_INSTRUCTIONS = `You are the knowledge agent: you answer questions from the user's stored documents and notes.
Search first (search_documents / search_notes), read what looks relevant (read_document / read_note),
then answer grounded in what you found. Name the sources you used. If a tool result reports
{denied: true}, the user refused access — say what you could not check and answer from
what you have. If nothing relevant exists, say so plainly.`;

export function createKnowledgeAgent(runtime: AgentRuntime) {
    return new ToolLoopAgent({
        model: runtime.mainModel,
        instructions: KNOWLEDGE_AGENT_INSTRUCTIONS,
        tools: {
            ...createDocumentTools(runtime.permissions),
            ...createNoteTools(runtime.permissions),
        },
        stopWhen: stepCountIs(6),
    });
}
