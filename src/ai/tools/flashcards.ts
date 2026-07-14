import { tool } from "ai";
import { z } from "zod";
import { createFlashcards } from "@/db/repo/flashcards";
import { normalizeFolder } from "@/db/repo/documents";
import type { PermissionContext, ScopeResolver } from "./context";

const createInput = z.object({
    folder: z
        .string()
        .describe("Course folder for the cards, e.g. /school/ece437"),
    cards: z
        .array(
            z.object({
                front: z.string().describe("Question / prompt side"),
                back: z.string().describe("Answer side — concise"),
            }),
        )
        .min(1)
        .max(50)
        .describe("The flashcards to create"),
});

export const flashcardScopeResolvers: Record<string, ScopeResolver> = {
    create_flashcards: (input) => ({
        access: "write",
        scopeType: "doc_folder",
        scopeValue: normalizeFolder(
            (input as z.infer<typeof createInput>).folder,
        ),
    }),
};

export function createFlashcardTools(permissions: PermissionContext) {
    return {
        create_flashcards: tool({
            description:
                "Create spaced-repetition flashcards from study material. Make fronts specific questions, backs short answers. File under the course folder.",
            inputSchema: createInput,
            execute: permissions.gated(
                "create_flashcards",
                flashcardScopeResolvers.create_flashcards!,
                async (input: z.infer<typeof createInput>) => ({
                    created: await createFlashcards(input.cards, {
                        folder: input.folder,
                    }),
                }),
            ),
        }),
    };
}
