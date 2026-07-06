import { tool } from "ai";
import { z } from "zod";
import {
    getDocument,
    listDocuments,
    normalizeFolder,
    searchDocuments,
} from "@/db/repo/documents";
import type { ResolvedScope } from "@/ai/permissions/types";
import type { PermissionContext, ScopeResolver } from "./context";

const searchInput = z.object({
    query: z
        .string()
        .describe("Full-text search query over the user's documents"),
    folder: z
        .string()
        .optional()
        .describe(
            "Restrict the search to a folder like /school. Omit to search everywhere.",
        ),
});

const readInput = z.object({
    id: z.string().describe("Document id from a previous search or list call"),
});

const listInput = z.object({
    folder: z
        .string()
        .optional()
        .describe("Folder to list, e.g. /school. Omit for all."),
});

export const documentScopeResolvers: Record<string, ScopeResolver> = {
    search_documents: (input) =>
        folderScope((input as z.infer<typeof searchInput>).folder),
    list_documents: (input) =>
        folderScope((input as z.infer<typeof listInput>).folder),
    read_document: async (input) => {
        const doc = await getDocument((input as z.infer<typeof readInput>).id);
        return {
            access: "read",
            scopeType: "doc_folder",
            scopeValue: doc.folder,
        };
    },
};

function folderScope(folder: string | undefined): ResolvedScope {
    return {
        access: "read",
        scopeType: "doc_folder",
        scopeValue: normalizeFolder(folder ?? "/"),
    };
}

export function createDocumentTools(permissions: PermissionContext) {
    return {
        search_documents: tool({
            description:
                "Full-text search over the user's stored documents (PDFs, notes). Returns ids, titles, and matching snippets.",
            inputSchema: searchInput,
            execute: permissions.gated(
                "search_documents",
                documentScopeResolvers.search_documents!,
                async ({ query, folder }: z.infer<typeof searchInput>) => {
                    const hits = await searchDocuments(query, { folder });
                    return hits.length > 0 ? hits : "No documents matched.";
                },
            ),
        }),
        read_document: tool({
            description: "Read the full text of one stored document by id.",
            inputSchema: readInput,
            execute: permissions.gated(
                "read_document",
                documentScopeResolvers.read_document!,
                async ({ id }: z.infer<typeof readInput>) => {
                    const doc = await getDocument(id);
                    return {
                        title: doc.title,
                        folder: doc.folder,
                        content: doc.content_text,
                    };
                },
            ),
        }),
        list_documents: tool({
            description:
                "List the user's stored documents (titles and folders, no content).",
            inputSchema: listInput,
            execute: permissions.gated(
                "list_documents",
                documentScopeResolvers.list_documents!,
                async ({ folder }: z.infer<typeof listInput>) => {
                    const docs = await listDocuments(folder);
                    return docs.map((d) => ({
                        id: d.id,
                        title: d.title,
                        folder: d.folder,
                    }));
                },
            ),
        }),
    };
}
