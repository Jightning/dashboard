/**
 * Minimal DB interface implemented twice: tauriClient.ts (tauri-plugin-sql, the
 * real app) and testClient.ts (better-sqlite3, vitest only). SQL uses `?`
 * placeholders, which both sqlx (plugin-sql) and better-sqlite3 accept.
 */
export interface DbClient {
    select<T = Record<string, unknown>>(
        sql: string,
        params?: unknown[],
    ): Promise<T[]>;
    execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number }>;
}

let current: DbClient | null = null;

export function setDb(client: DbClient): void {
    current = client;
}

export function getDb(): DbClient {
    if (!current) {
        throw new Error("DB not initialized — call setDb() during app startup");
    }
    return current;
}
