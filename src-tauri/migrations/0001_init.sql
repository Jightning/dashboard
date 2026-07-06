-- AI OS core schema. Future dashboard tables (notes, bookmarks, snippets, tasks)
-- arrive in later migrations; see docs/architecture.md for the sketch.

CREATE TABLE permission_levels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_builtin INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE TABLE permission_grants (
    id TEXT PRIMARY KEY,
    level_id TEXT NOT NULL REFERENCES permission_levels(id) ON DELETE CASCADE,
    tool TEXT NOT NULL,
    access TEXT NOT NULL CHECK (access IN ('read', 'write')),
    scope_type TEXT NOT NULL CHECK (scope_type IN ('any', 'doc_folder', 'url_domain')),
    scope_value TEXT
);

CREATE TABLE presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    system_prompt TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    router_model TEXT,
    enabled_agents_json TEXT NOT NULL DEFAULT '[]',
    permission_level_id TEXT REFERENCES permission_levels(id),
    token_budget INTEGER,
    compaction_threshold INTEGER,
    is_builtin INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE chat_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New chat',
    preset_id TEXT REFERENCES presets(id),
    permission_level_id TEXT REFERENCES permission_levels(id),
    compaction_summary TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    parts_json TEXT NOT NULL,
    agent TEXT,
    model TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cached_input_tokens INTEGER,
    compacted INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);

CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    source_name TEXT,
    mime_type TEXT NOT NULL,
    folder TEXT NOT NULL DEFAULT '/',
    content_text TEXT NOT NULL,
    byte_size INTEGER,
    page_count INTEGER,
    created_at INTEGER NOT NULL
);

CREATE VIRTUAL TABLE documents_fts USING fts5(
    title,
    content_text,
    content='documents',
    content_rowid='rowid'
);

CREATE TRIGGER documents_ai AFTER INSERT ON documents BEGIN
    INSERT INTO documents_fts(rowid, title, content_text)
    VALUES (new.rowid, new.title, new.content_text);
END;

CREATE TRIGGER documents_ad AFTER DELETE ON documents BEGIN
    INSERT INTO documents_fts(documents_fts, rowid, title, content_text)
    VALUES ('delete', old.rowid, old.title, old.content_text);
END;

CREATE TRIGGER documents_au AFTER UPDATE ON documents BEGIN
    INSERT INTO documents_fts(documents_fts, rowid, title, content_text)
    VALUES ('delete', old.rowid, old.title, old.content_text);
    INSERT INTO documents_fts(rowid, title, content_text)
    VALUES (new.rowid, new.title, new.content_text);
END;

CREATE TABLE attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT REFERENCES chat_messages(id) ON DELETE CASCADE,
    document_id TEXT REFERENCES documents(id),
    kind TEXT NOT NULL CHECK (kind IN ('image', 'pdf', 'audio')),
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    created_at INTEGER NOT NULL
);