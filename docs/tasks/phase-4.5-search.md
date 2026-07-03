# Task: Phase 4.5 — Search (FTS5)

> **Owner:** coder sub-agent (model: sonnet) · **Phase:** 4.5 · **Status:** ready
> **Depends on:** Phases 1–4 complete (tables, repos, and Todos/Notes UI exist to jump into).
> **Read first:** [ARCHITECTURE.md](../../ARCHITECTURE.md) §4 (Full-text search FTS5), §6 (search IPC).

## Goal

Add **full-text search across both tasks and notes** using SQLite **FTS5** external-content
tables kept in sync by triggers, a `searchRepo` that returns bm25-ranked results with snippets,
the `search` IPC channel + store wiring, and a global search UI that groups task/note hits and
jumps to the selected item.

## Scope (sub-tasks)

### 4.5.1 Migration — FTS5 tables + triggers (`src/main/db/migrate.ts`)

Replace the Phase 1 **FTS hook point** with the following (raw DDL — FTS5 is not modeled by the
Drizzle schema builder). Bump `SCHEMA_VERSION` to `2` and guard the new block so existing v1
datasources upgrade in place on next unlock. On upgrade of an already-populated DB, **backfill**
the FTS tables from existing rows (`INSERT INTO <fts>(rowid, ...) SELECT id, ... FROM <base>`).

**DDL contract (authoritative):**

```sql
-- External-content FTS5 tables mirror the base tables (content stays in tasks/notes).
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
```

> Note the external-content `'delete'` command rows — required so the FTS index stays consistent
> on delete/update. Verify `better-sqlite3-multiple-ciphers` is built with FTS5 enabled (it is in
> the standard SQLite amalgamation); if not, report it as a blocker.

### 4.5.2 `searchRepo` (`src/main/db/repositories.ts`)

- `searchRepo(db).query(q: string): SearchResult[]`:
  - Sanitize `q` into a safe FTS match expression (e.g. quote terms / append `*` for prefix); guard
    empty query → `[]`.
  - Query each FTS table with `bm25(<fts>)` rank and `snippet(<fts>, ...)`, join back to the base
    table to hydrate the full `Task`/`Note`, then merge and sort by rank ascending (bm25: lower =
    better). Cap results (e.g. 50).
  - Return `SearchResult[]` per the Phase 2 contract:
    `{ kind: 'task', task, snippet, rank } | { kind: 'note', note, snippet, rank }`.

### 4.5.3 IPC + store

- `src/main/ipc/search.ts` — register `IPC.search.query` via `handle()`, delegate to
  `searchRepo(session.db).query`; reject when locked. (`search.query` already declared in `api.ts`.)
- `store/search.ts` (or fold into a UI hook) — `query`, `results`, `loading`; debounced calls to
  `window.api.search.query`.

### 4.5.4 Global search UI

- A top-bar search input **or** command palette (⌘K) in `AppShell`, opening a results panel that
  **groups hits by kind** (Tasks / Notes) with the snippet, and on select **navigates** to the item
  (Todos with the task focused/opened, or Notes with the note selected in the master–detail).
- Wire the "search" keyboard shortcut placeholder from Phase 5 if building the palette here; keep
  it accessible (focus trap, escape to close, arrow-key navigation).

## Out of scope (do NOT do)

- No fuzzy/typo-tolerant ranking beyond bm25, no search history, no filters-in-search (post-MVP).
- No re-architecting the repos — reuse Phase 1 hydration mapping.

## Acceptance criteria

- [ ] Fresh datasource: FTS tables + triggers created; `user_version = 2`.
- [ ] Existing v1 datasource upgrades on unlock: FTS tables created **and backfilled** from existing
      tasks/notes (search finds pre-existing rows).
- [ ] Creating/editing/deleting a task or note keeps search results consistent (triggers work).
- [ ] `search.query` returns merged, bm25-ranked task+note hits with snippets; empty query → [].
- [ ] Global search UI groups results and jumps to the selected task/note.
- [ ] `npm run lint`/`build` exit 0.

## Verification

```bash
npm run lint && npm run build
npm run dev   # with existing data: open search, query a term present in both a task and a note,
              # confirm grouped results + jump; edit a note's text and confirm search reflects it;
              # delete an item and confirm it drops out of results
```

Also test the **upgrade path**: open a datasource created before this phase and confirm existing
content is searchable (backfill worked). Report all results.

## Report back (to orchestrator)

Files created/edited, criterion mapping, verification (incl. the v1→v2 upgrade/backfill test),
and blockers (especially if FTS5 is not compiled into the native module).
