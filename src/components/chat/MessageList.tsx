import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { cn } from "@/lib/utils";

export function MessageList({ messages }: { messages: UIMessage[] }) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    return (
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages
                .filter((m) => m.role !== "system")
                .map((message) => (
                    <div
                        key={message.id}
                        className={cn(
                            "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                            message.role === "user"
                                ? "self-end bg-primary text-primary-foreground"
                                : "self-start bg-muted",
                        )}
                    >
                        {message.parts.map((part, i) => (
                            <MessagePart key={i} part={part} />
                        ))}
                    </div>
                ))}
            <div ref={bottomRef} />
        </div>
    );
}

function MessagePart({ part }: { part: UIMessage["parts"][number] }) {
    if (part.type === "text") {
        return <div className="whitespace-pre-wrap">{part.text}</div>;
    }
    if (part.type === "reasoning") {
        return (
            <div className="text-xs italic text-muted-foreground">
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
        return (
            <div className="my-1 inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                ⚙ {name}
                {state && (
                    <span className="opacity-70">
                        · {state.replace(/-/g, " ")}
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
                className="my-1 max-h-48 rounded"
            />
        );
    }
    return null;
}
