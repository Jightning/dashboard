-- Notes: markdown notes with folders (permission scopes) and FTS5 search.
-- Mirrors the documents table's FTS trigger pattern (0001_init.sql).

CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Untitled',
    folder TEXT NOT NULL DEFAULT '/',
    body_md TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX idx_notes_folder ON notes(folder, updated_at);

CREATE VIRTUAL TABLE notes_fts USING fts5(
    title,
    body_md,
    content='notes',
    content_rowid='rowid'
);

CREATE TRIGGER notes_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, title, body_md)
    VALUES (new.rowid, new.title, new.body_md);
END;

CREATE TRIGGER notes_ad AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, body_md)
    VALUES ('delete', old.rowid, old.title, old.body_md);
END;

CREATE TRIGGER notes_au AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, body_md)
    VALUES ('delete', old.rowid, old.title, old.body_md);
    INSERT INTO notes_fts(rowid, title, body_md)
    VALUES (new.rowid, new.title, new.body_md);
END;
