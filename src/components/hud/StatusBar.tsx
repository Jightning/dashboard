import { useEffect, useState } from "react";
import type { ReactNode } from "react";

/**
 * Bottom shell strip: system heartbeat, caller-provided readouts, and a
 * live clock. Keep entries short and mono — it's an instrument panel.
 */
export function StatusBar({ children }: { children?: ReactNode }) {
    return (
        <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-border bg-background/85 px-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-1.5">
                <span className="animate-pulse-core h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_6px_var(--success)]" />
                sys online
            </span>
            {children}
            <span className="flex-1" />
            <Clock />
        </footer>
    );
}

function Clock() {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <time dateTime={now.toISOString()}>
            {now.toLocaleTimeString(undefined, { hour12: false })}
        </time>
    );
}
