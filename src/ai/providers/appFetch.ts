import { isTauri } from "@/lib/env";
import { tauriFetch } from "./tauriFetch";

/** Desktop: plugin-http (no CORS). Browser: global fetch, bound so it isn't called detached. */
export const appFetch: typeof globalThis.fetch = isTauri()
    ? tauriFetch
    : globalThis.fetch.bind(globalThis);

/**
 * Fetch for *web tools* (arbitrary sites). Desktop: plugin-http, no CORS.
 * Browser: rewritten through the dev server's /__proxy middleware, because
 * arbitrary sites don't send CORS headers.
 */
export function wrapWebFetch(fetchImpl: typeof globalThis.fetch): typeof globalThis.fetch {
    if (isTauri()) return fetchImpl;
    return (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        return fetchImpl(`/__proxy?url=${encodeURIComponent(url)}`, init);
    };
}
