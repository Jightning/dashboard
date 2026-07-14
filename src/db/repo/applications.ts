import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import {
    applicationEventSchema,
    applicationSchema,
    type Application,
    type ApplicationEvent,
    type ApplicationStatus,
} from "@/lib/schemas";

export async function createApplication(input: {
    company: string;
    role: string;
    url?: string | null;
    notes?: string | null;
}): Promise<Application> {
    const id = newId("app");
    const t = now();
    await getDb().execute(
        `INSERT INTO applications
           (id, company, role, url, status, applied_at, next_action,
            next_action_at, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'interested', NULL, NULL, NULL, ?, ?, ?)`,
        [id, input.company, input.role, input.url ?? null, input.notes ?? null, t, t],
    );
    return getApplication(id);
}

export async function updateApplication(
    id: string,
    input: {
        company: string;
        role: string;
        url?: string | null;
        notes?: string | null;
        nextAction?: string | null;
        nextActionAt?: number | null;
    },
): Promise<Application> {
    const res = await getDb().execute(
        `UPDATE applications SET company = ?, role = ?, url = ?, notes = ?,
            next_action = ?, next_action_at = ?, updated_at = ?
         WHERE id = ?`,
        [
            input.company,
            input.role,
            input.url ?? null,
            input.notes ?? null,
            input.nextAction ?? null,
            input.nextActionAt ?? null,
            now(),
            id,
        ],
    );
    if (res.rowsAffected === 0) throw new Error(`application not found: ${id}`);
    return getApplication(id);
}

/** Status change + history row; first move to 'applied' stamps applied_at. */
export async function setApplicationStatus(
    id: string,
    status: ApplicationStatus,
    note?: string,
): Promise<Application> {
    const current = await getApplication(id);
    const appliedAt =
        status === "applied" && current.applied_at === null
            ? now()
            : current.applied_at;
    await getDb().execute(
        "UPDATE applications SET status = ?, applied_at = ?, updated_at = ? WHERE id = ?",
        [status, appliedAt, now(), id],
    );
    await getDb().execute(
        `INSERT INTO application_events (id, application_id, status, note, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [newId("ape"), id, status, note ?? null, now()],
    );
    return getApplication(id);
}

export async function deleteApplication(id: string): Promise<void> {
    await getDb().execute("DELETE FROM applications WHERE id = ?", [id]);
}

export async function getApplication(id: string): Promise<Application> {
    const rows = await getDb().select(
        "SELECT * FROM applications WHERE id = ?",
        [id],
    );
    if (!rows[0]) throw new Error(`application not found: ${id}`);
    return applicationSchema.parse(rows[0]);
}

export async function listApplications(
    status?: ApplicationStatus,
): Promise<Application[]> {
    const rows = status
        ? await getDb().select(
              "SELECT * FROM applications WHERE status = ? ORDER BY updated_at DESC",
              [status],
          )
        : await getDb().select(
              "SELECT * FROM applications ORDER BY updated_at DESC",
          );
    return rows.map((r) => applicationSchema.parse(r));
}

export async function listApplicationEvents(
    applicationId: string,
): Promise<ApplicationEvent[]> {
    const rows = await getDb().select(
        `SELECT * FROM application_events WHERE application_id = ?
         ORDER BY created_at DESC, rowid DESC`,
        [applicationId],
    );
    return rows.map((r) => applicationEventSchema.parse(r));
}

/** Follow-ups due before `before`, excluding closed applications. */
export async function listFollowUpsDue(before: number): Promise<Application[]> {
    const rows = await getDb().select(
        `SELECT * FROM applications
         WHERE next_action_at IS NOT NULL AND next_action_at <= ?
           AND status NOT IN ('offer', 'rejected')
         ORDER BY next_action_at ASC`,
        [before],
    );
    return rows.map((r) => applicationSchema.parse(r));
}
