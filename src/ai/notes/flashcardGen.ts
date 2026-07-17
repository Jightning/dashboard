import { generateText, stepCountIs } from "ai";
import { createModel, type ProviderId } from "@/ai/providers/registry";
import { appFetch } from "@/ai/providers/appFetch";
import { buildToolSet } from "@/ai/tools/catalog";
import type { PermissionContext } from "@/ai/tools/context";
import type { Settings } from "@/ai/providers/keys";
import type { Note } from "@/lib/schemas";

/**
 * One-shot agent call: read the note, emit create_flashcards tool calls.
 * The write goes through the permission gate like every other tool — the
 * caller renders ApprovalCards for the broker it passed in.
 * Returns how many create_flashcards calls executed.
 */
export async function generateFlashcardsFromNote(opts: {
    note: Note;
    settings: Settings;
    permissions: PermissionContext;
}): Promise<number> {
    const model = createModel(
        {
            provider: opts.settings.defaultProvider as ProviderId,
            modelId: opts.settings.defaultModel,
        },
        { settings: opts.settings, fetch: appFetch },
    );
    const tools = buildToolSet(["create_flashcards"], {
        permissions: opts.permissions,
        fetch: appFetch,
    });
    const result = await generateText({
        model,
        tools,
        stopWhen: stepCountIs(3),
        prompt: [
            "Create concise spaced-repetition flashcards from this note using",
            `the create_flashcards tool with folder "${opts.note.folder}".`,
            "Cover each distinct fact once; fronts are questions, backs are",
            "short answers. 3-10 cards depending on density. Do not answer in",
            "prose — only call the tool.",
            "",
            `# ${opts.note.title}`,
            opts.note.body_md,
        ].join("\n"),
    });
    return result.steps.flatMap((s) => s.toolCalls).length;
}
