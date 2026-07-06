import { getSession, setCompactionSummary } from "@/db/repo/sessions";
import { listActiveMessages, markCompacted } from "@/db/repo/messages";
import type { ChatMessage } from "@/lib/schemas";
import { estimateContextTokens, textFromPartsJson } from "./tokens";

/** How many recent messages stay verbatim after a compaction. */
export const KEEP_RECENT = 6;

export interface CompactionResult {
    compacted: boolean;
    estimatedTokensBefore: number;
}

/**
 * Runs before each send. If the estimated context exceeds the threshold, the
 * router model summarizes everything but the last KEEP_RECENT messages into
 * chat_sessions.compaction_summary; summarized rows are flagged compacted=1 and
 * excluded from future context.
 */
export async function maybeCompact(opts: {
    sessionId: string;
    thresholdTokens: number | null;
    summarize: (prompt: string) => Promise<string>;
}): Promise<CompactionResult> {
    const session = await getSession(opts.sessionId);
    const active = await listActiveMessages(opts.sessionId);
    const estimate = estimateContextTokens({
        summary: session.compaction_summary,
        activeMessages: active,
    });

    if (opts.thresholdTokens == null || estimate <= opts.thresholdTokens) {
        return { compacted: false, estimatedTokensBefore: estimate };
    }

    const toSummarize = active.slice(0, -KEEP_RECENT);
    if (toSummarize.length === 0) {
        return { compacted: false, estimatedTokensBefore: estimate };
    }

    const summary = await opts.summarize(
        buildSummaryPrompt(session.compaction_summary, toSummarize),
    );
    if (!summary.trim()) {
        throw new Error("compaction summarizer returned empty text");
    }

    await setCompactionSummary(opts.sessionId, summary.trim());
    await markCompacted(toSummarize.map((m) => m.id));
    return { compacted: true, estimatedTokensBefore: estimate };
}

export function buildSummaryPrompt(
    previousSummary: string | null,
    messages: ChatMessage[],
): string {
    const transcript = messages
        .map((m) => `${m.role}: ${textFromPartsJson(m.parts_json)}`)
        .join("\n");
    return [
        "Condense this conversation into a compact context summary for an AI assistant.",
        "Preserve every concrete fact, decision, name, number, URL, and open question.",
        "Write dense prose, no preamble, no commentary.",
        previousSummary
            ? `Existing summary (fold it in):\n${previousSummary}`
            : "",
        `Conversation:\n${transcript}`,
    ]
        .filter(Boolean)
        .join("\n\n");
}
