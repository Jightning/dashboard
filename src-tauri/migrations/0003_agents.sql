-- User-defined agents. Builtin rows (knowledge, research) are seeded from TS
-- at bootstrap (like presets) so instructions live in one place.

CREATE TABLE agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    instructions TEXT NOT NULL,
    tools_json TEXT NOT NULL DEFAULT '[]',
    model TEXT,
    max_steps INTEGER NOT NULL DEFAULT 6,
    color TEXT,
    is_builtin INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Presets stored agent enum names; they now store agent row ids.
UPDATE presets SET enabled_agents_json =
    REPLACE(REPLACE(enabled_agents_json, '"knowledge"', '"agt_knowledge"'),
            '"research"', '"agt_research"');
