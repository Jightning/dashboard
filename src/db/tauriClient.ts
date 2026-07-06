import Database from "@tauri-apps/plugin-sql";
import type { DbClient } from "./client";

/** Loads the app database (migrations run on the Rust side before this resolves). */
export async function createTauriDbClient(): Promise<DbClient> {
    const db = await Database.load("sqlite:dashboard.db");

    const client: DbClient = {
        async select<T>(sql: string, params?: unknown[]): Promise<T[]> {
            return db.select<T[]>(sql, params);
        },
        async execute(sql: string, params?: unknown[]) {
            const result = await db.execute(sql, params);
            return { rowsAffected: result.rowsAffected };
        },
    };

    await assertFts5(client);
    return client;
}

/** FTS5 is required for document search; fail fast if this build lacks it. */
async function assertFts5(client: DbClient): Promise<void> {
    const rows = await client.select<{ n: number }>(
        "SELECT count(*) AS n FROM pragma_compile_options WHERE compile_options = 'ENABLE_FTS5'",
    );
    if (!rows[0] || rows[0].n < 1) {
        throw new Error(
            "SQLite was built without FTS5 — document search cannot work. " +
                "This is a packaging bug; see docs/architecture.md (FTS5 startup check).",
        );
    }
}
