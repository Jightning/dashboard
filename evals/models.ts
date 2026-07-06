import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOllama } from "ai-sdk-ollama";
import type { LanguageModel } from "ai";

export interface EvalModels {
    /** Runs specialists (retrieval quality matters). */
    main: LanguageModel;
    /** Runs the orchestrator/summarizer (cheap + fast). */
    router: LanguageModel;
    label: string;
}

/**
 * $0 model selection for evals:
 *  - GOOGLE_GENERATIVE_AI_API_KEY set → Gemini free tier
 *  - EVAL_OLLAMA_MODEL set → local Ollama (e.g. EVAL_OLLAMA_MODEL=qwen3)
 *  - neither → null; suites skip cleanly (structure still typechecks/runs in CI)
 */
export function getEvalModels(): EvalModels | null {
    const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (googleKey) {
        const google = createGoogleGenerativeAI({ apiKey: googleKey });
        return {
            main: google("gemini-2.5-flash"),
            router: google("gemini-2.5-flash-lite"),
            label: "gemini-free-tier",
        };
    }
    const ollamaModel = process.env.EVAL_OLLAMA_MODEL;
    if (ollamaModel) {
        const ollama = createOllama({
            baseURL: `${process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"}/api`,
        });
        return {
            main: ollama(ollamaModel),
            router: ollama(ollamaModel),
            label: "ollama",
        };
    }
    return null;
}
