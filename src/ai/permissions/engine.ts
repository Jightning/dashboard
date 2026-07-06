import type { PermissionGrant } from "@/lib/schemas";
import type { Decision, ResolvedScope, ScopedGrant } from "./types";

/**
 * The permission engine. Pure TypeScript, no UI, no DB — callers load the active
 * level's grants and hold a SessionGrants instance per chat session.
 *
 * Decision order (docs/architecture.md → Permission model):
 *   1. grant in the active level matches      → allow
 *   2. ephemeral session grant matches        → allow
 *   3. otherwise                              → ask (approval card)
 */
export function evaluateToolCall(opts: {
    tool: string;
    scope: ResolvedScope;
    levelGrants: ScopedGrant[];
    sessionGrants: SessionGrants;
}): Decision {
    const { tool, scope, levelGrants, sessionGrants } = opts;
    if (levelGrants.some((g) => grantMatches(g, tool, scope))) return "allow";
    if (sessionGrants.matches(tool, scope)) return "allow";
    return "ask";
}

export function grantMatches(
    grant: ScopedGrant,
    tool: string,
    scope: ResolvedScope,
): boolean {
    if (grant.tool !== tool) return false;
    // Write access is never implied: the grant's access must match exactly.
    if (grant.access !== scope.access) return false;
    if (grant.scopeType === "any") return true;
    if (grant.scopeType !== scope.scopeType) return false;
    if (grant.scopeValue == null) return false;
    switch (grant.scopeType) {
        case "doc_folder":
            return folderContains(grant.scopeValue, scope.scopeValue);
        case "url_domain":
            return domainMatches(grant.scopeValue, scope.scopeValue);
    }
}

/** "/school" contains "/school" and "/school/ece", but not "/schoolwork". */
export function folderContains(parent: string, child: string): boolean {
    if (parent === "/") return true;
    return child === parent || child.startsWith(`${parent}/`);
}

/** "example.com" matches "example.com" and "docs.example.com", not "notexample.com". */
export function domainMatches(granted: string, requested: string): boolean {
    const g = granted.toLowerCase();
    const r = requested.toLowerCase();
    return r === g || r.endsWith(`.${g}`);
}

/**
 * Ephemeral "allow for session" grants. Created when the user picks
 * "allow for session" on an approval card; scoped to what that call resolved to
 * (the folder, the domain), not to the tool as a whole.
 */
export class SessionGrants {
    private grants: ScopedGrant[] = [];

    addFrom(tool: string, scope: ResolvedScope): void {
        this.grants.push({
            tool,
            access: scope.access,
            scopeType: scope.scopeType,
            scopeValue: scope.scopeValue,
        });
    }

    matches(tool: string, scope: ResolvedScope): boolean {
        return this.grants.some((g) => grantMatches(g, tool, scope));
    }

    list(): readonly ScopedGrant[] {
        return this.grants;
    }

    clear(): void {
        this.grants = [];
    }
}

/** DB grant row → engine grant. */
export function toScopedGrant(row: PermissionGrant): ScopedGrant {
    return {
        tool: row.tool,
        access: row.access,
        scopeType: row.scope_type,
        scopeValue: row.scope_value,
    };
}
