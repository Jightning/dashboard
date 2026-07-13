import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import {
    pipelineRunSchema,
    pipelineSchema,
    pipelineStepRunSchema,
    pipelineStepSchema,
    type Pipeline,
    type PipelineRun,
    type PipelineStep,
    type PipelineStepRun,
    type RunStatus,
} from "@/lib/schemas";

export async function createPipeline(input: {
    name: string;
    description?: string | null;
}): Promise<Pipeline> {
    const id = newId("pip");
    const t = now();
    await getDb().execute(
        `INSERT INTO pipelines (id, name, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, input.name, input.description ?? null, t, t],
    );
    return getPipeline(id);
}

export async function updatePipeline(
    id: string,
    input: { name: string; description?: string | null },
): Promise<Pipeline> {
    const res = await getDb().execute(
        "UPDATE pipelines SET name = ?, description = ?, updated_at = ? WHERE id = ?",
        [input.name, input.description ?? null, now(), id],
    );
    if (res.rowsAffected === 0) throw new Error(`pipeline not found: ${id}`);
    return getPipeline(id);
}

export async function getPipeline(id: string): Promise<Pipeline> {
    const rows = await getDb().select(
        "SELECT * FROM pipelines WHERE id = ?",
        [id],
    );
    if (!rows[0]) throw new Error(`pipeline not found: ${id}`);
    return pipelineSchema.parse(rows[0]);
}

export async function listPipelines(): Promise<Pipeline[]> {
    const rows = await getDb().select(
        "SELECT * FROM pipelines ORDER BY created_at ASC",
    );
    return rows.map((r) => pipelineSchema.parse(r));
}

export async function deletePipeline(id: string): Promise<void> {
    await getDb().execute("DELETE FROM pipelines WHERE id = ?", [id]);
}

/**
 * Replace all steps (delete + insert, positions 1..N). Two statements, no
 * transaction: single local writer; a failure surfaces immediately in the UI.
 */
export async function setPipelineSteps(
    pipelineId: string,
    steps: { agentId: string; promptTemplate: string }[],
): Promise<void> {
    await getDb().execute(
        "DELETE FROM pipeline_steps WHERE pipeline_id = ?",
        [pipelineId],
    );
    for (const [i, step] of steps.entries()) {
        await getDb().execute(
            `INSERT INTO pipeline_steps (id, pipeline_id, position, agent_id, prompt_template)
             VALUES (?, ?, ?, ?, ?)`,
            [newId("pst"), pipelineId, i + 1, step.agentId, step.promptTemplate],
        );
    }
    await getDb().execute(
        "UPDATE pipelines SET updated_at = ? WHERE id = ?",
        [now(), pipelineId],
    );
}

export async function listPipelineSteps(
    pipelineId: string,
): Promise<PipelineStep[]> {
    const rows = await getDb().select(
        "SELECT * FROM pipeline_steps WHERE pipeline_id = ? ORDER BY position ASC",
        [pipelineId],
    );
    return rows.map((r) => pipelineStepSchema.parse(r));
}

export async function createRun(input: {
    pipelineId: string;
    automationId?: string | null;
    input: string;
}): Promise<PipelineRun> {
    const id = newId("run");
    await getDb().execute(
        `INSERT INTO pipeline_runs (id, pipeline_id, automation_id, status, input, started_at)
         VALUES (?, ?, ?, 'running', ?, ?)`,
        [id, input.pipelineId, input.automationId ?? null, input.input, now()],
    );
    return getRun(id);
}

export async function getRun(id: string): Promise<PipelineRun> {
    const rows = await getDb().select(
        "SELECT * FROM pipeline_runs WHERE id = ?",
        [id],
    );
    if (!rows[0]) throw new Error(`pipeline run not found: ${id}`);
    return pipelineRunSchema.parse(rows[0]);
}

export async function finishRun(
    id: string,
    result: { status: Exclude<RunStatus, "running">; error?: string | null },
): Promise<void> {
    await getDb().execute(
        "UPDATE pipeline_runs SET status = ?, error = ?, finished_at = ? WHERE id = ?",
        [result.status, result.error ?? null, now(), id],
    );
}

export async function listRuns(
    opts: { pipelineId?: string; automationId?: string; limit?: number } = {},
): Promise<PipelineRun[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (opts.pipelineId) {
        where.push("pipeline_id = ?");
        params.push(opts.pipelineId);
    }
    if (opts.automationId) {
        where.push("automation_id = ?");
        params.push(opts.automationId);
    }
    params.push(opts.limit ?? 20);
    const rows = await getDb().select(
        `SELECT * FROM pipeline_runs
         ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY started_at DESC LIMIT ?`,
        params,
    );
    return rows.map((r) => pipelineRunSchema.parse(r));
}

export async function createStepRun(input: {
    runId: string;
    position: number;
    agentId: string;
    prompt: string;
}): Promise<PipelineStepRun> {
    const id = newId("srn");
    await getDb().execute(
        `INSERT INTO pipeline_step_runs (id, run_id, position, agent_id, prompt, status, started_at)
         VALUES (?, ?, ?, ?, ?, 'running', ?)`,
        [id, input.runId, input.position, input.agentId, input.prompt, now()],
    );
    const rows = await getDb().select(
        "SELECT * FROM pipeline_step_runs WHERE id = ?",
        [id],
    );
    return pipelineStepRunSchema.parse(rows[0]);
}

export async function finishStepRun(
    id: string,
    result: {
        status: Exclude<RunStatus, "running">;
        output?: string | null;
        error?: string | null;
    },
): Promise<void> {
    await getDb().execute(
        `UPDATE pipeline_step_runs SET status = ?, output = ?, error = ?, finished_at = ?
         WHERE id = ?`,
        [result.status, result.output ?? null, result.error ?? null, now(), id],
    );
}

export async function listStepRuns(runId: string): Promise<PipelineStepRun[]> {
    const rows = await getDb().select(
        "SELECT * FROM pipeline_step_runs WHERE run_id = ? ORDER BY position ASC",
        [runId],
    );
    return rows.map((r) => pipelineStepRunSchema.parse(r));
}
