import type { DbClient } from "./client";

interface PendingCall {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
}

/**
 * Browser DB client: SQLite compiled to WASM (FTS5 included), persisted via
 * the OPFS "SAH pool" VFS. OPFS is only available inside a Worker (see
 * webClient.worker.ts) — this is a thin postMessage RPC proxy to it,
 * fulfilling the same DbClient interface tauriClient.ts/testClient.ts do.
 */
export async function createWebDbClient(): Promise<DbClient> {
    const worker = new Worker(new URL("./webClient.worker.ts", import.meta.url), {
        type: "module",
    });

    await new Promise<void>((resolve, reject) => {
        const onReady = (e: MessageEvent) => {
            if (e.data?.type === "ready") {
                cleanup();
                resolve();
            } else if (e.data?.type === "init-error") {
                cleanup();
                reject(new Error(e.data.message));
            }
        };
        const onError = (e: ErrorEvent) => {
            cleanup();
            reject(new Error(e.message));
        };
        const cleanup = () => {
            worker.removeEventListener("message", onReady);
            worker.removeEventListener("error", onError);
        };
        worker.addEventListener("message", onReady);
        worker.addEventListener("error", onError);
    });

    let nextId = 0;
    const pending = new Map<number, PendingCall>();
    worker.addEventListener("message", (e: MessageEvent) => {
        const { id, rows, rowsAffected, error } = e.data;
        const call = pending.get(id);
        if (!call) return;
        pending.delete(id);
        if (error) call.reject(new Error(error));
        else call.resolve(rows !== undefined ? rows : { rowsAffected });
    });

    function call<T>(
        type: "query" | "run",
        sql: string,
        params: unknown[],
    ): Promise<T> {
        const id = nextId++;
        return new Promise<T>((resolve, reject) => {
            pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
            worker.postMessage({ type, id, sql, params });
        });
    }

    return {
        select: <T>(sql: string, params: unknown[] = []) =>
            call<T[]>("query", sql, params),
        execute: (sql: string, params: unknown[] = []) =>
            call<{ rowsAffected: number }>("run", sql, params),
    };
}
