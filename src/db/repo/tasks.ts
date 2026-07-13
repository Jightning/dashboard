import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { taskSchema, type Task } from "@/lib/schemas";
import { nextDueDate, type Recurrence } from "@/lib/recurrence";

export interface TaskInput {
    title: string;
    notes?: string | null;
    courseId?: string | null;
    dueAt?: number | null;
    recurrence?: Recurrence | null;
}

export async function createTask(input: TaskInput): Promise<Task> {
    if (input.recurrence && input.dueAt == null)
        throw new Error("a recurring task needs a due date to recur from");
    const id = newId("tsk");
    const t = now();
    await getDb().execute(
        `INSERT INTO tasks (id, title, notes, course_id, due_at, recurrence,
                            completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        [
            id,
            input.title,
            input.notes ?? null,
            input.courseId ?? null,
            input.dueAt ?? null,
            input.recurrence ?? null,
            t,
            t,
        ],
    );
    return getTask(id);
}

export async function updateTask(id: string, input: TaskInput): Promise<Task> {
    const res = await getDb().execute(
        `UPDATE tasks SET title = ?, notes = ?, course_id = ?, due_at = ?,
                          recurrence = ?, updated_at = ?
         WHERE id = ?`,
        [
            input.title,
            input.notes ?? null,
            input.courseId ?? null,
            input.dueAt ?? null,
            input.recurrence ?? null,
            now(),
            id,
        ],
    );
    if (res.rowsAffected === 0) throw new Error(`task not found: ${id}`);
    return getTask(id);
}

/** Close a task; recurring tasks spawn the next occurrence, returned here. */
export async function completeTask(id: string): Promise<Task | null> {
    const task = await getTask(id);
    await getDb().execute(
        "UPDATE tasks SET completed_at = ?, updated_at = ? WHERE id = ?",
        [now(), now(), id],
    );
    if (!task.recurrence || task.due_at == null) return null;
    return createTask({
        title: task.title,
        notes: task.notes,
        courseId: task.course_id,
        dueAt: nextDueDate(task.due_at, task.recurrence),
        recurrence: task.recurrence,
    });
}

export async function reopenTask(id: string): Promise<void> {
    await getDb().execute(
        "UPDATE tasks SET completed_at = NULL, updated_at = ? WHERE id = ?",
        [now(), id],
    );
}

export async function deleteTask(id: string): Promise<void> {
    await getDb().execute("DELETE FROM tasks WHERE id = ?", [id]);
}

export async function getTask(id: string): Promise<Task> {
    const rows = await getDb().select("SELECT * FROM tasks WHERE id = ?", [id]);
    if (!rows[0]) throw new Error(`task not found: ${id}`);
    return taskSchema.parse(rows[0]);
}

export async function listOpenTasks(
    opts: { dueBefore?: number } = {},
): Promise<Task[]> {
    const rows = opts.dueBefore
        ? await getDb().select(
              `SELECT * FROM tasks
               WHERE completed_at IS NULL AND due_at IS NOT NULL AND due_at <= ?
               ORDER BY due_at ASC`,
              [opts.dueBefore],
          )
        : await getDb().select(
              `SELECT * FROM tasks WHERE completed_at IS NULL
               ORDER BY due_at IS NULL, due_at ASC, created_at ASC`,
          );
    return rows.map((r) => taskSchema.parse(r));
}

export async function listCompletedTasks(limit = 30): Promise<Task[]> {
    const rows = await getDb().select(
        `SELECT * FROM tasks WHERE completed_at IS NOT NULL
         ORDER BY completed_at DESC LIMIT ?`,
        [limit],
    );
    return rows.map((r) => taskSchema.parse(r));
}
