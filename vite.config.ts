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
    },
    envPrefix: ["VITE_", "TAURI_ENV_"],
    build: {
        target: "es2022",
    },
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
    },
});
