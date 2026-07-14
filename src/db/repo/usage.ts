import { getDb } from "../client";

export interface DailyUsage {
    day: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
}

/** Token spend per day/model — makes free-tier headroom visible. */
export async function usageByDay(days = 14): Promise<DailyUsage[]> {
    const since = Date.now() - days * 86_400_000;
    return getDb().select<DailyUsage>(
        `SELECT date(created_at / 1000, 'unixepoch') AS day,
                COALESCE(model, 'unknown') AS model,
                SUM(COALESCE(input_tokens, 0)) AS inputTokens,
                SUM(COALESCE(output_tokens, 0)) AS outputTokens
         FROM chat_messages
         WHERE created_at >= ? AND (input_tokens IS NOT NULL OR output_tokens IS NOT NULL)
         GROUP BY day, model
         ORDER BY day DESC`,
        [since],
    );
}
