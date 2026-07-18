import { listPipelineSteps } from "@/db/repo/pipelines";
import { getAgent } from "@/db/repo/agents";
import { listGrants } from "@/db/repo/permissions";
import { TOOL_CATALOG } from "@/ai/tools/catalog";
import { toScopedGrant } from "@/ai/permissions/engine";
import { agentToolNames } from "@/lib/schemas";

/**
 * Tools the pipeline's agents can call that the chosen level does not grant.
 * Unattended runs auto-deny those — surface them before the user saves or runs.
 */
export async function ungrantedTools(
    pipelineId: string,
    levelId: string | null,
): Promise<string[]> {
    const steps = await listPipelineSteps(pipelineId);
    const used = new Set<string>();
    for (const step of steps) {
        try {
            for (const t of agentToolNames(await getAgent(step.agent_id))) used.add(t);
        } catch {
            // deleted agent or bad tools_json — the run itself will surface that
        }
    }
    const grants = levelId ? (await listGrants(levelId)).map(toScopedGrant) : [];
    const accessOf = new Map(TOOL_CATALOG.map((t) => [t.name, t.access]));
    return [...used].filter((name) => {
        const access = accessOf.get(name);
        if (!access) return true;
        return !grants.some((g) => g.tool === name && g.access === access);
    });
}
