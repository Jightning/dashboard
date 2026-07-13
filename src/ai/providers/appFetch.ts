import { isTauri } from "@/lib/env";
import { tauriFetch } from "./tauriFetch";

/** Desktop: plugin-http (no CORS). Browser: global fetch, bound so it isn't called detached. */
export const appFetch: typeof globalThis.fetch = isTauri()
    ? tauriFetch
    : globalThis.fetch.bind(globalThis);
