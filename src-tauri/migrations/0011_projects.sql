-- Projects group chats, files (documents), bookmarks, and automations.
-- Also: per-chat custom color, snippet groups for category filtering.

CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

ALTER TABLE chat_sessions ADD COLUMN project_id TEXT REFERENCES projects(id);
ALTER TABLE chat_sessions ADD COLUMN color TEXT;
ALTER TABLE documents ADD COLUMN project_id TEXT REFERENCES projects(id);
ALTER TABLE bookmarks ADD COLUMN project_id TEXT REFERENCES projects(id);
ALTER TABLE automations ADD COLUMN project_id TEXT REFERENCES projects(id);
ALTER TABLE snippets ADD COLUMN group_name TEXT NOT NULL DEFAULT 'General';
