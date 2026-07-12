import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { insertDocument } from "@/db/repo/documents";
import { getNote } from "@/db/repo/notes";
import { PermissionContext, type DeniedResult } from "./context";
import { createDocumentTools } from "./documents";
import { createNoteTools } from "./notes";
import { createWebTools, htmlToText, urlScope, FETCH_TEXT_LIMIT } from "./web";
import type { ApprovalVerdict } from "@/ai/permissions/broker";

let db: ReturnType<typeof createTestDbClient>;
let permissions: PermissionContext;

beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
    permissions = new PermissionContext();
});

afterEach(() => {
    db.close();
});

const execOpts = { toolCallId: "t", messages: [], context: {} };

/** Auto-answers the next broker request and records what was asked. */
function autoRespond(verdict: ApprovalVerdict) {
    const asked: string[] = [];
    const unsubscribe = permissions.broker.subscribe((pending) => {
        for (const req of pending) {
            asked.push(`${req.tool}:${req.scope.scopeValue}`);
            permissions.broker.respond(req.id, verdict);
        }
    });
    return { asked, unsubscribe };
}

describe("execute-time permission gating", () => {
    it("runs in-scope calls without asking", async () => {
        permissions.levelGrants = [
            {
                tool: "search_documents",
                access: "read",
                scopeType: "doc_folder",
                scopeValue: "/school",
            },
        ];
        await insertDocument({
            title: "thermo",
            contentText: "carnot cycle",
            mimeType: "text/plain",
            folder: "/school",
        });
        const { asked, unsubscribe } = autoRespond("deny");
        const tools = createDocumentTools(permissions);

        const hits = await tools.search_documents.execute!(
            { query: "carnot", folder: "/school" },
            execOpts,
        );
        unsubscribe();
        expect(asked).toEqual([]); // never asked
        expect(Array.isArray(hits)).toBe(true);
    });

    it("asks for out-of-scope calls and returns a structured denial on deny", async () => {
        const { asked, unsubscribe } = autoRespond("deny");
        const tools = createDocumentTools(permissions);

        const result = (await tools.list_documents.execute!(
            {},
            execOpts,
        )) as DeniedResult;
        unsubscribe();
        expect(asked).toEqual(["list_documents:/"]);
        expect(result.denied).toBe(true);
        expect(result.reason).toContain("denied");
    });

    it("allow-once runs the call but asks again next time", async () => {
        const first = autoRespond("allow-once");
        const tools = createDocumentTools(permissions);
        await tools.list_documents.execute!({}, execOpts);
        first.unsubscribe();

        const second = autoRespond("allow-once");
        await tools.list_documents.execute!({}, execOpts);
        second.unsubscribe();
        expect(first.asked).toHaveLength(1);
        expect(second.asked).toHaveLength(1);
    });

    it("allow-session adds a scoped session grant covering later calls", async () => {
        const tools = createWebTools(
            permissions,
            async () => new Response("ok"),
        );
        const first = autoRespond("allow-session");
        await tools.fetch_url.execute!(
            { url: "https://arxiv.org/abs/1" },
            execOpts,
        );
        first.unsubscribe();
        expect(first.asked).toEqual(["fetch_url:arxiv.org"]);

        // Same domain: no new approval. Different domain: asks again.
        const second = autoRespond("deny");
        const ok = await tools.fetch_url.execute!(
            { url: "https://arxiv.org/abs/2" },
            execOpts,
        );
        expect(ok).toBe("ok");
        const denied = (await tools.fetch_url.execute!(
            { url: "https://evil.com/" },
            execOpts,
        )) as DeniedResult;
        second.unsubscribe();
        expect(second.asked).toEqual(["fetch_url:evil.com"]);
        expect(denied.denied).toBe(true);
    });

    it("resolves read_document scope from the document's stored folder", async () => {
        permissions.levelGrants = [
            {
                tool: "read_document",
                access: "read",
                scopeType: "doc_folder",
                scopeValue: "/school",
            },
        ];
        const inScope = await insertDocument({
            title: "lecture",
            contentText: "carnot cycle",
            mimeType: "text/plain",
            folder: "/school/thermo",
        });
        const outOfScope = await insertDocument({
            title: "journal",
            contentText: "private",
            mimeType: "text/plain",
            folder: "/personal",
        });
        const tools = createDocumentTools(permissions);

        const { asked, unsubscribe } = autoRespond("deny");
        const read = (await tools.read_document.execute!(
            { id: inScope.id },
            execOpts,
        )) as {
            content: string;
        };
        expect(read.content).toContain("carnot");
        const denied = (await tools.read_document.execute!(
            { id: outOfScope.id },
            execOpts,
        )) as DeniedResult;
        unsubscribe();
        expect(asked).toEqual(["read_document:/personal"]);
        expect(denied.denied).toBe(true);
    });
});

