// Type-only import: erased at build time, so this never creates a runtime
// circular dependency even though registry.ts imports from this module too.
import type { ProviderId } from "@/ai/providers/registry";

// True when running inside the Tauri webview (vs. a plain browser tab)
export function isTauri(): boolean {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// True only for an actual browser tab 
export function isWebBrowser(): boolean {
    return typeof window !== "undefined" && !isTauri();
}

// Providers whose APIs allow direct browser-side calls (CORS)
export const WEB_ALLOWED_PROVIDERS: ProviderId[] = ["google", "ollama"];

const ALL_PROVIDERS: ProviderId[] = ["google", "anthropic", "openai", "ollama"];

export function availableProviders(): ProviderId[] {
    return isWebBrowser() ? WEB_ALLOWED_PROVIDERS : ALL_PROVIDERS;
}
