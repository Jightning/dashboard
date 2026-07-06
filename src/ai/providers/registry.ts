import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOllama } from "ai-sdk-ollama";
import type { LanguageModel } from "ai";
import type { Settings } from "./keys";

export type ProviderId = "google" | "anthropic" | "openai" | "ollama";

export const PROVIDERS: Record<
    ProviderId,
    { label: string; needsKey: boolean }
> = {
    google: { label: "Google Gemini (free tier)", needsKey: true },
    anthropic: { label: "Anthropic (BYOK)", needsKey: true },
    openai: { label: "OpenAI (BYOK)", needsKey: true },
    ollama: { label: "Ollama (local)", needsKey: false },
};

/** Suggested models per provider — pickers accept free text, so staleness is harmless. */
export const SUGGESTED_MODELS: Record<ProviderId, string[]> = {
    google: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"],
    anthropic: ["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5"],
    openai: ["gpt-5.2", "gpt-5-mini"],
    ollama: ["llama3.2", "qwen3", "llava"],
};

export interface ModelRef {
    provider: ProviderId;
    modelId: string;
}

export interface ProviderRuntime {
    settings: Settings;
    /** Injected so the app can use plugin-http and tests can use mocks. */
    fetch?: typeof globalThis.fetch;
}

export function createModel(
    ref: ModelRef,
    runtime: ProviderRuntime,
): LanguageModel {
    const { settings, fetch } = runtime;
    switch (ref.provider) {
        case "google": {
            requireKey(settings.googleApiKey, "google");
            return createGoogleGenerativeAI({
                apiKey: settings.googleApiKey,
                fetch,
            })(ref.modelId);
        }
        case "anthropic": {
            requireKey(settings.anthropicApiKey, "anthropic");
            return createAnthropic({ apiKey: settings.anthropicApiKey, fetch })(
                ref.modelId,
            );
        }
        case "openai": {
            requireKey(settings.openaiApiKey, "openai");
            return createOpenAI({ apiKey: settings.openaiApiKey, fetch })(
                ref.modelId,
            );
        }
        case "ollama": {
            return createOllama({
                baseURL: `${settings.ollamaBaseUrl}/api`,
                fetch,
            })(ref.modelId);
        }
    }
}

function requireKey(key: string, provider: ProviderId): void {
    if (!key) {
        throw new Error(
            `No API key configured for provider '${provider}' — add one in Settings.`,
        );
    }
}

/** Rough vision-capability flag used to gate image attachments in the composer. */
export function supportsVision(ref: ModelRef): boolean {
    switch (ref.provider) {
        case "google":
            return true; // all current Gemini chat models accept images
        case "anthropic":
            return true; // all current Claude chat models accept images
        case "openai":
            return !/^o\d|instruct/i.test(ref.modelId);
        case "ollama":
            return /llava|vision|vl|gemma3|qwen.*vl/i.test(ref.modelId);
    }
}

/** Audio-input capability — used by the STT module (Gemini free tier only in v1). */
export function supportsAudioInput(ref: ModelRef): boolean {
    return ref.provider === "google";
}
