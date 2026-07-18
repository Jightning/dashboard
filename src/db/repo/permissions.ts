import { getDb } from "../client";
import { newId, now } from "@/lib/ids";
import { TOOL_CATALOG } from "@/ai/tools/catalog";
import {
    permissionGrantSchema,
    permissionLevelSchema,
    type PermissionAccess,
    type PermissionGrant,
    type PermissionLevel,
    type ScopeType,
} from "@/lib/schemas";

/** Stable ids so seeding is idempotent and presets can reference them. */
export const BUILTIN_LEVELS = {
    readDocuments: "lvl_read_documents",
    readsOnly: "lvl_reads_only",
} as const;

export async function seedBuiltinLevels(): Promise<void> {
    const t = now();
    await getDb().execute(
        `INSERT OR IGNORE INTO permission_levels (id, name, description, is_builtin, created_at)
     VALUES (?, ?, ?, 1, ?)`,
        [
            BUILTIN_LEVELS.readDocuments,
            "Read documents",
            "Read-only access to all documents; everything else asks.",
            t,
        ],
    );
    await getDb().execute(
        `INSERT OR IGNORE INTO permission_grants (id, level_id, tool, access, scope_type, scope_value)
     VALUES ('grt_read_docs_search', ?, 'search_documents', 'read', 'any', NULL),
            ('grt_read_docs_read', ?, 'read_document', 'read', 'any', NULL),
            ('grt_read_docs_list', ?, 'list_documents', 'read', 'any', NULL)`,
        [
            BUILTIN_LEVELS.readDocuments,
            BUILTIN_LEVELS.readDocuments,
            BUILTIN_LEVELS.readDocuments,
        ],
    );

    await getDb().execute(
        `INSERT OR IGNORE INTO permission_levels (id, name, description, is_builtin, created_at)
     VALUES (?, ?, ?, 1, ?)`,
        [
            BUILTIN_LEVELS.readsOnly,
            "Reads only",
            "Every read tool runs without asking; anything that writes still asks.",
            t,
        ],
    );
    // One grant per read tool, derived from the catalog so new read tools are
    // covered on the next boot automatically.
    for (const entry of TOOL_CATALOG) {
        if (entry.access !== "read") continue;
        await getDb().execute(
            `INSERT OR IGNORE INTO permission_grants (id, level_id, tool, access, scope_type, scope_value)
         VALUES (?, ?, ?, 'read', 'any', NULL)`,
            [`grt_reads_only_${entry.name}`, BUILTIN_LEVELS.readsOnly, entry.name],
        );
    }
}

export async function createLevel(
    name: string,
    description?: string,
): Promise<PermissionLevel> {
    const id = newId("lvl");
    await getDb().execute(
        "INSERT INTO permission_levels (id, name, description, is_builtin, created_at) VALUES (?, ?, ?, 0, ?)",
        [id, name, description ?? null, now()],
    );
    return getLevel(id);
}

export async function getLevel(id: string): Promise<PermissionLevel> {
    const rows = await getDb().select(
        "SELECT * FROM permission_levels WHERE id = ?",
        [id],
    );
    if (!rows[0]) throw new Error(`permission level not found: ${id}`);
    return permissionLevelSchema.parse(rows[0]);
}

export async function listLevels(): Promise<PermissionLevel[]> {
    const rows = await getDb().select(
        "SELECT * FROM permission_levels ORDER BY created_at ASC",
    );
    return rows.map((r) => permissionLevelSchema.parse(r));
}

export async function deleteLevel(id: string): Promise<void> {
    const level = await getLevel(id);
    if (level.is_builtin)
        throw new Error("built-in permission levels cannot be deleted");
    await getDb().execute("DELETE FROM permission_levels WHERE id = ?", [id]);
}

export async function addGrant(opts: {
    levelId: string;
    tool: string;
    access: PermissionAccess;
    scopeType: ScopeType;
    scopeValue?: string | null;
}): Promise<PermissionGrant> {
    if (opts.scopeType !== "any" && !opts.scopeValue) {
        throw new Error(
            `scope_value is required for scope_type '${opts.scopeType}'`,
        );
    }
    const id = newId("grt");
    await getDb().execute(
        "INSERT INTO permission_grants (id, level_id, tool, access, scope_type, scope_value) VALUES (?, ?, ?, ?, ?, ?)",
        [
            id,
            opts.levelId,
            opts.tool,
            opts.access,
            opts.scopeType,
            opts.scopeType === "any" ? null : opts.scopeValue,
        ],
    );
    const rows = await getDb().select(
        "SELECT * FROM permission_grants WHERE id = ?",
        [id],
    );
    return permissionGrantSchema.parse(rows[0]);
}

export async function listGrants(levelId: string): Promise<PermissionGrant[]> {
    const rows = await getDb().select(
        "SELECT * FROM permission_grants WHERE level_id = ?",
        [levelId],
    );
    return rows.map((r) => permissionGrantSchema.parse(r));
}

export async function removeGrant(id: string): Promise<void> {
    await getDb().execute("DELETE FROM permission_grants WHERE id = ?", [id]);
}
