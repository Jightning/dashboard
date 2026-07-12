import { z } from "zod";

/** SQLite stores booleans as 0/1. */
const sqlBool = z.union([z.literal(0), z.literal(1)]);

export const permissionAccessSchema = z.enum(["read", "write"]);
export type PermissionAccess = z.infer<typeof permissionAccessSchema>;

export const scopeTypeSchema = z.enum(["any", "doc_folder", "url_domain"]);
export type ScopeType = z.infer<typeof scopeTypeSchema>;

export const permissionLevelSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    is_builtin: sqlBool,
    created_at: z.number(),
});
export type PermissionLevel = z.infer<typeof permissionLevelSchema>;

export const permissionGrantSchema = z.object({
    id: z.string(),
    level_id: z.string(),
    tool: z.string(),
    access: permissionAccessSchema,
    scope_type: scopeTypeSchema,
    scope_value: z.string().nullable(),
});
export type PermissionGrant = z.infer<typeof permissionGrantSchema>;

export const agentNameSchema = z.enum(["knowledge", "research"]);
export type AgentName = z.infer<typeof agentNameSchema>;

export const presetSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    system_prompt: z.string(),
    provider: z.string(),
    model: z.string(),
    router_model: z.string().nullable(),
    enabled_agents_json: z.string(),
    permission_level_id: z.string().nullable(),
    token_budget: z.number().nullable(),
    compaction_threshold: z.number().nullable(),
    is_builtin: sqlBool,
    created_at: z.number(),
    updated_at: z.number(),
});
export type Preset = z.infer<typeof presetSchema>;

export function presetAgents(preset: Preset): AgentName[] {
    return z
        .array(agentNameSchema)
        .parse(JSON.parse(preset.enabled_agents_json));
}

export const agentDefSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    instructions: z.string(),
    tools_json: z.string(),
    model: z.string().nullable(),
    max_steps: z.number(),
    color: z.string().nullable(),
    is_builtin: sqlBool,
    created_at: z.number(),
    updated_at: z.number(),
});
export type AgentDef = z.infer<typeof agentDefSchema>;

/** Tool names (from the tool catalog) this agent may use. */
export function agentToolNames(def: AgentDef): string[] {
    return z.array(z.string()).parse(JSON.parse(def.tools_json));
}

/** "HN Digest v2" -> "hn_digest_v2" — used for tool names, usage rows, colors. */
export function agentSlug(name: string): string {
    const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    if (!slug) throw new Error(`agent name produces an empty slug: ${name}`);
    return slug;
}

/** The orchestrator-facing delegation tool name for an agent. */
export function delegationToolName(def: AgentDef): string {
    return `ask_${agentSlug(def.name)}_agent`;
}

export const chatSessionSchema = z.object({
    id: z.string(),
    title: z.string(),
    preset_id: z.string().nullable(),
    permission_level_id: z.string().nullable(),
    compaction_summary: z.string().nullable(),
    created_at: z.number(),
    updated_at: z.number(),
});
export type ChatSession = z.infer<typeof chatSessionSchema>;

export const chatMessageSchema = z.object({
    id: z.string(),
    session_id: z.string(),
    role: z.string(),
    parts_json: z.string(),
    agent: z.string().nullable(),
    model: z.string().nullable(),
    input_tokens: z.number().nullable(),
    output_tokens: z.number().nullable(),
    cached_input_tokens: z.number().nullable(),
    compacted: sqlBool,
    created_at: z.number(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const noteSchema = z.object({
    id: z.string(),
    title: z.string(),
    folder: z.string(),
    body_md: z.string(),
    created_at: z.number(),
    updated_at: z.number(),
});
export type Note = z.infer<typeof noteSchema>;
/** Note without its body — for list views. */
export type NoteSummary = Omit<Note, "body_md">;

export const documentSchema = z.object({
    id: z.string(),
    title: z.string(),
    source_name: z.string().nullable(),
    mime_type: z.string(),
    folder: z.string(),
    content_text: z.string(),
    byte_size: z.number().nullable(),
    page_count: z.number().nullable(),
    created_at: z.number(),
});
export type Document = z.infer<typeof documentSchema>;
