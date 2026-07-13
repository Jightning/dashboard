import type { ToolSet } from "ai";
import { createDocumentTools } from "./documents";
import { createNoteTools } from "./notes";
import { createWebTools } from "./web";
import { createTaskTools } from "./tasks";
import type { PermissionContext } from "./context";

/**
 * Every gated tool an agent can be granted, with UI metadata. Adding a tool
 * module = spread its factory into buildToolSet and list its entries here.
 */
export interface ToolCatalogEntry {
    name: string;
    label: string;
    access: "read" | "write";
    group: "documents" | "notes" | "web" | "tasks";
}

export const TOOL_CATALOG: ToolCatalogEntry[] = [
    { name: "search_documents", label: "Search documents", access: "read", group: "documents" },
    { name: "read_document", label: "Read a document", access: "read", group: "documents" },
    { name: "list_documents", label: "List documents", access: "read", group: "documents" },
    { name: "search_notes", label: "Search notes", access: "read", group: "notes" },
    { name: "read_note", label: "Read a note", access: "read", group: "notes" },
    { name: "list_notes", label: "List notes", access: "read", group: "notes" },
    { name: "write_note", label: "Create a note", access: "write", group: "notes" },
    { name: "fetch_url", label: "Fetch a web page", access: "read", group: "web" },
    { name: "list_tasks", label: "List open tasks", access: "read", group: "tasks" },
    { name: "create_task", label: "Create a task", access: "write", group: "tasks" },
    { name: "complete_task", label: "Complete a task", access: "write", group: "tasks" },
    { name: "list_events", label: "List calendar events", access: "read", group: "tasks" },
];

/** Builds the ToolSet for an agent's granted tool names. Throws on unknowns. */
export function buildToolSet(
    names: string[],
    deps: {
        permissions: PermissionContext;
        fetch: typeof globalThis.fetch;
    },
): ToolSet {
    const all: ToolSet = {
        ...createDocumentTools(deps.permissions),
        ...createNoteTools(deps.permissions),
        ...createWebTools(deps.permissions, deps.fetch),
        ...createTaskTools(deps.permissions),
    };
    const set: ToolSet = {};
    for (const name of names) {
        const t = all[name];
        if (!t) throw new Error(`unknown tool in agent definition: ${name}`);
        set[name] = t;
    }
    return set;
}
