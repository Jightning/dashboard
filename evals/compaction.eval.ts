import { evalite } from "evalite";
import { maybeCompact } from "@/ai/context/compaction";
import { getSession } from "@/db/repo/sessions";
import { createSummarizer } from "@/ai/agents/runtime";
import { getEvalModels } from "./models";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { COMPACTION_FACTS, seedLongConversation } from "./fixtures";
import { containsAll } from "./scorers";

/**
 * Compaction fidelity: after summarizing a 30-turn conversation with the router
 * model, the planted facts must survive in the stored summary.
 */
const models = getEvalModels();
const run = models ? evalite : evalite.skip;

run<string, string, string[]>("Compaction summary keeps key facts", {
    data: () => [
        {
            input: "30-turn conversation with planted facts",
            expected: ["March 14", "40", "Alvarez"],
        },
    ],
    task: async () => {
        setDb(createTestDbClient());
        if (!models) throw new Error("unreachable");
        const sessionId = await seedLongConversation();
        const result = await maybeCompact({
            sessionId,
            thresholdTokens: 100, // force compaction
            summarize: createSummarizer(models.router),
        });
        if (!result.compacted) throw new Error("compaction did not trigger");
        const session = await getSession(sessionId);
        return session.compaction_summary ?? "";
    },
    scorers: [containsAll],
});

void COMPACTION_FACTS;
