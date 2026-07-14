/**
 * Dedicated worker hosting the WASM SQLite DB. OPFS (this package's only
 * persistent storage backend) is only available inside a worker — the main
 * thread talks to this file over postMessage; see webClient.ts.
 */
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { planMigrations, type MigrationFile } from "./migrationPlan";

/** Every migration file, in filename order — same files tauriClient.ts (via
 * Rust) and testClient.ts both run, so the schema is defined once. */
const migrationFiles: MigrationFile[] = Object.entries(
    import.meta.glob("../../src-tauri/migrations/*.sql", {
        query: "?raw",
        import: "default",
        eager: true,
    }) as Record<string, string>,
)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, sql]) => ({ version: path.split("/").pop()!, sql }));

const DB_FILE = "/dashboard.db";

interface QueryMsg {
    type: "query" | "run";
    id: number;
    sql: string;
    params: unknown[];
}

async function main() {
    const sqlite3 = await sqlite3InitModule();
    const poolUtil = await sqlite3.installOpfsSAHPoolVfs({
        name: "dashboard-opfs",
    });

    const db = new poolUtil.OpfsSAHPoolDb(DB_FILE);

    // SQLite defaults foreign keys OFF per connection; enable so ON DELETE
    // CASCADE fires (e.g. deleting a session removes its messages/attachments).
    // The Tauri (sqlx) and test clients already enable this.
    db.exec("PRAGMA foreign_keys = ON");

    const fts5 = db.exec({
        sql: "SELECT count(*) AS n FROM pragma_compile_options WHERE compile_options = 'ENABLE_FTS5'",
        rowMode: "object",
        returnValue: "resultRows",
    }) as { n: number }[];
    if (!fts5[0] || fts5[0].n < 1) {
        throw new Error(
            "SQLite (WASM) was built without FTS5 — document/note search cannot work.",
        );
    }

    // Bookkeeping table so migrations added after a database was first
    // created still get applied on next launch, not just for brand-new DBs.
    db.exec("CREATE TABLE IF NOT EXISTS _migrations (version TEXT PRIMARY KEY)");
    const appliedVersions = new Set(
        (
            db.exec({
                sql: "SELECT version FROM _migrations",
                rowMode: "object",
                returnValue: "resultRows",
            }) as { version: string }[]
        ).map((r) => r.version),
    );
    const existingTables = new Set(
        (
            db.exec({
                sql: "SELECT name FROM sqlite_master WHERE type = 'table'",
                rowMode: "object",
                returnValue: "resultRows",
            }) as { name: string }[]
        ).map((r) => r.name),
    );
    for (const entry of planMigrations(migrationFiles, appliedVersions, existingTables)) {
        if (entry.run) db.exec(entry.sql);
        db.exec({
            sql: "INSERT INTO _migrations (version) VALUES (?)",
            bind: [entry.version],
        });
    }

    self.postMessage({ type: "ready" });

    self.onmessage = (e: MessageEvent<QueryMsg>) => {
        const { type, id, sql, params } = e.data;
        try {
            if (type === "query") {
                const rows = db.exec({
                    sql,
                    bind: params as never[],
                    rowMode: "object",
                    returnValue: "resultRows",
                });
                self.postMessage({ id, rows });
            } else {
                db.exec({ sql, bind: params as never[] });
                self.postMessage({ id, rowsAffected: Number(db.changes()) });
            }
        } catch (err) {
            self.postMessage({
                id,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    };
}

main().catch((err: unknown) => {
    self.postMessage({
        type: "init-error",
        message: err instanceof Error ? err.message : String(err),
    });
});
