import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { PermissionContext } from "@/ai/tools/context";
import type { AgentDef } from "@/lib/schemas";
import type { AgentRuntime } from "./types";
import { createAgentFromDef } from "./factory";

function def(overrides: Partial<AgentDef>): AgentDef {
    return {
        id: "agt_t",
        name: "Tester",
        description: "d",
        instructions: "You test.",
        tools_json: "[]",
        model: null,
        max_steps: 6,
        color: null,
        is_builtin: 0,
        created_at: 0,
        updated_at: 0,
        ...overrides,
    };
}

function runtime(): AgentRuntime {
    return {
        permissions: new PermissionContext(),
        mainModel: new MockLanguageModelV3({ modelId: "mock-main" }),
        mainModelId: "mock-main",
        routerModel: new MockLanguageModelV3({ modelId: "mock-router" }),
        routerModelId: "mock-router",
        resolveModel: (modelId) => new MockLanguageModelV3({ modelId }),
        fetch: async () => new Response("stub"),
    };
}

describe("createAgentFromDef", () => {
    it("builds an agent on the main model with the selected tools", () => {
        const { agent, modelId } = createAgentFromDef(
            def({ tools_json: '["fetch_url","write_note"]' }),
            runtime(),
        );
        expect(modelId).toBe("mock-main");
        expect(Object.keys(agent.tools).sort()).toEqual([
            "fetch_url",
            "write_note",
        ]);
    });

    it("honors the per-agent model override", () => {
        const { modelId } = createAgentFromDef(
            def({ model: "cheap-model" }),
            runtime(),
        );
        expect(modelId).toBe("cheap-model");
    });

    it("throws on unknown tool names in the definition", () => {
        expect(() =>
            createAgentFromDef(def({ tools_json: '["nope"]' }), runtime()),
        ).toThrow(/unknown tool/);
    });
});
