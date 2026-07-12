import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// Tauri expects a fixed dev port and no clearing of its own CLI output.
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    clearScreen: false,
    server: {
        port: 1420,
        strictPort: true,
        // Required for OPFS (the web target's persistent SQLite storage) —
        // see @sqlite.org/sqlite-wasm's README. No-op inside the Tauri
        // webview, which doesn't use this dev server's headers at request
        // time for its own asset loading.
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        },
    },
    preview: {
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        },
    },
    envPrefix: ["VITE_", "TAURI_ENV_"],
    build: {
        target: "es2022",
    },
    optimizeDeps: {
        exclude: ["@sqlite.org/sqlite-wasm"],
    },
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
    },
});
