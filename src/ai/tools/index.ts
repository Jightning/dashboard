import { documentScopeResolvers } from "./documents";
import { webScopeResolvers } from "./web";
import type { ScopeResolver } from "./context";

/**
 * Tool name → scope resolver. The ApprovalCard uses this to explain what a
 * pending call touches and to add the right session grant on "allow for session".
 */
export const scopeResolvers: Record<string, ScopeResolver> = {
    ...documentScopeResolvers,
    ...webScopeResolvers,
};
