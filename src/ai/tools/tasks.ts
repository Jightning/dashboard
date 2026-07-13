import { tool } from "ai";
import { z } from "zod";
import {
    completeTask,
    createTask,
    listOpenTasks,
} from "@/db/repo/tasks";
import { listEventsBetween } from "@/db/repo/events";
import type { ResolvedScope } from "@/ai/permissions/types";
import type { PermissionContext, ScopeResolver } from "./context";
import { recurrenceSchema } from "@/lib/schemas";

const listTasksInput = z.object({
    dueWithinDays: z
        .number()
        .optional()
        .describe("Only tasks due within N days. Omit for all open tasks."),
});

const createTaskInput = z.object({
    title: z.string().describe("Short imperative title"),
    notes: z.string().optional(),
    due: z
        .string()
        .optional()
        .describe("Due date/time, ISO format like 2026-09-04T23:59"),
    recurrence: recurrenceSchema
        .optional()
        .describe("Repeat after completion; requires a due date"),
});

const completeTaskInput = z.object({
    id: z.string().describe("Task id from list_tasks"),
});

const listEventsInput = z.object({
    withinDays: z
        .number()
        .optional()
        .describe("Events starting within N days from now (default 7)"),
});

/**
 * Task/event tools have no natural sub-scope (no folder, no domain) — unlike
 * documents/notes/web. `ResolvedScope` (what a call actually touches) excludes
 * "any" by design, so we resolve to the folder root: `folderContains("/", _)`
 * is always true, so a "doc_folder: /" grant behaves like "any", and only
 * grants literally named for this tool (list_tasks, create_task, ...) can
 * ever match, per `grantMatches`'s `grant.tool !== tool` check.
 */
const anyScope = (access: "read" | "write"): ResolvedScope => ({
    access,
    scopeType: "doc_folder",
    scopeValue: "/",
});

export const taskScopeResolvers: Record<string, ScopeResolver> = {
    list_tasks: () => anyScope("read"),
    create_task: () => anyScope("write"),
    complete_task: () => anyScope("write"),
    list_events: () => anyScope("read"),
};

function parseDue(due: string | undefined): number | null {
    if (due === undefined) return null;
    const t = new Date(due).getTime();
    if (Number.isNaN(t))
        throw new Error(`unparseable due date: "${due}" — use ISO like 2026-09-04T23:59`);
    return t;
}

export function createTaskTools(permissions: PermissionContext) {
    return {
        list_tasks: tool({
            description:
                "List the user's open tasks (title, due date, course, id), soonest due first.",
            inputSchema: listTasksInput,
            execute: permissions.gated(
                "list_tasks",
                taskScopeResolvers.list_tasks!,
                async (input: z.infer<typeof listTasksInput>) =>
                    listOpenTasks(
                        input.dueWithinDays !== undefined
                            ? {
                                  dueBefore:
                                      Date.now() +
                                      input.dueWithinDays * 86_400_000,
                              }
                            : {},
                    ),
            ),
        }),
        create_task: tool({
            description:
                "Create a task for the user (assignment, follow-up, errand). Include a due date whenever one is known.",
            inputSchema: createTaskInput,
            execute: permissions.gated(
                "create_task",
                taskScopeResolvers.create_task!,
                async (input: z.infer<typeof createTaskInput>) =>
                    createTask({
                        title: input.title,
                        notes: input.notes ?? null,
                        dueAt: parseDue(input.due),
                        recurrence: input.recurrence ?? null,
                    }),
            ),
        }),
        complete_task: tool({
            description: "Mark a task complete by id.",
            inputSchema: completeTaskInput,
            execute: permissions.gated(
                "complete_task",
                taskScopeResolvers.complete_task!,
                async (input: z.infer<typeof completeTaskInput>) => {
                    const next = await completeTask(input.id);
                    return {
                        completed: input.id,
                        nextOccurrence: next?.id ?? null,
                    };
                },
            ),
        }),
        list_events: tool({
            description:
                "List upcoming calendar events (classes, career fairs) within a day window.",
            inputSchema: listEventsInput,
            execute: permissions.gated(
                "list_events",
                taskScopeResolvers.list_events!,
                async (input: z.infer<typeof listEventsInput>) => {
                    const from = Date.now();
                    const days = input.withinDays ?? 7;
                    return listEventsBetween(from, from + days * 86_400_000);
                },
            ),
        }),
    };
}
