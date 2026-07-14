import { documentScopeResolvers } from "./documents";
import { noteScopeResolvers } from "./notes";
import { webScopeResolvers } from "./web";
import { taskScopeResolvers } from "./tasks";
import { applicationScopeResolvers } from "./applications";
import type { ScopeResolver } from "./context";

/**
 * Tool name → scope resolver. The ApprovalCard uses this to explain what a
 * pending call touches and to add the right session grant on "allow for session".
 */
export const scopeResolvers: Record<string, ScopeResolver> = {
    ...documentScopeResolvers,
    ...noteScopeResolvers,
    ...webScopeResolvers,
    ...taskScopeResolvers,
    ...applicationScopeResolvers,
};
