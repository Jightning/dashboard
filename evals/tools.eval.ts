import { evalite } from "evalite";
import { createKnowledgeAgent } from "@/ai/agents/knowledge";
import { getEvalModels } from "./models";
import { makeEvalRuntime, seedEvalDb, PLANTED_FACTS } from "./fixtures";
import { containsAll } from "./scorers";

/**
 * Retrieval quality: the knowledge agent must search the fixture documents and
 * surface the planted facts in its answer.
 */
const models = getEvalModels();
const run = models ? evalite : evalite.skip;

run<string, string, string[]>("Knowledge agent retrieves planted facts", {
    data: () => [
        {
            input: "What is the Carnot efficiency limit for the lab engine according to my notes?",
            expected: ["61"],
        },
        {
            input: "When and where do I return my ECE lab kits?",
            expected: ["May 9", "front desk"],
        },
        {
            input: "What happens if I return the lab kit late?",
            expected: ["10%"],
        },
    ],
    task: async (input) => {
        await seedEvalDb();
        if (!models) throw new Error("unreachable");
        const runtime = makeEvalRuntime({
            main: models.main,
            router: models.router,
            grants: [
                {
                    tool: "search_documents",
                    access: "read",
                    scopeType: "any",
                    scopeValue: null,
                },
                {
                    tool: "read_document",
                    access: "read",
                    scopeType: "any",
                    scopeValue: null,
                },
                {
                    tool: "list_documents",
                    access: "read",
                    scopeType: "any",
                    scopeValue: null,
                },
            ],
        });
        const agent = createKnowledgeAgent(runtime);
        const result = await agent.generate({ prompt: input });
        return result.text;
    },
    scorers: [containsAll],
});

// Keep the secret fact referenced so fixture drift breaks the build, not the eval.
void PLANTED_FACTS.secret;