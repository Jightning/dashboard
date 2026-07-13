import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { createTask, listOpenTasks } from "@/db/repo/tasks";
import { insertEvent } from "@/db/repo/events";
import { PermissionContext } from "./context";
import { createTaskTools } from "./tasks";

let db: ReturnType<typeof createTestDbClient>;
beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});
afterEach(() => db.close());

const opts = { toolCallId: "t", messages: [], context: {} };

function allowAll(): PermissionContext {
    const p = new PermissionContext();
    p.levelGrants = [
        { tool: "list_tasks", access: "read", scopeType: "any", scopeValue: null },
        { tool: "create_task", access: "write", scopeType: "any", scopeValue: null },
        { tool: "complete_task", access: "write", scopeType: "any", scopeValue: null },
        { tool: "list_events", access: "read", scopeType: "any", scopeValue: null },
    ];
    return p;
}

describe("task tools", () => {
    it("creates a task with a parsed due date", async () => {
        const tools = createTaskTools(allowAll());
        const result = (await tools.create_task.execute!(
            { title: "437 lab report", due: "2026-09-04T23:59" },
            opts,
        )) as { id: string; due_at: number };
        expect(result.id).toMatch(/^tsk_/);
        expect(new Date(result.due_at).getFullYear()).toBe(2026);
        expect(await listOpenTasks()).toHaveLength(1);
    });

    it("rejects unparseable due dates", async () => {
        const tools = createTaskTools(allowAll());
        await expect(
            tools.create_task.execute!(
                { title: "x", due: "next Tuesdayish" },
                opts,
            ),
        ).rejects.toThrow(/due date/);
    });

    it("lists open tasks and completes one", async () => {
        const t = await createTask({ title: "OA prep", dueAt: Date.now() });
        const tools = createTaskTools(allowAll());
        const listed = (await tools.list_tasks.execute!({}, opts)) as Array<{
            id: string;
        }>;
        expect(listed).toHaveLength(1);
        await tools.complete_task.execute!({ id: t.id }, opts);
        expect(await listOpenTasks()).toHaveLength(0);
    });

    it("write tools deny without a grant", async () => {
        const p = new PermissionContext();
        p.broker.subscribe((pending) => {
            for (const req of pending) p.broker.respond(req.id, "deny");
        });
        const tools = createTaskTools(p);
        const result = (await tools.create_task.execute!(
            { title: "nope" },
            opts,
        )) as { denied?: boolean };
        expect(result.denied).toBe(true);
    });

    it("lists events in a day window", async () => {
        await insertEvent({
            title: "Lecture",
            startsAt: Date.now() + 3_600_000,
            endsAt: Date.now() + 7_200_000,
        });
        const tools = createTaskTools(allowAll());
        const events = (await tools.list_events.execute!(
            { withinDays: 1 },
            opts,
        )) as Array<{ title: string }>;
        expect(events[0]!.title).toBe("Lecture");
    });
});
