import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { julianDate, moonPhase } from "@/lib/astro";

/**
 * Bottom shell strip, styled as an observatory almanac line: telemetry
 * heartbeat, caller-provided readouts, live ephemeris (JD + moon), clock.
 */
export function StatusBar({ children }: { children?: ReactNode }) {
    return (
        <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-border bg-background/85 px-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-1.5">
                <span className="animate-pulse-core h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_6px_var(--success)]" />
                telemetry nominal
            </span>
            {children}
            <span className="flex-1" />
            <Ephemeris />
            <Clock />
        </footer>
    );
}

function Ephemeris() {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(timer);
    }, []);
    const moon = moonPhase(now);
    return (
        <>
            <span>jd {julianDate(now).toFixed(1)}</span>
            <span>
                {moon.name} {Math.round(moon.illumination * 100)}%
            </span>
        </>
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
