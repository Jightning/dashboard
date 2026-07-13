import { listGrants } from "@/db/repo/permissions";
import { toScopedGrant } from "@/ai/permissions/engine";
import { PermissionContext } from "@/ai/tools/context";
import { buildPipelineRuntime } from "@/ai/agents/runtime";
import { runPipeline } from "@/ai/pipelines/runner";
import { renderTemplate } from "@/lib/template";
import { createNote } from "@/db/repo/notes";
import type { Settings } from "@/ai/providers/keys";
import type { Automation } from "@/lib/schemas";

/**
 * Permissions for unattended runs: the chosen level's grants apply, and
 * anything outside them is denied immediately — nobody is watching to
 * approve, and a paused broker would hang the scheduler forever.
 */
export async function createAutoDenyPermissions(
    levelId: string | null,
): Promise<PermissionContext> {
    const permissions = new PermissionContext();
    if (levelId) {
        const grants = await listGrants(levelId);
        permissions.levelGrants = grants.map(toScopedGrant);
    }
    permissions.broker.subscribe((pending) => {
        for (const req of pending) permissions.broker.respond(req.id, "deny");
    });
    return permissions;
}

/** One unattended automation run; optionally files the result as a note. */
export async function runAutomation(
    a: Automation,
    deps: { settings: Settings; fetch: typeof globalThis.fetch },
): Promise<void> {
    const permissions = await createAutoDenyPermissions(a.permission_level_id);
    const runtime = buildPipelineRuntime({
        settings: deps.settings,
        fetch: deps.fetch,
        permissions,
    });
    const input = renderTemplate(a.input_template, {
        date: new Date().toISOString().slice(0, 10),
    });
    const result = await runPipeline({
        pipelineId: a.pipeline_id,
        input,
        runtime,
        automationId: a.id,
    });
    if (a.output_note_folder && result.status === "success") {
        await createNote({
            title: `${a.name} — ${new Date().toLocaleString()}`,
            folder: a.output_note_folder,
            bodyMd: result.finalOutput,
        });
    }
}
