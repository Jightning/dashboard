import type { SessionUsageTotals } from "@/db/repo/messages";

export function TokenMeter({
    totals,
    budget,
}: {
    totals: SessionUsageTotals;
    budget: number | null;
}) {
    const used = totals.inputTokens + totals.outputTokens;
    const pct = budget
        ? Math.min(100, Math.round((used / budget) * 100))
        : null;

    return (
        <div
            className="flex items-center gap-2 text-xs text-muted-foreground"
            title={`in ${totals.inputTokens.toLocaleString()} · out ${totals.outputTokens.toLocaleString()} · cached ${totals.cachedInputTokens.toLocaleString()}`}
        >
            <span>
                {used.toLocaleString()}
                {budget ? ` / ${budget.toLocaleString()}` : ""} tokens
            </span>
            {pct !== null && (
                <span className="h-1.5 w-16 overflow-hidden rounded bg-muted">
                    <span
                        className={
                            pct > 90
                                ? "block h-full bg-destructive"
                                : "block h-full bg-primary"
                        }
                        style={{ width: `${pct}%` }}
                    />
                </span>
            )}
        </div>
    );
}
