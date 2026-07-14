import { tool } from "ai";
import { z } from "zod";
import {
    createApplication,
    listApplications,
    setApplicationStatus,
} from "@/db/repo/applications";
import { applicationStatusSchema } from "@/lib/schemas";
import type { ResolvedScope } from "@/ai/permissions/types";
import type { PermissionContext, ScopeResolver } from "./context";

const listInput = z.object({
    status: applicationStatusSchema
        .optional()
        .describe("Filter by pipeline stage. Omit for all."),
});

const createInput = z.object({
    company: z.string(),
    role: z.string(),
    url: z.string().optional().describe("Job posting URL"),
    notes: z.string().optional(),
});

const statusInput = z.object({
    id: z.string().describe("Application id from list_applications"),
    status: applicationStatusSchema,
    note: z.string().optional().describe("What happened (kept in history)"),
});

/**
 * Application tools have no natural sub-scope (no folder, no domain) — same
 * situation as tasks/events (see tasks.ts). `ResolvedScope` excludes "any" by
 * design, so we resolve to the folder root: `folderContains("/", _)` is
 * always true, so a "doc_folder: /" grant behaves like "any", and only
 * grants literally named for this tool can ever match, per `grantMatches`'s
 * `grant.tool !== tool` check.
 */
const anyScope = (access: "read" | "write"): ResolvedScope => ({
    access,
    scopeType: "doc_folder",
    scopeValue: "/",
});

export const applicationScopeResolvers: Record<string, ScopeResolver> = {
    list_applications: () => anyScope("read"),
    create_application: () => anyScope("write"),
    update_application_status: () => anyScope("write"),
};

export function createApplicationTools(permissions: PermissionContext) {
    return {
        list_applications: tool({
            description:
                "List the user's internship/job applications with statuses, follow-ups, and ids.",
            inputSchema: listInput,
            execute: permissions.gated(
                "list_applications",
                applicationScopeResolvers.list_applications!,
                async (input: z.infer<typeof listInput>) =>
                    listApplications(input.status),
            ),
        }),
        create_application: tool({
            description:
                "Track a new internship/job application the user is interested in or has applied to.",
            inputSchema: createInput,
            execute: permissions.gated(
                "create_application",
                applicationScopeResolvers.create_application!,
                async (input: z.infer<typeof createInput>) =>
                    createApplication({
                        company: input.company,
                        role: input.role,
                        url: input.url ?? null,
                        notes: input.notes ?? null,
                    }),
            ),
        }),
        update_application_status: tool({
            description:
                "Move an application to a new pipeline stage (applied, oa, interview, offer, rejected, ghosted).",
            inputSchema: statusInput,
            execute: permissions.gated(
                "update_application_status",
                applicationScopeResolvers.update_application_status!,
                async (input: z.infer<typeof statusInput>) =>
                    setApplicationStatus(input.id, input.status, input.note),
            ),
        }),
    };
}
