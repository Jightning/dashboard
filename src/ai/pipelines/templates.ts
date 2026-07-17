import { BUILTIN_AGENT_IDS } from "@/db/repo/agents";
import { createPipeline, setPipelineSteps } from "@/db/repo/pipelines";
import type { Pipeline } from "@/lib/schemas";

export interface PipelineTemplate {
    name: string;
    description: string;
    /** Suggested run input, shown as the input placeholder after creation. */
    exampleInput: string;
    steps: { agentId: string; promptTemplate: string }[];
}

/**
 * Starter pipelines on the builtin agents only — instantiating one must
 * never depend on user-created agents. Users edit them like any pipeline.
 */
export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
    {
        name: "Morning brief",
        description: "Search today's news on a topic and distill a 5-bullet brief.",
        exampleInput: "AI hardware",
        steps: [
            {
                agentId: BUILTIN_AGENT_IDS.research,
                promptTemplate:
                    "Search the web for the latest news about {{input}} (today is {{date}}). Read the two most substantial results and report the concrete developments with their source URLs.",
            },
            {
                agentId: BUILTIN_AGENT_IDS.planner,
                promptTemplate:
                    "Condense this into a 5-bullet morning brief. Each bullet: one development, why it matters, source URL.\n\n{{prev}}",
            },
        ],
    },
    {
        name: "Page watch",
        description: "Fetch a page and summarize what actually matters on it.",
        exampleInput: "https://news.ycombinator.com",
        steps: [
            {
                agentId: BUILTIN_AGENT_IDS.research,
                promptTemplate:
                    "Fetch {{input}} and summarize the most noteworthy items for an engineer — skip fluff, keep links.",
            },
        ],
    },
    {
        name: "Job scout",
        description: "Search openings, then cross-check against applications you already track.",
        exampleInput: "embedded software internship summer 2027",
        steps: [
            {
                agentId: BUILTIN_AGENT_IDS.research,
                promptTemplate:
                    "Search the web for current job postings matching: {{input}}. List company, role, location, and posting URL for up to 8 real openings.",
            },
            {
                agentId: BUILTIN_AGENT_IDS.planner,
                promptTemplate:
                    "Compare these openings against my tracked applications (list_applications). Which are new? Recommend the top 3 to apply to and why.\n\n{{step1}}",
            },
        ],
    },
    {
        name: "Study sheet",
        description: "Pull everything you have on a topic into one revision sheet.",
        exampleInput: "pipelined CPU hazards",
        steps: [
            {
                agentId: BUILTIN_AGENT_IDS.knowledge,
                promptTemplate:
                    "Search my documents and notes for everything about {{input}}. Quote the key definitions, formulas, and examples you find, citing which note/document each came from.",
            },
            {
                agentId: BUILTIN_AGENT_IDS.planner,
                promptTemplate:
                    "Turn this into a one-page revision sheet: core concepts first, then worked examples, then a self-quiz of 5 questions.\n\n{{prev}}",
            },
        ],
    },
];

export async function instantiateTemplate(t: PipelineTemplate): Promise<Pipeline> {
    const pipeline = await createPipeline({ name: t.name, description: t.description });
    await setPipelineSteps(
        pipeline.id,
        t.steps.map((s) => ({
            agentId: s.agentId,
            promptTemplate: s.promptTemplate,
        })),
    );
    return pipeline;
}
