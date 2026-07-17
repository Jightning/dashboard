import { useRef } from "react";
import { cn } from "@/lib/utils";

const TOKEN_SPLIT = /(\{\{\s*[a-zA-Z0-9_]+\s*\}\})/g;
const TOKEN_NAME = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/;

/**
 * A textarea whose {{tokens}} read as inline pills. Overlay technique: the
 * textarea's text is transparent (caret stays visible) above a backdrop
 * rendering the identical characters with styling. Identical font, padding,
 * and wrapping keep the two in register; scroll is synced on every scroll
 * event. Resize tracks automatically — the backdrop is `absolute inset-0`
 * inside a `relative` wrapper whose auto height follows the in-flow
 * textarea, so dragging the native resize handle grows both together with
 * no extra JS. Unknown tokens show red — they throw at run time.
 */
export function TemplateEditor({
    value,
    onChange,
    knownTokens,
    placeholder,
    rows = 2,
    taRef,
}: {
    value: string;
    onChange: (v: string) => void;
    knownTokens: string[];
    placeholder?: string;
    rows?: number;
    /** Exposes the textarea for caret-position token insertion. */
    taRef?: (el: HTMLTextAreaElement | null) => void;
}) {
    const backdropRef = useRef<HTMLDivElement>(null);
    const known = new Set(knownTokens);

    // Padding/font/rounding match the shared Textarea (src/components/ui/input.tsx)
    // exactly, so this drop-in replacement is visually seamless: px-3 py-2,
    // text-sm, rounded-md, min-h-16. whitespace-pre-wrap/break-words make the
    // backdrop wrap identically to a native textarea.
    const shared =
        "w-full min-h-16 whitespace-pre-wrap break-words rounded-md px-3 py-2 text-sm";

    return (
        <div className="relative">
            <div
                ref={backdropRef}
                aria-hidden
                className={cn(
                    shared,
                    "pointer-events-none absolute inset-0 overflow-hidden border border-transparent text-foreground",
                )}
            >
                {value.split(TOKEN_SPLIT).map((seg, i) => {
                    const name = TOKEN_NAME.exec(seg)?.[1];
                    if (!name) return <span key={i}>{seg}</span>;
                    const ok = known.has(name);
                    return (
                        <span
                            key={i}
                            className={cn(
                                "rounded-sm",
                                ok
                                    ? "bg-primary/20 text-primary"
                                    : "bg-destructive/20 text-destructive",
                            )}
                        >
                            <span className="opacity-30">{"{{"}</span>
                            {seg.slice(2, -2)}
                            <span className="opacity-30">{"}}"}</span>
                        </span>
                    );
                })}
                {/* Trailing newline keeps backdrop height == textarea height. */}
                {"\n"}
            </div>
            <textarea
                ref={taRef}
                rows={rows}
                value={value}
                placeholder={placeholder}
                spellCheck={false}
                onChange={(e) => onChange(e.target.value)}
                onScroll={(e) => {
                    if (backdropRef.current)
                        backdropRef.current.scrollTop = e.currentTarget.scrollTop;
                }}
                className={cn(
                    shared,
                    "relative block resize-y border border-input bg-transparent text-transparent placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-(--dur-fast) hover:border-primary/40 focus-visible:border-primary/60 focus-visible:outline-none focus-visible:glow-sm disabled:opacity-50",
                )}
                style={{ caretColor: "var(--foreground)" }}
            />
        </div>
    );
}
