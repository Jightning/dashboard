export type Recurrence = "daily" | "weekly" | "monthly";

/** Next occurrence after completing a recurring task. Local-time arithmetic. */
export function nextDueDate(dueAt: number, recurrence: Recurrence): number {
    const d = new Date(dueAt);
    switch (recurrence) {
        case "daily":
            d.setDate(d.getDate() + 1);
            break;
        case "weekly":
            d.setDate(d.getDate() + 7);
            break;
        case "monthly":
            d.setMonth(d.getMonth() + 1);
            break;
    }
    return d.getTime();
}
