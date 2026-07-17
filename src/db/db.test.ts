import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "./testClient";
import { setDb } from "./client";
import * as sessions from "./repo/sessions";
import * as messages from "./repo/messages";
import * as documents from "./repo/documents";
import * as notes from "./repo/notes";
import * as permissions from "./repo/permissions";
import * as presets from "./repo/presets";

let db: ReturnType<typeof createTestDbClient>;

beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});

afterEach(() => {
    db.close();
});

describe("sessions + messages", () => {
    it("creates a session, stores messages, and aggregates usage", async () => {
        const session = await sessions.createSession({ title: "test" });
        await messages.insertMessage({
            sessionId: session.id,
            role: "user",
            partsJson: JSON.stringify([{ type: "text", text: "hi" }]),
        });
        await messages.insertMessage({
            sessionId: session.id,
            role: "assistant",
            partsJson: JSON.stringify([{ type: "text", text: "hello" }]),
            model: "test-model",
            usage: { inputTokens: 10, outputTokens: 20, cachedInputTokens: 5 },
        });

        const list = await messages.listMessages(session.id);
        expect(list).toHaveLength(2);
        expect(list[1]?.output_tokens).toBe(20);

        const totals = await messages.sessionUsageTotals(session.id);
        expect(totals).toEqual({
            inputTokens: 10,
            outputTokens: 20,
            cachedInputTokens: 5,
        });
    });

    it("marks messages compacted and excludes them from active context", async () => {
        const session = await sessions.createSession({});
        const first = await messages.insertMessage({
            sessionId: session.id,
            role: "user",
            partsJson: "[]",
        });
        await messages.insertMessage({
            sessionId: session.id,
            role: "assistant",
            partsJson: "[]",
        });

        await messages.markCompacted([first]);
        const active = await messages.listActiveMessages(session.id);
        expect(active).toHaveLength(1);
        expect(active[0]?.role).toBe("assistant");
    });

    it("cascades message deletion with the session", async () => {
        const session = await sessions.createSession({});
        await messages.insertMessage({
            sessionId: session.id,
            role: "user",
            partsJson: "[]",
        });
        await sessions.deleteSession(session.id);
        const rows = await db.select("SELECT * FROM chat_messages");
        expect(rows).toHaveLength(0);
    });
});

describe("documents + FTS5", () => {
    it("finds documents through the FTS index with snippets", async () => {
        await documents.insertDocument({
            title: "Thermodynamics notes",
            contentText:
                "The Carnot cycle defines the maximum efficiency of a heat engine.",
            mimeType: "text/plain",
            folder: "/school",
        });
        await documents.insertDocument({
            title: "Grocery list",
            contentText: "milk eggs bread",
            mimeType: "text/plain",
        });

        const hits = await documents.searchDocuments("carnot efficiency");
        expect(hits).toHaveLength(1);
        expect(hits[0]?.title).toBe("Thermodynamics notes");
        expect(hits[0]?.snippet).toContain("[Carnot]");
    });

    it("keeps the FTS index in sync on update and delete (triggers)", async () => {
        const doc = await documents.insertDocument({
            title: "Draft",
            contentText: "original phrase alpha",
            mimeType: "text/plain",
        });

        await db.execute("UPDATE documents SET content_text = ? WHERE id = ?", [
            "replacement phrase beta",
            doc.id,
        ]);
        expect(await documents.searchDocuments("alpha")).toHaveLength(0);
        expect(await documents.searchDocuments("beta")).toHaveLength(1);

        await documents.deleteDocument(doc.id);
        expect(await documents.searchDocuments("beta")).toHaveLength(0);
    });

    it("does not break on FTS5 syntax characters in queries", async () => {
        await documents.insertDocument({
            title: "t",
            contentText: "hello world",
            mimeType: "text/plain",
        });
        await expect(
            documents.searchDocuments('he"llo -world OR (x*)'),
        ).resolves.toBeDefined();
        expect(await documents.searchDocuments("   ")).toEqual([]);
    });

    it("supports prefix matching for partial words", async () => {
        await documents.insertDocument({
            title: "t",
            contentText: "microcontroller programming",
            mimeType: "text/plain",
        });
        expect(await documents.searchDocuments("microcont")).toHaveLength(1);
    });

    it("lists documents scoped to a folder without content", async () => {
        await documents.insertDocument({
            title: "a",
            contentText: "x",
            mimeType: "text/plain",
            folder: "/school/ece",
        });
        await documents.insertDocument({
            title: "b",
            contentText: "y",
            mimeType: "text/plain",
            folder: "/personal",
        });
        const inSchool = await documents.listDocuments("/school");
        expect(inSchool).toHaveLength(1);
        expect(inSchool[0]?.title).toBe("a");
    });
});

