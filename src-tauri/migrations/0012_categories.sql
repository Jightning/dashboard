-- Categories: the universal tag every section filters by. Projects, tasks,
-- notes, chats, and courses point at this table directly; bookmarks,
-- snippets, and documents inherit a category through their project.

CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

ALTER TABLE projects ADD COLUMN category_id TEXT REFERENCES categories(id);
ALTER TABLE tasks ADD COLUMN category_id TEXT REFERENCES categories(id);
ALTER TABLE notes ADD COLUMN category_id TEXT REFERENCES categories(id);
ALTER TABLE chat_sessions ADD COLUMN category_id TEXT REFERENCES categories(id);
ALTER TABLE courses ADD COLUMN category_id TEXT REFERENCES categories(id);

-- Chat metadata the router model generates after an exchange; search and
-- filtering read these.
ALTER TABLE chat_sessions ADD COLUMN auto_summary TEXT;
ALTER TABLE chat_sessions ADD COLUMN auto_tags_json TEXT NOT NULL DEFAULT '[]';

-- Full-text search over chat message text. Standalone (no content= sync):
-- parts_json is a JSON array, so the messages repo extracts text parts in TS
-- and writes rows itself — SQL triggers can't do that portably.
CREATE VIRTUAL TABLE messages_fts USING fts5(
    message_id UNINDEXED,
    session_id UNINDEXED,
    content
);

-- Courses were the old task category. Give every course a same-named
-- category and move task assignment over, so existing data survives the
-- tasks UI switching from courses to categories.
INSERT OR IGNORE INTO categories (id, name, color, created_at, updated_at)
    SELECT 'cat_' || lower(hex(randomblob(12))), code, color, created_at, created_at
    FROM courses;
UPDATE courses SET category_id =
    (SELECT id FROM categories WHERE categories.name = courses.code);
UPDATE tasks SET category_id =
    (SELECT category_id FROM courses WHERE courses.id = tasks.course_id)
    WHERE course_id IS NOT NULL;
