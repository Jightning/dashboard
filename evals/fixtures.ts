import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { insertDocument } from "@/db/repo/documents";
import { createSession } from "@/db/repo/sessions";
import { insertMessage } from "@/db/repo/messages";
import { PermissionContext } from "@/ai/tools/context";
import type { AgentRuntime } from "@/ai/agents/types";
import type { LanguageModel } from "ai";

/** Facts planted in fixture documents; retrieval evals assert these surface. */
export const PLANTED_FACTS = {
    thermo: "the Carnot efficiency limit for the lab engine is 61 percent",
    ece: "lab kits are due back on May 9th at the EE building front desk",
    secret: "the private diary passphrase is zebra-cactus-42",
} as const;

export async function seedEvalDb() {
    const db = createTestDbClient();
    setDb(db);
    await insertDocument({
        title: "Thermodynamics lecture 12",
        contentText: `Heat engines and reversibility. Key result: ${PLANTED_FACTS.thermo}. Remember the derivation uses reservoir temperatures.`,
        mimeType: "text/plain",
        folder: "/school/thermo",
    });
    await insertDocument({
        title: "ECE 362 logistics",
        contentText: `Course logistics. Important: ${PLANTED_FACTS.ece}. Late returns lose 10% of the lab grade.`,
        mimeType: "text/plain",
        folder: "/school/ece",
    });
    await insertDocument({
        title: "Personal diary index",
        contentText: `Private. ${PLANTED_FACTS.secret}. Do not share.`,
        mimeType: "text/plain",
        folder: "/personal",
    });
    return db;
}

export function makeEvalRuntime(opts: {
    main: LanguageModel;
    router: LanguageModel;
    grants?: AgentRuntime["permissions"]["levelGrants"];
    autoRespond?: "deny" | "allow-once";
}): AgentRuntime & { asked: string[] } {
    const permissions = new PermissionContext();
    permissions.levelGrants = opts.grants ?? [];
    const asked: string[] = [];
    if (opts.autoRespond) {
        permissions.broker.subscribe((pending) => {
            for (const req of pending) {
                asked.push(req.tool);
                permissions.broker.respond(req.id, opts.autoRespond!);
            }
        });
    }
    return {
        permissions,
        mainModel: opts.main,
        mainModelId: "eval-main",
        routerModel: opts.router,
        routerModelId: "eval-router",
        resolveModel: () => opts.main,
        fetch: globalThis.fetch,
        asked,
    };
}

/** A long fake conversation with facts that must survive compaction. */
export const COMPACTION_FACTS = [
    "the project deadline is March 14",
    "the API key budget is 40 dollars",
    "the professor's name is Dr. Alvarez",
];

export async function seedLongConversation(): Promise<string> {
    const session = await createSession({});
    const filler =
        "We discussed various unrelated topics including weather, lunch options, and campus parking. ";
    for (let i = 0; i < 30; i++) {
        const fact = COMPACTION_FACTS[i % 10 === 3 ? (i / 10) | 0 : -1] ?? "";
        await insertMessage({
            sessionId: session.id,
            role: i % 2 === 0 ? "user" : "assistant",
            partsJson: JSON.stringify([
                {
                    type: "text",
                    text: `Turn ${i}. ${fact ? `Note: ${fact}.` : ""} ${filler.repeat(3)}`,
                },
            ]),
        });
    }
    return session.id;
}
