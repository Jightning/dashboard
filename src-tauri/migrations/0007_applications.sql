-- Internship/job application pipeline with an append-only status history.

CREATE TABLE applications (
    id TEXT PRIMARY KEY,
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    url TEXT,
    status TEXT NOT NULL DEFAULT 'interested'
        CHECK (status IN ('interested', 'applied', 'oa', 'interview', 'offer', 'rejected', 'ghosted')),
    applied_at INTEGER,
    next_action TEXT,
    next_action_at INTEGER,
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX idx_applications_status ON applications(status, updated_at);

CREATE TABLE application_events (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    note TEXT,
    created_at INTEGER NOT NULL
);
