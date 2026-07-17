import { defineConfig } from "vitest/config";
import type { Plugin, Connect } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// The browser target can't fetch cross-origin (CORS + this server's COEP
// header). Web tools route through /__proxy?url= instead; the dev server
// fetches server-side and replies same-origin. Desktop never hits this —
// plugin-http exits via Rust.
function corsProxy(): Plugin {
    const handler: Connect.NextHandleFunction = (req, res, next) => {
        const url = new URL(req.url ?? "", "http://localhost").searchParams.get("url");
        if (!url) return next();
        let target: URL;
        try {
            target = new URL(url);
        } catch {
            res.statusCode = 400;
            return res.end("invalid url");
        }
        if (target.protocol !== "http:" && target.protocol !== "https:") {
            res.statusCode = 400;
            return res.end("http(s) only");
        }
        void fetch(target, { headers: { accept: "text/html, text/plain, application/json" }, redirect: "follow" })
            .then(async (r) => {
                res.statusCode = r.status;
                res.setHeader("content-type", r.headers.get("content-type") ?? "text/plain");
                res.end(Buffer.from(await r.arrayBuffer()));
            })
            .catch((e: unknown) => {
                res.statusCode = 502;
                res.end(`proxy fetch failed: ${e instanceof Error ? e.message : String(e)}`);
            });
    };
    return {
        name: "cors-proxy",
        configureServer(server) {
            server.middlewares.use("/__proxy", handler);
        },
        configurePreviewServer(server) {
            server.middlewares.use("/__proxy", handler);
        },
    };
}

// Tauri expects a fixed dev port and no clearing of its own CLI output.
export default defineConfig({
    plugins: [react(), tailwindcss(), corsProxy()],
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
