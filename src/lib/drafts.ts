const PREFIX = "hugh.draft.";
export const MAX_DRAFT_CHARS = 8_000;
export const DRAFT_TTL_MS = 14 * 86_400_000;
export const MAX_DRAFTS = 20;

interface DraftEnvelope {
    t: string;
    at: number;
}

function parse(raw: string): DraftEnvelope {
    try {
        const v = JSON.parse(raw) as { t?: unknown; at?: unknown };
        if (typeof v.t === "string" && typeof v.at === "number")
            return { t: v.t, at: v.at };
    } catch {
        // legacy plain-string draft
    }
    return { t: raw, at: Date.now() };
}

/** Draft text for a session; "" when absent/expired. Expired keys are removed. */
export function loadDraft(sessionId: string): string {
    try {
        const raw = localStorage.getItem(PREFIX + sessionId);
        if (!raw) return "";
        const env = parse(raw);
        if (Date.now() - env.at > DRAFT_TTL_MS) {
            localStorage.removeItem(PREFIX + sessionId);
            return "";
        }
        return env.t;
    } catch {
        return "";
    }
}

/** Persist (capped) or clear; prunes the namespace as a side effect. */
export function saveDraft(sessionId: string, text: string): void {
    try {
        const key = PREFIX + sessionId;
        if (!text) {
            localStorage.removeItem(key);
            return;
        }
        localStorage.setItem(
            key,
            JSON.stringify({ t: text.slice(0, MAX_DRAFT_CHARS), at: Date.now() }),
        );
        pruneDrafts();
    } catch {
        // best-effort
    }
}

export function removeDraft(sessionId: string): void {
    try {
        localStorage.removeItem(PREFIX + sessionId);
    } catch {
        // best-effort
    }
}

/** Drop expired drafts and everything beyond the newest MAX_DRAFTS. */
export function pruneDrafts(): void {
    try {
        const entries: { key: string; at: number }[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key?.startsWith(PREFIX)) continue;
            const env = parse(localStorage.getItem(key) ?? "");
            entries.push({ key, at: env.at });
        }
        const now = Date.now();
        const dead = entries.filter((e) => now - e.at > DRAFT_TTL_MS);
        const live = entries
            .filter((e) => now - e.at <= DRAFT_TTL_MS)
            .sort((a, b) => b.at - a.at);
        for (const e of dead) localStorage.removeItem(e.key);
        for (const e of live.slice(MAX_DRAFTS)) localStorage.removeItem(e.key);
    } catch {
        // best-effort
    }
}
