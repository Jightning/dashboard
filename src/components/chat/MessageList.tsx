import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { motion } from "motion/react";
import { CircleCheck, CircleX, Wrench } from "lucide-react";
import { NeuralCore } from "@/components/hud/NeuralCore";
import { Typewriter } from "@/components/hud/Typewriter";
import { agentColor } from "@/components/hud/AgentNode";
import { cn } from "@/lib/utils";

export function MessageList({
    messages,
    busy,
}: {
    messages: UIMessage[];
    /** True while a response is streaming — shows the thinking core. */
    busy?: boolean;
}) {
    const bottomRef = useRef<HTMLDivElement>(null);

    // Instant (not smooth) scroll: during streaming this fires on every token,
    // and a re-triggered smooth scroll fights itself and janks.
    useEffect(() => {
        bottomRef.current?.scrollIntoView();
    }, [messages]);

    const visible = messages.filter((m) => m.role !== "system");

    if (visible.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-4 [scrollbar-gutter:stable_both-edges]">
                <NeuralCore size={260} state="idle" />
                <div className="font-mono text-sm uppercase tracking-[0.2em] text-primary text-glow">
                    <Typewriter text="ai os · ready" />
                </div>
                <p className="max-w-sm text-center text-xs text-muted-foreground">
                    Ask anything. Agents and tools only touch your data under
                    the permission level you selected.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col overflow-y-auto p-4 [scrollbar-gutter:stable_both-edges]">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
                {visible.map((message) => (
                    <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                            duration: 0.25,
                            ease: [0.16, 1, 0.3, 1],
                        }}
                        className={cn(
                            "max-w-[85%] px-3.5 py-2.5 text-sm",
                            message.role === "user"
                                ? "hud-panel self-end border-primary/35 bg-primary/10"
                                : "hud-panel self-start",
                        )}
                    >
                        {message.role === "assistant" && (
                            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-primary/80">
                                ai os
                            </div>
                        )}
                        {message.parts.map((part, i) => (
                            <MessagePart key={i} part={part} />
                        ))}
                    </motion.div>
                ))}
                {busy && (
                    <div className="flex items-center gap-1 self-start">
                        <NeuralCore size={60} state="thinking" />
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/80">
                            processing
                        </span>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}

/** Which agent a tool belongs to — drives the activity row identity color. */
const TOOL_AGENT: Record<string, string> = {
    ask_knowledge_agent: "knowledge",
    search_documents: "knowledge",
    read_document: "knowledge",
    list_documents: "knowledge",
    ask_research_agent: "research",
    fetch_url: "research",
};

function MessagePart({ part }: { part: UIMessage["parts"][number] }) {
    if (part.type === "text") {
        return <div className="whitespace-pre-wrap">{part.text}</div>;
    }
    if (part.type === "reasoning") {
        return (
            <div className="border-l border-border pl-2 text-xs italic text-muted-foreground">
                {part.text}
            </div>
        );
    }
    if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
        const name =
            part.type === "dynamic-tool"
                ? "tool"
                : part.type.slice("tool-".length);
        const state = "state" in part ? String(part.state) : "";
        const running = state.startsWith("input");
        const failed = state === "output-error";
        const color = agentColor(TOOL_AGENT[name] ?? "orchestrator");
        const StateIcon = failed ? CircleX : running ? Wrench : CircleCheck;

        return (
            <div
                className={cn(
                    "my-1 flex items-center gap-2 rounded-sm border border-border px-2 py-1 font-mono text-xs",
                    running && "shimmer",
                )}
                style={{ borderLeftColor: color, borderLeftWidth: 2 }}
            >
                <StateIcon
                    aria-hidden
                    className={cn(
                        "h-3.5 w-3.5",
                        failed ? "text-destructive" : undefined,
                    )}
                    style={failed ? undefined : { color }}
                />
                <span style={{ color }}>{name}</span>
                {state && (
                    <span className="text-muted-foreground">
                        {state.replace(/-/g, " ")}
                    </span>
                )}
            </div>
        );
    }
    if (part.type === "file" && part.mediaType?.startsWith("image/")) {
        return (
            <img
                src={part.url}
                alt="attachment"
                className="my-1 max-h-48 rounded-md border border-border"
            />
        );
    }
    return null;
}
