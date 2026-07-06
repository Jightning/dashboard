/**
 * Vitest-only DbClient over better-sqlite3, running the real migration SQL so
 * tests exercise the same schema, triggers, and FTS5 behavior as the app.
 * Never import this from application code — better-sqlite3 is a dev dependency.
 */
import BetterSqlite3 from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { DbClient } from "./client";

const migrationsDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../src-tauri/migrations",
);

export function createTestDbClient(): DbClient & { close: () => void } {
    const db = new BetterSqlite3(":memory:");
    db.pragma("foreign_keys = ON");
    db.exec(readFileSync(join(migrationsDir, "0001_init.sql"), "utf8"));

    return {
        async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
            return db.prepare(sql).all(...params) as T[];
        },
        async execute(sql: string, params: unknown[] = []) {
            const result = db.prepare(sql).run(...params);
            return { rowsAffected: result.changes };
        },
        close: () => db.close(),
    };
}