describe("notes + FTS5", () => {
    it("does CRUD and finds notes through the FTS index with snippets", async () => {
        const note = await notes.createNote({
            title: "Lecture 3",
            folder: "/school/ece",
            bodyMd: "# Op-amps\nThe golden rules of ideal operational amplifiers.",
        });
        await notes.createNote({ title: "Empty" });

        expect((await notes.getNote(note.id)).body_md).toContain("golden");

        const hits = await notes.searchNotes("operational amplifiers");
        expect(hits).toHaveLength(1);
        expect(hits[0]?.title).toBe("Lecture 3");
        expect(hits[0]?.snippet).toContain("[operational]");
    });

    it("keeps the FTS index in sync on update and delete (triggers)", async () => {
        const note = await notes.createNote({ bodyMd: "original alpha term" });

        await notes.updateNote(note.id, {
            title: "Renamed",
            folder: "/",
            bodyMd: "replacement beta term",
        });
        expect(await notes.searchNotes("alpha")).toHaveLength(0);
        expect(await notes.searchNotes("beta")).toHaveLength(1);

        await notes.deleteNote(note.id);
        expect(await notes.searchNotes("beta")).toHaveLength(0);
    });

    it("lists notes scoped to a folder without body content", async () => {
        await notes.createNote({ title: "a", folder: "/school/ece" });
        await notes.createNote({ title: "b", folder: "/personal" });
        const inSchool = await notes.listNotes({ folder: "/school" });
        expect(inSchool).toHaveLength(1);
        expect(inSchool[0]?.title).toBe("a");
        expect("body_md" in inSchool[0]!).toBe(false);
    });
});

describe("permission levels + grants", () => {
    it("seeds built-in levels idempotently", async () => {
        await permissions.seedBuiltinLevels();
        await permissions.seedBuiltinLevels();
        const levels = await permissions.listLevels();
        // seed test: only Read documents is a builtin row now; "Ask everything" is NULL
        expect(levels.map((l) => l.name)).toEqual(["Read documents"]);

        const grants = await permissions.listGrants(
            permissions.BUILTIN_LEVELS.readDocuments,
        );
        expect(grants).toHaveLength(3);
        expect(grants.every((g) => g.access === "read")).toBe(true);
    });

    it("creates custom levels with scoped grants and validates scope_value", async () => {
        const level = await permissions.createLevel(
            "Study",
            "read /school only",
        );
        await permissions.addGrant({
            levelId: level.id,
            tool: "read_document",
            access: "read",
            scopeType: "doc_folder",
            scopeValue: "/school",
        });
        await expect(
            permissions.addGrant({
                levelId: level.id,
                tool: "fetch_url",
                access: "read",
                scopeType: "url_domain",
            }),
        ).rejects.toThrow(/scope_value/);
    });

    it("refuses to delete built-in levels", async () => {
        await permissions.seedBuiltinLevels();
        await expect(
            permissions.deleteLevel(permissions.BUILTIN_LEVELS.readDocuments),
        ).rejects.toThrow(/built-in/);
    });
});

describe("presets", () => {
    it("seeds built-in presets and parses enabled agents", async () => {
        await permissions.seedBuiltinLevels();
        await presets.seedBuiltinPresets({
            provider: "google",
            model: "gemini-2.5-pro",
            routerModel: "gemini-2.5-flash",
        });
        const all = await presets.listPresets();
        expect(all.map((p) => p.name)).toEqual([
            "Quick Q&A",
            "Study",
            "Research",
        ]);

        const research = all.find((p) => p.name === "Research")!;
        const { presetAgents } = await import("@/lib/schemas");
        expect(presetAgents(research)).toEqual(["agt_knowledge", "agt_research"]);
    });

    it("does CRUD on custom presets and protects built-ins", async () => {
        await permissions.seedBuiltinLevels();
        await presets.seedBuiltinPresets({
            provider: "google",
            model: "m",
            routerModel: "r",
        });
        const custom = await presets.createPreset({
            name: "Mine",
            systemPrompt: "custom",
            provider: "ollama",
            model: "llama3.2",
            enabledAgents: ["knowledge"],
        });
        const updated = await presets.updatePreset(custom.id, {
            name: "Mine 2",
            systemPrompt: "custom",
            provider: "ollama",
            model: "llama3.2",
            enabledAgents: [],
        });
        expect(updated.name).toBe("Mine 2");
        await presets.deletePreset(custom.id);
        await expect(presets.deletePreset("pre_study")).rejects.toThrow(
            /built-in/,
        );
    });
});
