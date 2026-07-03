/**
 * migrate.ts — idempotent schema bootstrap.
 *
 * Strategy: all DDL uses CREATE TABLE/INDEX IF NOT EXISTS so it is safe to run
 * on every unlock.  The PRAGMA user_version acts as a version guard; when the
 * stored version is already >= SCHEMA_VERSION the function returns immediately.
 *
 * Bumping SCHEMA_VERSION: add an incremental block inside migrate() that runs
 * only when currentVersion < the new version, then update the constant.
 */

import type Database from 'better-sqlite3-multiple-ciphers'

/** Increment this constant whenever the schema changes. */
export const SCHEMA_VERSION = 1

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

  // =========================================================================
  // FTS5 HOOK POINT — Phase 4.5
  // =========================================================================
  // When Phase 4.5 lands, add the following here and bump SCHEMA_VERSION to 2:
  //
  //   CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
  //     title, description,
  //     content='tasks', content_rowid='id'
  //   );
  //   CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  //     title, content,
  //     content='notes', content_rowid='id'
  //   );
  //   -- AFTER INSERT / UPDATE / DELETE triggers on tasks and notes to keep
  //   -- the external-content FTS indexes in sync (standard SQLite pattern).
  //
  // Also add an incremental migration block:
  //   if (currentVersion < 2) { ... create fts tables + triggers ... }
  //   and update SCHEMA_VERSION = 2.
  // =========================================================================

  db.pragma(`user_version = ${SCHEMA_VERSION}`)
}
