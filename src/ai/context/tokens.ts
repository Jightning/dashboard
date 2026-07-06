import type { ChatMessage } from "@/lib/schemas";
import type { AgentUsageEvent } from "@/ai/agents/types";

/**
 * chars/4 estimate. Only used to gate compaction — real usage comes from
 * provider responses and is stored per message.
 */
export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/** Pull the human-readable text out of stored UIMessage parts. */
export function textFromPartsJson(partsJson: string): string {
    try {
        const parts = JSON.parse(partsJson) as Array<{
            type?: string;
            text?: string;
        }>;
        return parts
            .filter((p) => typeof p.text === "string")
            .map((p) => p.text)
            .join("\n");
    } catch {
        return partsJson;
    }
}

export function estimateContextTokens(opts: {
    summary: string | null;
    activeMessages: ChatMessage[];
}): number {
    const summaryTokens = opts.summary ? estimateTokens(opts.summary) : 0;
    const messageTokens = opts.activeMessages.reduce(
        (sum, m) => sum + estimateTokens(textFromPartsJson(m.parts_json)),
        0,
    );
    return summaryTokens + messageTokens;
}

/** Accumulates usage events from one send (orchestrator + any specialists). */
export class UsageCollector {
    events: AgentUsageEvent[] = [];

    collect = (event: AgentUsageEvent): void => {
        this.events.push(event);
    };

    totals(): {
        inputTokens: number;
        outputTokens: number;
        cachedInputTokens: number;
    } {
        let inputTokens = 0;
        let outputTokens = 0;
        let cachedInputTokens = 0;
        for (const e of this.events) {
            inputTokens += e.usage.inputTokens ?? 0;
            outputTokens += e.usage.outputTokens ?? 0;
            cachedInputTokens +=
                e.usage.inputTokenDetails?.cacheReadTokens ?? 0;
        }
        return { inputTokens, outputTokens, cachedInputTokens };
    }

    reset(): void {
        this.events = [];
    }
}
