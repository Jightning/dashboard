import { tool } from "ai";
import { z } from "zod";
import { createNote, getNote, listNotes, searchNotes } from "@/db/repo/notes";
import { normalizeFolder } from "@/db/repo/documents";
import type { ResolvedScope } from "@/ai/permissions/types";
import type { PermissionContext, ScopeResolver } from "./context";

const searchInput = z.object({
    query: z.string().describe("Full-text search query over the user's notes"),
    folder: z
        .string()
        .optional()
        .describe(
            "Restrict the search to a folder like /school. Omit to search everywhere.",
        ),
});

const readInput = z.object({
    id: z.string().describe("Note id from a previous search or list call"),
});

const listInput = z.object({
    folder: z
        .string()
        .optional()
        .describe("Folder to list, e.g. /school. Omit for all."),
});

const writeInput = z.object({
    title: z.string().describe("Title for the new note"),
    folder: z
        .string()
        .optional()
        .describe("Folder to file the note under, e.g. /automations. Defaults to /."),
    body_md: z.string().describe("Markdown body of the note"),
});

/**
 * Note folders are permission scopes. They reuse the `doc_folder` scope type
 * (a generic folder path) — grants stay distinct because they also key on the
 * tool name (`read_note` vs `read_document`).
 */
export const noteScopeResolvers: Record<string, ScopeResolver> = {
    search_notes: (input) =>
        folderScope((input as z.infer<typeof searchInput>).folder),
    list_notes: (input) =>
        folderScope((input as z.infer<typeof listInput>).folder),
    read_note: async (input) => {
        const note = await getNote((input as z.infer<typeof readInput>).id);
        return {
            access: "read",
            scopeType: "doc_folder",
            scopeValue: note.folder,
        };
    },
    write_note: (input) => ({
        access: "write",
        scopeType: "doc_folder",
        scopeValue: normalizeFolder(
            (input as z.infer<typeof writeInput>).folder ?? "/",
        ),
    }),
};

function folderScope(folder: string | undefined): ResolvedScope {
    return {
        access: "read",
        scopeType: "doc_folder",
        scopeValue: normalizeFolder(folder ?? "/"),
    };
}

export function createNoteTools(permissions: PermissionContext) {
    return {
        search_notes: tool({
            description:
                "Full-text search over the user's markdown notes. Returns ids, titles, and matching snippets.",
            inputSchema: searchInput,
            execute: permissions.gated(
                "search_notes",
                noteScopeResolvers.search_notes!,
                async ({ query, folder }: z.infer<typeof searchInput>) => {
                    const hits = await searchNotes(query, { folder });
                    return hits.length > 0 ? hits : "No notes matched.";
                },
            ),
        }),
        read_note: tool({
            description: "Read the full markdown body of one note by id.",
            inputSchema: readInput,
            execute: permissions.gated(
                "read_note",
                noteScopeResolvers.read_note!,
                async ({ id }: z.infer<typeof readInput>) => {
                    const note = await getNote(id);
                    return {
                        title: note.title,
                        folder: note.folder,
                        content: note.body_md,
                    };
                },
            ),
        }),
        list_notes: tool({
            description:
                "List the user's notes (titles and folders, no body content).",
            inputSchema: listInput,
            execute: permissions.gated(
                "list_notes",
                noteScopeResolvers.list_notes!,
                async ({ folder }: z.infer<typeof listInput>) => {
                    const notes = await listNotes(folder ? { folder } : undefined);
                    return notes.map((n) => ({
                        id: n.id,
                        title: n.title,
                        folder: n.folder,
                    }));
                },
            ),
        }),
        write_note: tool({
            description:
                "Create a new markdown note in the user's notes. Use to save summaries, drafts, or results the user should keep.",
            inputSchema: writeInput,
            execute: permissions.gated(
                "write_note",
                noteScopeResolvers.write_note!,
                async (input: z.infer<typeof writeInput>) => {
                    const note = await createNote({
                        title: input.title,
                        folder: input.folder,
                        bodyMd: input.body_md,
                    });
                    return { id: note.id, title: note.title, folder: note.folder };
                },
            ),
        }),
    };
}
