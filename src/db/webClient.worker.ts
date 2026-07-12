/**
 * Dedicated worker hosting the WASM SQLite DB. OPFS (this package's only
 * persistent storage backend) is only available inside a worker — the main
 * thread talks to this file over postMessage; see webClient.ts.
 */
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

/** Every migration's raw SQL, in filename order — same files tauriClient.ts
 * (via Rust) and testClient.ts both run, so the schema is defined once. */
const migrationSql: string[] = Object.entries(
    import.meta.glob("../../src-tauri/migrations/*.sql", {
        query: "?raw",
        import: "default",
        eager: true,
    }) as Record<string, string>,
)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, sql]) => sql);

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

    const isNewDb = !poolUtil.getFileNames().includes(DB_FILE);
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

    if (isNewDb) {
        for (const sql of migrationSql) db.exec(sql);
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
