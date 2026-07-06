import { describe, expect, it } from "vitest";
import { createModel, supportsVision } from "./registry";
import {
    DEFAULT_SETTINGS,
    createMemorySettingsStore,
    settingsSchema,
} from "./keys";

const settingsWithKeys = settingsSchema.parse({
    googleApiKey: "g-key",
    anthropicApiKey: "a-key",
    openaiApiKey: "o-key",
});

describe("provider registry", () => {
    it("creates models for every provider", () => {
        for (const [provider, modelId] of [
            ["google", "gemini-2.5-flash"],
            ["anthropic", "claude-opus-4-8"],
            ["openai", "gpt-5-mini"],
            ["ollama", "llama3.2"],
        ] as const) {
            const model = createModel(
                { provider, modelId },
                { settings: settingsWithKeys },
            );
            expect(model).toBeDefined();
            if (typeof model !== "string") expect(model.modelId).toBe(modelId);
        }
    });

    it("fails fast when a cloud provider has no key", () => {
        expect(() =>
            createModel(
                { provider: "anthropic", modelId: "claude-opus-4-8" },
                { settings: DEFAULT_SETTINGS },
            ),
        ).toThrow(/No API key configured/);
    });

    it("routes provider requests through the injected fetch", async () => {
        let requestedUrl = "";
        const mockFetch: typeof fetch = async (input) => {
            requestedUrl = String(input instanceof Request ? input.url : input);
            return new Response(
                JSON.stringify({ error: { message: "stop here" } }),
                {
                    status: 500,
                    headers: { "content-type": "application/json" },
                },
            );
        };
        const model = createModel(
            { provider: "google", modelId: "gemini-2.5-flash" },
            { settings: settingsWithKeys, fetch: mockFetch },
        );
        if (typeof model === "string") throw new Error("expected model object");
        await expect(
            model.doGenerate({
                prompt: [
                    { role: "user", content: [{ type: "text", text: "hi" }] },
                ],
            }),
        ).rejects.toThrow();
        expect(requestedUrl).toContain("generativelanguage.googleapis.com");
    });

    it("flags vision-capable models", () => {
        expect(
            supportsVision({ provider: "google", modelId: "gemini-2.5-flash" }),
        ).toBe(true);
        expect(supportsVision({ provider: "ollama", modelId: "llava" })).toBe(
            true,
        );
        expect(
            supportsVision({ provider: "ollama", modelId: "llama3.2" }),
        ).toBe(false);
    });

    it("persists settings through the memory store", async () => {
        const store = createMemorySettingsStore();
        const s = await store.load();
        await store.save({ ...s, googleApiKey: "abc" });
        expect((await store.load()).googleApiKey).toBe("abc");
    });
});
