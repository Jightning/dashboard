import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/** Character-by-character text reveal. Renders instantly for reduced motion. */
export function Typewriter({
    text,
    speed = 28,
    className,
    onDone,
}: {
    text: string;
    /** ms per character. */
    speed?: number;
    className?: string;
    onDone?: () => void;
}) {
    const reduced = useReducedMotion();
    const [count, setCount] = useState(reduced ? text.length : 0);

    useEffect(() => {
        if (reduced) {
            setCount(text.length);
            return;
        }
        setCount(0);
        const timer = setInterval(() => {
            setCount((c) => {
                if (c >= text.length) {
                    clearInterval(timer);
                    return c;
                }
                return c + 1;
            });
        }, speed);
        return () => clearInterval(timer);
    }, [text, speed, reduced]);

    const done = count >= text.length;

    useEffect(() => {
        if (done) onDone?.();
    }, [done, onDone]);

    return (
        <span className={cn("whitespace-pre-wrap", className)}>
            {text.slice(0, count)}
            {!done && (
                <span className="animate-pulse-core inline-block h-[1em] w-[0.5ch] translate-y-[0.15em] bg-primary" />
            )}
        </span>
    );
}
