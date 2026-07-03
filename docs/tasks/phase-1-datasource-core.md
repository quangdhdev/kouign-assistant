# Task: Phase 1 — Encrypted datasource core

> **Owner:** coder sub-agent (model: sonnet) · **Phase:** 1 · **Status:** ready
> **Depends on:** Phase 0 (scaffold) complete.
> **Read first:** [ARCHITECTURE.md](../../ARCHITECTURE.md) §4 (data model), §5 (encryption);
> [CLAUDE.md](../../CLAUDE.md) core product rules. This spec is the source of scope.

## Goal

Build the **main-process data layer**: open/create/close the SQLCipher-encrypted database,
key it from the user's password, bootstrap the schema with idempotent migrations, expose
repository modules that map rows to shared domain types, and manage the plaintext datasource
config (recent list + app settings) and iCloud path resolution.

This is **backend/main-process only** — no IPC handlers, no preload, no UI. Those are Phase 2.
The code here is imported by Phase 2's IPC handlers.

## Dependencies & setup

1. Add deps: `better-sqlite3-multiple-ciphers`, `drizzle-orm`; dev: `drizzle-kit`.
2. Rebuild the native module against Electron's ABI: ensure `electron-builder install-app-deps`
   runs (postinstall) so `better-sqlite3-multiple-ciphers` loads at runtime.
3. All modules in this phase live under `src/main/` and must be plain Node/TS importable by the
   main process (no renderer imports). Domain **types** live in `src/shared/` (see below).

## Scope (sub-tasks)

### 1.1 Shared domain types (`src/shared/types.ts` — create the subset this phase needs)

Create the enums + row/domain types the repos map to. (Phase 2 extends this file with IPC/session
types; do not add those now — just the domain types below.)

```ts
// src/shared/types.ts  (Phase 1 subset)
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskCategory = 'personal' | 'company'
export type NoteType = 'note' | 'daily' | 'bookmark'

export interface Task {
  id: number
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  category: TaskCategory
  dueDate: string | null      // ISO date yyyy-mm-dd
  jiraUrl: string | null
  slackUrl: string | null
  createdAt: string           // ISO datetime
  updatedAt: string
  completedAt: string | null  // set when status → done
}

export interface Note {
  id: number
  title: string
  content: string             // markdown source
  type: NoteType
  url: string | null          // bookmarks only
  pinned: boolean
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  autoLockMinutes: number     // 0 = never; default 15
  theme: 'light' | 'dark' | 'system'
}

export const DEFAULT_SETTINGS: AppSettings = { autoLockMinutes: 15, theme: 'system' }

// Datasource error codes used across the main process (Phase 2 maps these to messages)
export type DatasourceErrorCode =
  | 'INVALID_PASSWORD'
  | 'ICLOUD_NOT_DOWNLOADED'
  | 'FILE_NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'WEAK_PASSWORD'
  | 'IO_ERROR'
  | 'UNKNOWN'

export class DatasourceError extends Error {
  constructor(public code: DatasourceErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'DatasourceError'
  }
}
```

### 1.2 `src/main/db/connection.ts` — open/key/close

- `openDatabase(path: string, password: string): Database` — opens with
  `better-sqlite3-multiple-ciphers`, then in order:
  - `PRAGMA cipher = 'sqlcipher';`
  - `PRAGMA key = '<password>';` — **escape single quotes** in the password (`'` → `''`).
  - Probe: `SELECT count(*) FROM sqlite_master;` — on failure throw
    `new DatasourceError('INVALID_PASSWORD')` (wrong key surfaces as "file is not a database").
  - `PRAGMA journal_mode = WAL;` and `PRAGMA foreign_keys = ON;` **after** keying.
- `createDatabase(path, password)` — same as open but for a fresh file (file must not already
  exist → else `ALREADY_EXISTS`); after keying, caller runs migrations.
- `closeDatabase(db)` — closes the handle. Keep a single active handle owned by the caller
  (session lifecycle is managed in Phase 2; this module is stateless helpers).
- Never log or persist the password.

### 1.3 `src/main/db/schema.ts` — Drizzle schema

Define `tasks` and `notes` tables **exactly** per ARCHITECTURE §4 (SQLite column types, PK
autoincrement, nullability). `pinned` is INTEGER 0/1. All timestamps TEXT (ISO). Use Drizzle's
sqlite-core. Export the table objects and inferred row types for the repos.

### 1.4 `src/main/db/migrate.ts` — idempotent bootstrap

- `SCHEMA_VERSION = 1` constant.
- `migrate(db)`:
  - Read `PRAGMA user_version`. If already `>= SCHEMA_VERSION`, return.
  - Run idempotent DDL: `CREATE TABLE IF NOT EXISTS tasks (...)`, `... notes (...)`, and the
    indexes `tasks(status)`, `tasks(category)`, `notes(type)`, `notes(pinned)`.
  - Set `PRAGMA user_version = SCHEMA_VERSION`.
