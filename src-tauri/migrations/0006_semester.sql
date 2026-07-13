-- Semester backbone: courses (whose folder doubles as a permission scope),
-- tasks with simple recurrence, and calendar events (ICS class schedule).

CREATE TABLE courses (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    term TEXT NOT NULL,
    folder TEXT NOT NULL,
    color TEXT,
    created_at INTEGER NOT NULL
);

CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    notes TEXT,
    course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
    due_at INTEGER,
    recurrence TEXT CHECK (recurrence IN ('daily', 'weekly', 'monthly')),
    completed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX idx_tasks_open ON tasks(completed_at, due_at);

CREATE TABLE events (
    id TEXT PRIMARY KEY,
    course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    location TEXT,
    starts_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT 'ics',
    created_at INTEGER NOT NULL
);
CREATE INDEX idx_events_start ON events(starts_at);
