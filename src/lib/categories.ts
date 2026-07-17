import type { ChatSession, Project } from "./schemas";

/**
 * A chat's category: its own tag wins, else it inherits from its project.
 * Single source of truth for the sidebar filter and the network builder.
 */
export function effectiveCategoryId(
    session: ChatSession,
    projectById: Map<string, Project>,
): string | null {
    if (session.category_id) return session.category_id;
    if (session.project_id)
        return projectById.get(session.project_id)?.category_id ?? null;
    return null;
}
