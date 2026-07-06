import { evaluateToolCall, SessionGrants } from "@/ai/permissions/engine";
import { ApprovalBroker } from "@/ai/permissions/broker";
import type { ResolvedScope, ScopedGrant } from "@/ai/permissions/types";

/** Structured denial returned to the model so it can answer without the data. */
export interface DeniedResult {
    denied: true;
    reason: string;
}

/**
 * Everything a tool needs to decide allow-vs-ask, plus the broker that asks the
 * user. One instance per chat session; levelGrants swap when the user changes
 * the permission-level dropdown.
 */
export class PermissionContext {
    levelGrants: ScopedGrant[] = [];
    readonly sessionGrants = new SessionGrants();
    readonly broker = new ApprovalBroker();

    decide(tool: string, scope: ResolvedScope): "allow" | "ask" {
        return evaluateToolCall({
            tool,
            scope,
            levelGrants: this.levelGrants,
            sessionGrants: this.sessionGrants,
        });
    }

    /**
     * Wraps a tool's implementation with the permission gate. Runs at execute
     * time (not via the AI SDK's needsApproval) so approvals also pause tools
     * inside nested specialist agents.
     */
    gated<INPUT, OUTPUT>(
        tool: string,
        scopeOf: (input: INPUT) => ResolvedScope | Promise<ResolvedScope>,
        run: (input: INPUT) => Promise<OUTPUT>,
    ): (input: INPUT) => Promise<OUTPUT | DeniedResult> {
        return async (input: INPUT) => {
            const scope = await scopeOf(input);
            if (this.decide(tool, scope) === "ask") {
                const verdict = await this.broker.ask({ tool, input, scope });
                if (verdict === "deny") {
                    return {
                        denied: true,
                        reason: "The user denied this tool call. Answer without this data and say so.",
                    } satisfies DeniedResult;
                }
                if (verdict === "allow-session") {
                    this.sessionGrants.addFrom(tool, scope);
                }
            }
            return run(input);
        };
    }
}

/**
 * Scope resolvers by tool name — used by the ApprovalCard UI to explain what a
 * pending call touches.
 */
export type ScopeResolver = (
    input: unknown,
) => ResolvedScope | Promise<ResolvedScope>;
