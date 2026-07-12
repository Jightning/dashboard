import { Meter } from "@/components/ui/meter";
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
            className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground"
            title={`in ${totals.inputTokens.toLocaleString()} · out ${totals.outputTokens.toLocaleString()} · cached ${totals.cachedInputTokens.toLocaleString()}`}
        >
            <span>
                {used.toLocaleString()}
                {budget ? ` / ${budget.toLocaleString()}` : ""} tok
            </span>
            {pct !== null && (
                <Meter
                    pct={pct}
                    segments={16}
                    className="w-24"
                    label="token budget used"
                />
            )}
        </div>
    );
}
