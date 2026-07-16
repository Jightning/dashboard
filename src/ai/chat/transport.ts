import {
    createAgentUIStream,
    type Agent,
    type ChatTransport,
    type ToolSet,
    type UIMessage,
    type UIMessageChunk,
} from "ai";
import { getSession, touchSession } from "@/db/repo/sessions";
import { insertMessage, listActiveMessages } from "@/db/repo/messages";
import { maybeCompact } from "@/ai/context/compaction";
import type { UsageCollector } from "@/ai/context/tokens";
import type { ChatMessage, Preset } from "@/lib/schemas";

/** Everything one chat session needs at send time. Built by ChatWorkspace. */
export interface SessionChatContext {
    sessionId: string;
    preset: Preset;
    orchestrator: Agent<never, ToolSet>;
    /** Router-model summarizer for compaction. */
    summarize: (prompt: string) => Promise<string>;
    collector: UsageCollector;
}

export function rowToUiMessage(row: ChatMessage): UIMessage {
    return {
        id: row.id,
        role: row.role as UIMessage["role"],
        parts: JSON.parse(row.parts_json) as UIMessage["parts"],
    };
}

/**
 * Client-side chat transport: no HTTP, the agent loop runs in the webview.
 * Each send: persist the user message → compact if over threshold → rebuild
 * context from the DB (summary + non-compacted messages) → stream the
 * orchestrator → persist the assistant message with aggregated token usage.
 */
export class SessionTransport implements ChatTransport<UIMessage> {
    constructor(
        private deps: {
            getContext: () => SessionChatContext | null;
            /** Called after the assistant message is stored (refresh TokenMeter etc.). */
            onPersisted?: () => void;
        },
    ) {}

    async sendMessages({
        messages,
        abortSignal,
    }: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0]): Promise<
        ReadableStream<UIMessageChunk>
    > {
        const ctx = this.deps.getContext();
        if (!ctx) throw new Error("no active chat session");
        const { sessionId, preset, collector } = ctx;

        const last = messages.at(-1);
        if (last?.role === "user") {
            await insertMessage({
                sessionId,
                role: "user",
                partsJson: JSON.stringify(last.parts),
            });
        }

        await maybeCompact({
            sessionId,
            thresholdTokens: preset.compaction_threshold,
            summarize: ctx.summarize,
        });

        const session = await getSession(sessionId);
        const active = await listActiveMessages(sessionId);
        const uiMessages: UIMessage[] = [];
        if (session.compaction_summary) {
            uiMessages.push({
                id: "compaction-summary",
                role: "system",
                parts: [
                    {
                        type: "text",
                        text: `Summary of the earlier conversation:\n${session.compaction_summary}`,
                    },
                ],
            });
        }
        uiMessages.push(...active.map(rowToUiMessage));

        collector.reset();
        return createAgentUIStream({
            agent: ctx.orchestrator,
            uiMessages,
            abortSignal,
            onEnd: async ({ responseMessage, isAborted }) => {
                if (isAborted || !responseMessage) return;
                const totals = collector.totals();
                await insertMessage({
                    sessionId,
                    role: "assistant",
                    partsJson: JSON.stringify(responseMessage.parts),
                    model: preset.model,
                    agent: "orchestrator",
                    usage: totals,
                });
                collector.reset();
                await touchSession(sessionId);
                this.deps.onPersisted?.();
            },
        });
    }

    async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
        return null; // everything is local; there is no server stream to resume
    }
}
