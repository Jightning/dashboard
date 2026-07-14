-- Spaced-repetition cards. folder ties a card to a course's permission scope.

CREATE TABLE flashcards (
    id TEXT PRIMARY KEY,
    folder TEXT NOT NULL DEFAULT '/',
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    source_note_id TEXT,
    ease REAL NOT NULL DEFAULT 2.5,
    interval_days REAL NOT NULL DEFAULT 0,
    reps INTEGER NOT NULL DEFAULT 0,
    due_at INTEGER NOT NULL,
    suspended INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX idx_flashcards_due ON flashcards(suspended, due_at);
