-- The first migration: the notes table and one seed row (small starter
-- data is just INSERTs in a migration).
CREATE TABLE notes (
  id    INTEGER PRIMARY KEY,
  body  TEXT NOT NULL,
  score REAL,
  done  INTEGER NOT NULL DEFAULT 0
);
INSERT INTO notes (body, score) VALUES ('seed', 1.5);
