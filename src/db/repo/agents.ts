import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { agentDefSchema, type AgentDef } from "@/lib/schemas";

export interface AgentInput {
    name: string;
    description: string;
    instructions: string;
    tools: string[];
    model?: string | null;
    maxSteps?: number;
    color?: string | null;
}

export const BUILTIN_AGENT_IDS = {
    knowledge: "agt_knowledge",
    research: "agt_research",
    planner: "agt_planner",
} as const;

const KNOWLEDGE_INSTRUCTIONS = `You are the knowledge agent: you answer questions from the user's stored documents and notes.
Search first (search_documents / search_notes), read what looks relevant (read_document / read_note),
then answer grounded in what you found. Name the sources you used. If a tool result reports
{denied: true}, the user refused access — say what you could not check and answer from
what you have. If nothing relevant exists, say so plainly.`;

const RESEARCH_INSTRUCTIONS = `Start broad with search_web, then fetch_url the most promising results. Prefer primary sources.
You are the research agent: you read specific web pages with fetch_url and report
what they say. Only fetch URLs that were given to you or that appear in pages you
already fetched. Quote or closely paraphrase sources and name the URL for each claim.
If a tool result reports {denied: true}, the user refused that fetch — do not retry
the same domain; report what you could not access.`;

const PLANNER_INSTRUCTIONS = `You are the planner agent for a busy engineering student.
Ground every plan in real data: list_tasks and list_events first, and
list_applications when career work is in scope. Propose a concrete, realistic
schedule around fixed classes; respect due dates; batch similar work. Create
tasks only when the user asked for them (create_task), and say exactly what
you created. If a tool result reports {denied: true}, plan without that data
and say what you could not see.`;

/** Idempotent — called from bootstrap() on every start, like preset seeds. */
export async function seedBuiltinAgents(): Promise<void> {
    const seeds: Array<{ id: string } & AgentInput> = [
        {
            id: BUILTIN_AGENT_IDS.knowledge,
            name: "Knowledge",
            description:
                "Searches and reads the user's stored documents and notes. Use for anything that could be answered from the user's own material.",
            instructions: KNOWLEDGE_INSTRUCTIONS,
            tools: [
                "search_documents",
                "read_document",
                "list_documents",
                "search_notes",
                "read_note",
                "list_notes",
            ],
        },
        {
            id: BUILTIN_AGENT_IDS.research,
            name: "Research",
            description:
                "Searches the web and reads pages. Use for anything that needs current outside information — news, docs, prices, or a specific URL.",
            instructions: RESEARCH_INSTRUCTIONS,
            tools: ["search_web", "fetch_url"],
        },
        {
            id: BUILTIN_AGENT_IDS.planner,
            name: "Planner",
            description:
                "Plans the user's week from tasks, the class schedule, and application follow-ups. Use for 'plan my day/week', workload questions, and creating follow-up tasks.",
            instructions: PLANNER_INSTRUCTIONS,
            tools: [
                "list_tasks",
                "create_task",
                "list_events",
                "list_applications",
                "search_notes",
            ],
        },
    ];
    const t = now();
    for (const s of seeds) {
        await getDb().execute(
            `INSERT OR IGNORE INTO agents
               (id, name, description, instructions, tools_json, model,
                max_steps, color, is_builtin, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, NULL, 6, NULL, 1, ?, ?)`,
            [s.id, s.name, s.description, s.instructions, JSON.stringify(s.tools), t, t],
        );
    }
}

export async function createAgent(input: AgentInput): Promise<AgentDef> {
    const id = newId("agt");
    const t = now();
    await getDb().execute(
        `INSERT INTO agents
           (id, name, description, instructions, tools_json, model,
            max_steps, color, is_builtin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
            id,
            input.name,
            input.description,
            input.instructions,
            JSON.stringify(input.tools),
            input.model ?? null,
            input.maxSteps ?? 6,
            input.color ?? null,
            t,
            t,
        ],
    );
    return getAgent(id);
}

export async function updateAgent(
    id: string,
    input: AgentInput,
): Promise<AgentDef> {
    const res = await getDb().execute(
        `UPDATE agents SET
           name = ?, description = ?, instructions = ?, tools_json = ?,
           model = ?, max_steps = ?, color = ?, updated_at = ?
         WHERE id = ?`,
        [
            input.name,
            input.description,
            input.instructions,
            JSON.stringify(input.tools),
            input.model ?? null,
            input.maxSteps ?? 6,
            input.color ?? null,
            now(),
            id,
        ],
    );
    if (res.rowsAffected === 0) throw new Error(`agent not found: ${id}`);
    return getAgent(id);
}

export async function getAgent(id: string): Promise<AgentDef> {
    const rows = await getDb().select("SELECT * FROM agents WHERE id = ?", [id]);
    if (!rows[0]) throw new Error(`agent not found: ${id}`);
    return agentDefSchema.parse(rows[0]);
}

export async function listAgents(): Promise<AgentDef[]> {
    const rows = await getDb().select(
        "SELECT * FROM agents ORDER BY is_builtin DESC, created_at ASC",
    );
    return rows.map((r) => agentDefSchema.parse(r));
}

export async function deleteAgent(id: string): Promise<void> {
    const agent = await getAgent(id);
    if (agent.is_builtin) throw new Error("built-in agents cannot be deleted");
    await getDb().execute("DELETE FROM agents WHERE id = ?", [id]);
}

export async function duplicateAgent(id: string): Promise<AgentDef> {
    const src = await getAgent(id);
    return createAgent({
        name: `${src.name} copy`,
        description: src.description,
        instructions: src.instructions,
        tools: JSON.parse(src.tools_json) as string[],
        model: src.model,
        maxSteps: src.max_steps,
        color: src.color,
    });
}
