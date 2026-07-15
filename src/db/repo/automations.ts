import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { automationSchema, type Automation, type ScheduleKind } from "@/lib/schemas";
import { computeNextRun } from "@/ai/automations/schedule";

export interface AutomationInput {
    name: string;
    pipelineId: string;
    scheduleKind: ScheduleKind;
    intervalMinutes?: number | null;
    timeOfDay?: string | null;
    dayOfWeek?: number | null;
    inputTemplate: string;
    permissionLevelId?: string | null;
    outputNoteFolder?: string | null;
    projectId?: string | null;
}

export async function createAutomation(
    input: AutomationInput,
): Promise<Automation> {
    const id = newId("aut");
    const t = now();
    await getDb().execute(
        `INSERT INTO automations
           (id, name, pipeline_id, schedule_kind, interval_minutes, time_of_day,
            day_of_week, input_template, permission_level_id, output_note_folder,
            project_id, enabled, next_run_at, last_run_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, NULL, ?, ?)`,
        [
            id,
            input.name,
            input.pipelineId,
            input.scheduleKind,
            input.intervalMinutes ?? null,
            input.timeOfDay ?? null,
            input.dayOfWeek ?? null,
            input.inputTemplate,
            input.permissionLevelId ?? null,
            input.outputNoteFolder ?? null,
            input.projectId ?? null,
            t,
            t,
        ],
    );
    const created = await getAutomation(id);
    // Validates the schedule too — a bad HH:MM fails here, at save time.
    await getDb().execute(
        "UPDATE automations SET next_run_at = ? WHERE id = ?",
        [computeNextRun(created, t), id],
    );
    return getAutomation(id);
}

export async function updateAutomation(
    id: string,
    input: AutomationInput,
): Promise<Automation> {
    const res = await getDb().execute(
        `UPDATE automations SET
           name = ?, pipeline_id = ?, schedule_kind = ?, interval_minutes = ?,
           time_of_day = ?, day_of_week = ?, input_template = ?,
           permission_level_id = ?, output_note_folder = ?, project_id = ?, updated_at = ?
         WHERE id = ?`,
        [
            input.name,
            input.pipelineId,
            input.scheduleKind,
            input.intervalMinutes ?? null,
            input.timeOfDay ?? null,
            input.dayOfWeek ?? null,
            input.inputTemplate,
            input.permissionLevelId ?? null,
            input.outputNoteFolder ?? null,
            input.projectId ?? null,
            now(),
            id,
        ],
    );
    if (res.rowsAffected === 0) throw new Error(`automation not found: ${id}`);
    const updated = await getAutomation(id);
    await getDb().execute(
        "UPDATE automations SET next_run_at = ? WHERE id = ?",
        [computeNextRun(updated, now()), id],
    );
    return getAutomation(id);
}

export async function setAutomationEnabled(
    id: string,
    enabled: boolean,
): Promise<void> {
    const a = await getAutomation(id);
    await getDb().execute(
        "UPDATE automations SET enabled = ?, next_run_at = ?, updated_at = ? WHERE id = ?",
        [
            enabled ? 1 : 0,
            enabled ? computeNextRun(a, now()) : a.next_run_at,
            now(),
            id,
        ],
    );
}

export async function getAutomation(id: string): Promise<Automation> {
    const rows = await getDb().select(
        "SELECT * FROM automations WHERE id = ?",
        [id],
    );
    if (!rows[0]) throw new Error(`automation not found: ${id}`);
    return automationSchema.parse(rows[0]);
}

export async function listAutomations(filter?: {
    projectId?: string;
}): Promise<Automation[]> {
    const rows = filter?.projectId
        ? await getDb().select(
              "SELECT * FROM automations WHERE project_id = ? ORDER BY created_at ASC",
              [filter.projectId],
          )
        : await getDb().select(
              "SELECT * FROM automations ORDER BY created_at ASC",
          );
    return rows.map((r) => automationSchema.parse(r));
}

export async function deleteAutomation(id: string): Promise<void> {
    await getDb().execute("DELETE FROM automations WHERE id = ?", [id]);
}

export async function listDueAutomations(
    nowMs: number,
): Promise<Automation[]> {
    const rows = await getDb().select(
        `SELECT * FROM automations
         WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?
         ORDER BY next_run_at ASC`,
        [nowMs],
    );
    return rows.map((r) => automationSchema.parse(r));
}

/** Claim a due automation: advance its clock before the (slow) run starts. */
export async function markRun(
    id: string,
    times: { nextRunAt: number; lastRunAt: number },
): Promise<void> {
    await getDb().execute(
        "UPDATE automations SET next_run_at = ?, last_run_at = ?, updated_at = ? WHERE id = ?",
        [times.nextRunAt, times.lastRunAt, now(), id],
    );
}
