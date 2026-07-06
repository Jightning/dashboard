import type { PermissionAccess, ScopeType } from "@/lib/schemas";

/**
 * What a tool call actually touches, resolved from its arguments by the tool's
 * own `scopeOf` function (e.g. read_document resolves the document's folder;
 * fetch_url resolves the hostname).
 */
export interface ResolvedScope {
    access: PermissionAccess;
    scopeType: Exclude<ScopeType, "any">;
    scopeValue: string;
}

/** A grant, either persisted on a permission level or ephemeral for a session. */
export interface ScopedGrant {
    tool: string;
    access: PermissionAccess;
    scopeType: ScopeType;
    scopeValue: string | null;
}

export type Decision = "allow" | "ask";