- **FTS hook point:** leave a clearly-commented placeholder where Phase 4.5 will add
  `tasks_fts` / `notes_fts` virtual tables + triggers and bump `SCHEMA_VERSION`. Do NOT create
  FTS tables in this phase.

**DDL contract (authoritative):**

```sql
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
```

### 1.5 `src/main/db/repositories.ts` — taskRepo / noteRepo

- `taskRepo(db)`: `list(filter?)`, `create(input)`, `update(id, patch)`, `remove(id)`,
  `toggleStatus(id)` (advance todo→in_progress→done→todo; set/clear `completedAt`).
- `noteRepo(db)`: `list(filter?)`, `create(input)`, `update(id, patch)`, `remove(id)`,
  `togglePin(id)`.
- Every method returns **shared domain types** (`Task`/`Note`), mapping snake_case rows →
  camelCase and INTEGER `pinned` → boolean. Set `createdAt`/`updatedAt` (ISO) in the repo.
- Input DTO shapes are finalized in Phase 3/4 specs; for now expose `create`/`update` accepting a
  partial of the domain type minus server-managed fields. Keep them typed and exported.

### 1.6 `src/main/datasource/config.ts` — recent list + settings

- Plaintext JSON at `app.getPath('userData')/kouign.config.json`. **Never** store secrets or
  content — only datasource paths, labels, and `AppSettings`.
- Shape: `{ recents: DatasourceRef[], settings: AppSettings }` where
  `DatasourceRef = { path: string; label: string; lastOpenedAt: string }`.
  (Add `DatasourceRef` to `shared/types.ts`.)
- Functions: `readConfig()`, `addRecent(ref)`, `removeRecent(path)`, `listRecents()`,
  `getSettings()`, `updateSettings(patch)` → merged with `DEFAULT_SETTINGS`. Tolerate a missing/
  corrupt file by falling back to defaults.

### 1.7 `src/main/datasource/icloud.ts` — iCloud resolver

- `getICloudDriveDir(): string | null` — resolve
  `~/Library/Mobile Documents/com~apple~CloudDocs` if it exists, else null.
- `isICloudPlaceholder(path): boolean` — detect an evicted file, i.e. the sibling
  `.<name>.icloud` placeholder exists / the real file is absent. Used by Phase 2 to reject unlock
  with `ICLOUD_NOT_DOWNLOADED`.
- `defaultDatasourceDir(): string` — iCloud dir if present, else `app.getPath('documents')`.

## Out of scope (do NOT do)

- No IPC handlers, no `ipc/` files, no preload, no renderer/UI (Phase 2).
- No FTS5 tables/triggers/search (Phase 4.5) — only the commented hook point in `migrate.ts`.
- No auto-lock timer logic (Phase 2) — this phase only persists the `autoLockMinutes` setting.
- No keychain / "remember password" (post-MVP).

## Acceptance criteria

- [ ] Deps installed; native module rebuilt for Electron (app can `require` it without ABI error).
- [ ] `openDatabase` with the correct password returns a working handle; wrong password throws
      `DatasourceError('INVALID_PASSWORD')`; the password is never logged/persisted.
- [ ] `createDatabase` on an existing path throws `ALREADY_EXISTS`.
- [ ] `migrate` creates `tasks`/`notes` + indexes, is safe to run repeatedly (idempotent), and sets
      `user_version = 1`. FTS hook point is present and commented, no FTS tables created.
- [ ] `taskRepo`/`noteRepo` CRUD round-trips return correctly-typed domain objects
      (camelCase, boolean `pinned`, ISO timestamps, `completedAt` set/cleared by `toggleStatus`).
- [ ] `config.ts` reads/writes `kouign.config.json` with only paths/labels/settings; corrupt
      file falls back to defaults; `getSettings` merges `DEFAULT_SETTINGS`.
- [ ] `icloud.ts` resolves the iCloud dir when present and detects `.icloud` placeholders.
- [ ] `npm run build` (typecheck) exits 0.

## Verification

A tiny throwaway harness is acceptable to prove the layer works without UI. Example
(run via a temporary script or `electron` main-only bootstrap — **do not commit** the harness):

```bash
npm install
npm run build          # must exit 0 (typecheck)
# manual: open a temp DB, migrate, create a task + note, re-open with wrong password (expect INVALID_PASSWORD)
```

Report the build result and describe the round-trip test you ran (create → read → wrong-password).

## Report back (to orchestrator)

Files created/edited, how each acceptance criterion is met, the round-trip/verification output,
and any blockers (native-module ABI issues, SQLCipher pragma quirks). Note anything Phase 2 must
account for (e.g. the exact `openDatabase`/`createDatabase` signatures the IPC handlers will call).
