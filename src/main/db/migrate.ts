/**
 * migrate.ts — idempotent schema bootstrap.
 *
 * Strategy: all DDL uses CREATE TABLE/INDEX IF NOT EXISTS so it is safe to run
 * on every unlock.  The PRAGMA user_version acts as a version guard; when the
 * stored version is already >= SCHEMA_VERSION the function returns immediately.
 *
 * Bumping SCHEMA_VERSION: add an incremental `if (currentVersion < N)` block
 * inside migrate() that runs only when needed, then update the constant.
 */

import type Database from 'better-sqlite3-multiple-ciphers'

/** Increment this constant whenever the schema changes. */
export const SCHEMA_VERSION = 2

/**
 * Bootstraps (or verifies) the database schema.
 * Idempotent — safe to call every time a datasource is opened.
 *
 * @param db - An open, keyed Database handle.
 */
export function migrate(db: Database.Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number
  if (currentVersion >= SCHEMA_VERSION) return

  // -------------------------------------------------------------------------
  // Version 1 — initial schema
  // -------------------------------------------------------------------------

  if (currentVersion < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        title        TEXT    NOT NULL,
        description  TEXT,
        status       TEXT    NOT NULL DEFAULT 'todo',
        priority     TEXT    NOT NULL DEFAULT 'medium',
        category     TEXT    NOT NULL DEFAULT 'personal',
        due_date     TEXT,
        jira_url     TEXT,
        slack_url    TEXT,
        created_at   TEXT    NOT NULL,
        updated_at   TEXT    NOT NULL,
        completed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_status   ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);

      CREATE TABLE IF NOT EXISTS notes (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT    NOT NULL,
        content     TEXT    NOT NULL DEFAULT '',
        type        TEXT    NOT NULL DEFAULT 'note',
        url         TEXT,
        pinned      INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT    NOT NULL,
        updated_at  TEXT    NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_notes_type   ON notes(type);
      CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(pinned);
    `)
  }

  // -------------------------------------------------------------------------
  // Version 2 — FTS5 external-content tables + triggers
  //
  // External-content tables store only the search index; the actual text
  // lives in tasks/notes.  Triggers keep the FTS index in sync with the base
  // tables on INSERT / UPDATE / DELETE.
  //
  // The 'delete' command row is required for UPDATE and DELETE so the old
  // document is removed from the FTS index before the new one is added.
  //
  // On a v1 → v2 upgrade (existing data in tasks/notes) we backfill the FTS
  // tables via INSERT … SELECT from the base tables.  For a fresh database at
  // version 0 the base tables are empty so the same INSERT … SELECT is a no-op.
  // -------------------------------------------------------------------------

  if (currentVersion < 2) {
    db.exec(`
      -- External-content FTS5 tables mirror the base tables.
      CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
        title, description,
        content='tasks', content_rowid='id'
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        title, content,
        content='notes', content_rowid='id'
      );

      -- Keep tasks_fts in sync.
      CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks BEGIN
        INSERT INTO tasks_fts(rowid, title, description) VALUES (new.id, new.title, new.description);
      END;
      CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks BEGIN
        INSERT INTO tasks_fts(tasks_fts, rowid, title, description) VALUES ('delete', old.id, old.title, old.description);
      END;
      CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE ON tasks BEGIN
        INSERT INTO tasks_fts(tasks_fts, rowid, title, description) VALUES ('delete', old.id, old.title, old.description);
        INSERT INTO tasks_fts(rowid, title, description) VALUES (new.id, new.title, new.description);
      END;

      -- Keep notes_fts in sync.
      CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
      END;
      CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES ('delete', old.id, old.title, old.content);
      END;
      CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES ('delete', old.id, old.title, old.content);
        INSERT INTO notes_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
      END;
    `)

    // Backfill existing rows into FTS tables.
    // Safe for fresh DBs (inserts 0 rows) and correct for v1 → v2 upgrades.
    db.exec(`
      INSERT INTO tasks_fts(rowid, title, description)
        SELECT id, title, description FROM tasks;
      INSERT INTO notes_fts(rowid, title, content)
        SELECT id, title, content FROM notes;
    `)
  }

  db.pragma(`user_version = ${SCHEMA_VERSION}`)
}
