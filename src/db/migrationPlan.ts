export interface MigrationFile {
    /** Filename, e.g. "0003_agents.sql" -- doubles as the bookkeeping key. */
    version: string;
    sql: string;
}

export interface MigrationPlanEntry extends MigrationFile {
    /**
     * false when this migration's tables already exist in a legacy,
     * untracked database -- record it as applied without re-running its SQL
     * (which would fail against tables that already exist).
     */
    run: boolean;
}

const CREATE_TABLE = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?([a-zA-Z0-9_]+)/gi;

/**
 * Decides which migrations still need to run, given the full sorted list of
 * migration files, the versions already recorded in the bookkeeping table,
 * and the tables that currently exist in the database.
 *
 * Handles the one-time transition for databases that predate migration
 * tracking: when nothing has been recorded yet but the database already has
 * tables, a migration is treated as historically applied (record only, don't
 * re-run) when every table its SQL creates already exists -- so opening an
 * old database only runs the migrations added since it was last opened,
 * instead of re-running (and failing on) ones it already has. Once any
 * version has been recorded, the database is considered tracked and this
 * table-existence heuristic no longer applies -- only the ledger decides.
 */
export function planMigrations(
    migrations: MigrationFile[],
    appliedVersions: ReadonlySet<string>,
    existingTables: ReadonlySet<string>,
): MigrationPlanEntry[] {
    const bootstrapping = appliedVersions.size === 0 && existingTables.size > 0;
    const plan: MigrationPlanEntry[] = [];

    for (const m of migrations) {
        if (appliedVersions.has(m.version)) continue;

        if (bootstrapping) {
            const created = [...m.sql.matchAll(CREATE_TABLE)].map((match) => match[1]!);
            if (created.length > 0 && created.every((t) => existingTables.has(t))) {
                plan.push({ ...m, run: false });
                continue;
            }
        }

        plan.push({ ...m, run: true });
    }

    return plan;
}
