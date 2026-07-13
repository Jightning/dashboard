-- Scheduled pipeline runs. The scheduler only fires while the app is open
-- (no server process by design); an overdue automation fires once on launch.

CREATE TABLE automations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    schedule_kind TEXT NOT NULL CHECK (schedule_kind IN ('interval', 'daily', 'weekly')),
    interval_minutes INTEGER,
    time_of_day TEXT,
    day_of_week INTEGER,
    input_template TEXT NOT NULL DEFAULT '',
    permission_level_id TEXT REFERENCES permission_levels(id),
    output_note_folder TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    next_run_at INTEGER,
    last_run_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
