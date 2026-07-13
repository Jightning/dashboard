import { getAgent } from "@/db/repo/agents";
import {
    createRun,
    createStepRun,
    finishRun,
    finishStepRun,
    listPipelineSteps,
} from "@/db/repo/pipelines";
import { createAgentFromDef } from "@/ai/agents/factory";
import type { AgentRuntime } from "@/ai/agents/types";
import { renderTemplate } from "@/lib/template";
import { agentSlug } from "@/lib/schemas";

export interface PipelineRunResult {
    runId: string;
    status: "success" | "error";
    finalOutput: string;
}

/**
 * Executes a pipeline's steps sequentially. Each step renders its prompt
 * template ({{input}}, {{date}}, {{prev}}, {{stepN}}), runs its agent, and
 * persists a step-run row. The first failure ends the run as 'error' — later
 * steps depend on earlier output, so continuing would compound garbage.
 */
export async function runPipeline(opts: {
    pipelineId: string;
    input: string;
    runtime: AgentRuntime;
    automationId?: string;
    abortSignal?: AbortSignal;
    /** Fired after every persisted change so the UI can refresh run rows. */
    onProgress?: () => void;
}): Promise<PipelineRunResult> {
    const steps = await listPipelineSteps(opts.pipelineId);
    if (steps.length === 0)
        throw new Error(`pipeline has no steps: ${opts.pipelineId}`);

    const run = await createRun({
        pipelineId: opts.pipelineId,
        automationId: opts.automationId ?? null,
        input: opts.input,
    });
    opts.onProgress?.();

    const vars: Record<string, string> = {
        input: opts.input,
        date: new Date().toISOString().slice(0, 10),
        prev: opts.input,
    };
    let finalOutput = "";

    for (const step of steps) {
        let stepRunId: string | null = null;
        try {
            const def = await getAgent(step.agent_id);
            const prompt = renderTemplate(step.prompt_template, vars);
            const stepRun = await createStepRun({
                runId: run.id,
                position: step.position,
                agentId: def.id,
                prompt,
            });
            stepRunId = stepRun.id;
            opts.onProgress?.();

            const { agent, modelId } = createAgentFromDef(def, opts.runtime);
            const result = await agent.generate({
                prompt,
                abortSignal: opts.abortSignal,
            });
            opts.runtime.onUsage?.({
                agent: agentSlug(def.name),
                model: modelId,
                usage: result.totalUsage,
            });

            const output = result.text || "(the agent returned no text)";
            await finishStepRun(stepRun.id, { status: "success", output });
            vars[`step${step.position}`] = output;
            vars.prev = output;
            finalOutput = output;
            opts.onProgress?.();
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            if (stepRunId)
                await finishStepRun(stepRunId, {
                    status: "error",
                    error: message,
                });
            await finishRun(run.id, {
                status: "error",
                error: `step ${step.position}: ${message}`,
            });
            opts.onProgress?.();
            return { runId: run.id, status: "error", finalOutput };
        }
    }

    await finishRun(run.id, { status: "success" });
    opts.onProgress?.();
    return { runId: run.id, status: "success", finalOutput };
}