describe("fetch_url behavior", () => {
    it("rejects non-http protocols in scope resolution", () => {
        expect(() => urlScope("file:///etc/passwd")).toThrow(/http/);
    });

    it("converts HTML to text and truncates long pages", async () => {
        permissions.levelGrants = [
            {
                tool: "fetch_url",
                access: "read",
                scopeType: "any",
                scopeValue: null,
            },
        ];
        const html = `<html><head><style>.x{}</style><script>bad()</script></head>
      <body><h1>Title</h1><p>Hello &amp; welcome</p></body></html>`;
        const tools = createWebTools(
            permissions,
            async () =>
                new Response(html, {
                    headers: { "content-type": "text/html" },
                }),
        );
        const text = (await tools.fetch_url.execute!(
            { url: "https://example.com/" },
            execOpts,
        )) as string;
        expect(text).toContain("Title");
        expect(text).toContain("Hello & welcome");
        expect(text).not.toContain("bad()");

        const longTools = createWebTools(
            permissions,
            async () =>
                new Response("a".repeat(FETCH_TEXT_LIMIT + 100), {
                    headers: { "content-type": "text/plain" },
                }),
        );
        const long = (await longTools.fetch_url.execute!(
            { url: "https://example.com/" },
            execOpts,
        )) as string;
        expect(long).toContain("[truncated");
    });

    it("reports HTTP errors as tool output instead of throwing", async () => {
        permissions.levelGrants = [
            {
                tool: "fetch_url",
                access: "read",
                scopeType: "any",
                scopeValue: null,
            },
        ];
        const tools = createWebTools(
            permissions,
            async () =>
                new Response("nope", { status: 404, statusText: "Not Found" }),
        );
        const out = await tools.fetch_url.execute!(
            { url: "https://example.com/missing" },
            execOpts,
        );
        expect(out).toContain("HTTP 404");
    });

    it("htmlToText handles entities and block breaks", () => {
        expect(htmlToText("<p>a</p><p>b</p>")).toBe("a\nb");
        expect(htmlToText("x &lt;3 &quot;y&quot;")).toBe('x <3 "y"');
    });
});

describe("write_note tool", () => {
    it("creates a note when a write grant covers the folder", async () => {
        permissions.levelGrants = [
            {
                tool: "write_note",
                access: "write",
                scopeType: "doc_folder",
                scopeValue: "/automations",
            },
        ];
        const { asked, unsubscribe } = autoRespond("deny");
        const tools = createNoteTools(permissions);
        const result = (await tools.write_note.execute!(
            { title: "Digest", folder: "/automations", body_md: "# hi" },
            execOpts,
        )) as { id: string; title: string; folder: string };
        unsubscribe();
        expect(asked).toEqual([]); // never asked, in-scope grant covers it
        expect(result.title).toBe("Digest");
        const note = await getNote(result.id);
        expect(note.body_md).toBe("# hi");
        expect(note.folder).toBe("/automations");
    });

    it("asks (and honors deny) outside the granted folder", async () => {
        const { asked, unsubscribe } = autoRespond("deny");
        const tools = createNoteTools(permissions);
        const result = (await tools.write_note.execute!(
            { title: "X", folder: "/personal", body_md: "no" },
            execOpts,
        )) as DeniedResult;
        unsubscribe();
        expect(asked).toEqual(["write_note:/personal"]);
        expect(result.denied).toBe(true);
    });
});
