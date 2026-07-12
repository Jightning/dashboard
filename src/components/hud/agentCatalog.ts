/**
 * Static agent topology (from docs/architecture.md). The single source of each
 * agent's title/role/tools — used by the Agents page cards and by the network
 * builders to spawn tool satellites. Wire live status in later.
 */
export interface AgentSpec {
    name: string;
    title: string;
    role: string;
    tools: string[];
    future?: string;
}

export const AGENT_SPECS: AgentSpec[] = [
    {
        name: "orchestrator",
        title: "Orchestrator",
        role: "Runs on the preset's cheap router model. Answers directly when it can; delegates specialist work as tool calls.",
        tools: ["ask_knowledge_agent", "ask_research_agent"],
    },
    {
        name: "knowledge",
        title: "Knowledge agent",
        role: "Retrieval over your local documents via SQLite FTS5. Runs on the preset's main model.",
        tools: ["search_documents", "read_document", "list_documents"],
    },
    {
        name: "research",
        title: "Research agent",
        role: "Fetches and reads the web, permission-scoped by domain.",
        tools: ["fetch_url"],
    },
    {
        name: "planner",
        title: "Planner agent",
        role: "Plans your week from tasks and the class schedule. Arrives with Tasks.",
        tools: ["list_tasks", "create_task"],
        future: "Phase 4",
    },
];

const BY_NAME = new Map(AGENT_SPECS.map((s) => [s.name, s]));

export function agentSpec(name: string): AgentSpec | undefined {
    return BY_NAME.get(name);
}

/** Tool names an agent exposes (empty for unknown agents). */
export function agentTools(name: string): string[] {
    return BY_NAME.get(name)?.tools ?? [];
}
