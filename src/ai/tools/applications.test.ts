import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import {
    createApplication,
    getApplication,
    listApplications,
} from "@/db/repo/applications";
import { PermissionContext } from "./context";
import { createApplicationTools } from "./applications";

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
        { tool: "list_applications", access: "read", scopeType: "any", scopeValue: null },
        { tool: "create_application", access: "write", scopeType: "any", scopeValue: null },
        { tool: "update_application_status", access: "write", scopeType: "any", scopeValue: null },
    ];
    return p;
}

describe("application tools", () => {
    it("creates and lists applications", async () => {
        const tools = createApplicationTools(allowAll());
        await tools.create_application.execute!(
            { company: "Anthropic", role: "SWE Intern", url: "https://x.co/j" },
            opts,
        );
        const listed = (await tools.list_applications.execute!(
            {},
            opts,
        )) as Array<{ company: string; status: string }>;
        expect(listed[0]).toMatchObject({
            company: "Anthropic",
            status: "interested",
        });
        expect(await listApplications()).toHaveLength(1);
    });

    it("updates status by id", async () => {
        const app = await createApplication({ company: "A", role: "r" });
        const tools = createApplicationTools(allowAll());
        await tools.update_application_status.execute!(
            { id: app.id, status: "oa", note: "HackerRank, due Fri" },
            opts,
        );
        expect((await getApplication(app.id)).status).toBe("oa");
    });

    it("denies writes without a grant", async () => {
        const p = new PermissionContext();
        p.broker.subscribe((pending) => {
            for (const req of pending) p.broker.respond(req.id, "deny");
        });
        const tools = createApplicationTools(p);
        const result = (await tools.create_application.execute!(
            { company: "X", role: "r" },
            opts,
        )) as { denied?: boolean };
        expect(result.denied).toBe(true);
    });
});
