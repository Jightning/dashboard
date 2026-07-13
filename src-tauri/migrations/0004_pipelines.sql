-- Pipelines: ordered agent steps + persisted run history.
-- automation_id is plain TEXT (no FK): automations arrive in migration 0005.

CREATE TABLE pipelines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE pipeline_steps (
    id TEXT PRIMARY KEY,
    pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    agent_id TEXT NOT NULL REFERENCES agents(id),
    prompt_template TEXT NOT NULL
);
CREATE INDEX idx_pipeline_steps ON pipeline_steps(pipeline_id, position);

CREATE TABLE pipeline_runs (
    id TEXT PRIMARY KEY,
    pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    automation_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'error')),
    input TEXT NOT NULL DEFAULT '',
    error TEXT,
    started_at INTEGER NOT NULL,
    finished_at INTEGER
);
CREATE INDEX idx_pipeline_runs ON pipeline_runs(pipeline_id, started_at);

CREATE TABLE pipeline_step_runs (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    agent_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    output TEXT,
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'error')),
    error TEXT,
    started_at INTEGER NOT NULL,
    finished_at INTEGER
);
CREATE INDEX idx_pipeline_step_runs ON pipeline_step_runs(run_id, position);
