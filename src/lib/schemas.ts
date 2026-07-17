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

export const categorySchema = z.object({
    id: z.string(),
    name: z.string(),
    color: z.string().nullable(),
    created_at: z.number(),
    updated_at: z.number(),
});
export type Category = z.infer<typeof categorySchema>;

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

/** Agent ids (rows in the agents table) enabled by a preset. */
export function presetAgents(preset: Preset): string[] {
    return z.array(z.string()).parse(JSON.parse(preset.enabled_agents_json));
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

/** Model-generated tags on a chat session; [] when malformed or unset. */
export function sessionTags(session: ChatSession): string[] {
    try {
        return z.array(z.string()).parse(JSON.parse(session.auto_tags_json));
    } catch {
        return [];
    }
}

export const chatSessionSchema = z.object({
    id: z.string(),
    title: z.string(),
    preset_id: z.string().nullable(),
    permission_level_id: z.string().nullable(),
    project_id: z.string().nullable(),
    category_id: z.string().nullable(),
    color: z.string().nullable(),
    compaction_summary: z.string().nullable(),
    auto_summary: z.string().nullable(),
    auto_tags_json: z.string(),
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
    category_id: z.string().nullable(),
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
    project_id: z.string().nullable(),
    created_at: z.number(),
});
export type Document = z.infer<typeof documentSchema>;

export const pipelineSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    created_at: z.number(),
    updated_at: z.number(),
});
export type Pipeline = z.infer<typeof pipelineSchema>;

export const pipelineStepSchema = z.object({
    id: z.string(),
    pipeline_id: z.string(),
    position: z.number(),
    agent_id: z.string(),
    prompt_template: z.string(),
});
export type PipelineStep = z.infer<typeof pipelineStepSchema>;

export const runStatusSchema = z.enum(["running", "success", "error"]);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const pipelineRunSchema = z.object({
    id: z.string(),
    pipeline_id: z.string(),
    automation_id: z.string().nullable(),
    status: runStatusSchema,
    input: z.string(),
    error: z.string().nullable(),
    started_at: z.number(),
    finished_at: z.number().nullable(),
});
export type PipelineRun = z.infer<typeof pipelineRunSchema>;

export const pipelineStepRunSchema = z.object({
    id: z.string(),
    run_id: z.string(),
    position: z.number(),
    agent_id: z.string(),
    prompt: z.string(),
    output: z.string().nullable(),
    status: runStatusSchema,
    error: z.string().nullable(),
    started_at: z.number(),
    finished_at: z.number().nullable(),
});
export type PipelineStepRun = z.infer<typeof pipelineStepRunSchema>;

export const scheduleKindSchema = z.enum(["interval", "daily", "weekly"]);
export type ScheduleKind = z.infer<typeof scheduleKindSchema>;

export const automationSchema = z.object({
    id: z.string(),
    name: z.string(),
    pipeline_id: z.string(),
    schedule_kind: scheduleKindSchema,
    interval_minutes: z.number().nullable(),
    time_of_day: z.string().nullable(),
    day_of_week: z.number().nullable(),
    input_template: z.string(),
    permission_level_id: z.string().nullable(),
    output_note_folder: z.string().nullable(),
    enabled: sqlBool,
    next_run_at: z.number().nullable(),
    last_run_at: z.number().nullable(),
    project_id: z.string().nullable(),
    created_at: z.number(),
    updated_at: z.number(),
});
export type Automation = z.infer<typeof automationSchema>;

export const courseSchema = z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    term: z.string(),
    folder: z.string(),
    color: z.string().nullable(),
    category_id: z.string().nullable(),
    created_at: z.number(),
});
export type Course = z.infer<typeof courseSchema>;

export const recurrenceSchema = z.enum(["daily", "weekly", "monthly"]);

export const taskSchema = z.object({
    id: z.string(),
    title: z.string(),
    notes: z.string().nullable(),
    course_id: z.string().nullable(),
    category_id: z.string().nullable(),
    due_at: z.number().nullable(),
    recurrence: recurrenceSchema.nullable(),
    completed_at: z.number().nullable(),
    created_at: z.number(),
    updated_at: z.number(),
});
export type Task = z.infer<typeof taskSchema>;

export const eventSchema = z.object({
    id: z.string(),
    course_id: z.string().nullable(),
    title: z.string(),
    location: z.string().nullable(),
    starts_at: z.number(),
    ends_at: z.number(),
    source: z.string(),
    created_at: z.number(),
});
export type CalendarEvent = z.infer<typeof eventSchema>;

export const applicationStatusSchema = z.enum([
    "interested",
    "applied",
    "oa",
    "interview",
    "offer",
    "rejected",
    "ghosted",
]);
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

export const applicationSchema = z.object({
    id: z.string(),
    company: z.string(),
    role: z.string(),
    url: z.string().nullable(),
    status: applicationStatusSchema,
    applied_at: z.number().nullable(),
    next_action: z.string().nullable(),
    next_action_at: z.number().nullable(),
    notes: z.string().nullable(),
    created_at: z.number(),
    updated_at: z.number(),
});
export type Application = z.infer<typeof applicationSchema>;

export const applicationEventSchema = z.object({
    id: z.string(),
    application_id: z.string(),
    status: z.string(),
    note: z.string().nullable(),
    created_at: z.number(),
});
export type ApplicationEvent = z.infer<typeof applicationEventSchema>;

export const flashcardSchema = z.object({
    id: z.string(),
    folder: z.string(),
    front: z.string(),
    back: z.string(),
    source_note_id: z.string().nullable(),
    ease: z.number(),
    interval_days: z.number(),
    reps: z.number(),
    due_at: z.number(),
    suspended: sqlBool,
    created_at: z.number(),
    updated_at: z.number(),
});
export type Flashcard = z.infer<typeof flashcardSchema>;

export const bookmarkSchema = z.object({
    id: z.string(),
    title: z.string(),
    url: z.string(),
    group_name: z.string(),
    project_id: z.string().nullable(),
    created_at: z.number(),
});
export type Bookmark = z.infer<typeof bookmarkSchema>;

export const snippetSchema = z.object({
    id: z.string(),
    title: z.string(),
    body: z.string(),
    group_name: z.string(),
    created_at: z.number(),
    updated_at: z.number(),
});
export type Snippet = z.infer<typeof snippetSchema>;

export const projectSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    color: z.string().nullable(),
    category_id: z.string().nullable(),
    created_at: z.number(),
    updated_at: z.number(),
});
export type Project = z.infer<typeof projectSchema>;
