import { fetch as httpFetch } from "@tauri-apps/plugin-http";

/**
 * fetch for AI provider calls. plugin-http routes requests through Rust, so the
 * webview origin (http://tauri.localhost) never hits provider CORS policies.
 * Reachable hosts are whitelisted in src-tauri/capabilities/default.json.
 */
export const tauriFetch: typeof globalThis.fetch = httpFetch;
