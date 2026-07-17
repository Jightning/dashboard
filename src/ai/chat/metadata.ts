import { generateText } from "ai";
import { z } from "zod";
import { createModel, type ProviderId } from "@/ai/providers/registry";
import { appFetch } from "@/ai/providers/appFetch";
import * as sessionsRepo from "@/db/repo/sessions";
import type { Settings } from "@/ai/providers/keys";
import type { ChatSession, Preset } from "@/lib/schemas";

const metaSchema = z.object({
    title: z.string().min(1).max(60),
    tags: z.array(z.string().min(1).max(24)),
    summary: z.string().min(1).max(200),
});
export type SessionMeta = z.infer<typeof metaSchema>;

/** "Research chat" / "New chat" — the names sessions are born with. */
export function isDefaultTitle(title: string, presetName: string): boolean {
    return title === "New chat" || title === `${presetName} chat`;
}

/** Tolerates ```json fences and prose around the object; null when hopeless. */
export function parseMetaJson(raw: string): SessionMeta | null {
    const match = /\{[\s\S]*\}/.exec(raw);
    if (!match) return null;
    try {
        const parsed = metaSchema.parse(JSON.parse(match[0]));
        return { ...parsed, tags: parsed.tags.slice(0, 3) };
    } catch {
        return null;
    }
}

/**
 * Names, tags, and summarizes a session from its first exchange, on the
 * preset's router model (cheap). No-ops unless the title is still a default.
 * Never throws — metadata is decoration, not a dependency.
 */
export async function maybeGenerateSessionMeta(opts: {
    session: ChatSession;
    preset: Preset;
    settings: Settings;
    /** Plain text of the conversation so far (user + assistant turns). */
    texts: string[];
}): Promise<boolean> {
    if (!isDefaultTitle(opts.session.title, opts.preset.name)) return false;
    if (opts.texts.length < 2) return false;
    try {
        const model = createModel(
            {
                provider: opts.preset.provider as ProviderId,
                modelId: opts.preset.router_model ?? opts.preset.model,
            },
            { settings: opts.settings, fetch: appFetch },
        );
        const excerpt = opts.texts.join("\n---\n").slice(0, 4000);
        const result = await generateText({
            model,
            prompt: [
                "Summarize this chat for a session list. Reply with ONLY a JSON object:",
                '{"title": "<max 6 words>", "tags": ["<1-3 lowercase topic tags>"], "summary": "<one sentence>"}',
                "",
                excerpt,
            ].join("\n"),
        });
        const meta = parseMetaJson(result.text);
        if (!meta) return false;
        await sessionsRepo.renameSession(opts.session.id, meta.title);
        await sessionsRepo.setSessionMeta(opts.session.id, {
            summary: meta.summary,
            tags: meta.tags,
        });
        return true;
    } catch (e) {
        console.warn("session metadata generation failed:", e);
        return false;
    }
}
