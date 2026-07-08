/**
 * repositories.ts — taskRepo / noteRepo
 *
 * Each factory function takes an open Database handle and returns a repository
 * object.  All methods return shared domain types (Task / Note) with:
 *   - camelCase keys        (snake_case DB columns mapped explicitly)
 *   - boolean pinned        (INTEGER 0/1 converted here)
 *   - ISO timestamps        (set/updated by the repo, never the caller)
 *   - completedAt           (set when status → done, cleared otherwise)
 *
 * Input types are exposed as exported aliases so Phase 2 IPC handlers can
 * import them without re-declaring.
 */

import type Database from 'better-sqlite3-multiple-ciphers'
import type { Task, Note, TaskStatus, TaskPriority, NoteType, CreateTaskInput, UpdateTaskInput, TaskFilter, CreateNoteInput, UpdateNoteInput, NoteFilter, SearchResult, Category, CategoryColor, CreateCategoryInput, UpdateCategoryInput } from '@shared/types'

// ---------------------------------------------------------------------------
// Raw DB row shapes (snake_case, matching SQLite columns exactly)
// ---------------------------------------------------------------------------

interface RawTaskRow {
  id: number
  title: string
  description: string | null
  status: string
  priority: string
  category_id: number | null
  due_date: string | null
  jira_url: string | null
  slack_url: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

interface RawNoteRow {
  id: number
  title: string
  content: string
  type: string
  url: string | null
  pinned: number          // 0 | 1
  category_id: number | null
  created_at: string
  updated_at: string
}

interface RawCategoryRow {
  id: number
  name: string
  color: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Mappers: DB rows → shared domain types
// ---------------------------------------------------------------------------

function mapTask(row: RawTaskRow): Task {
  return {
    id:          row.id,
    title:       row.title,
    description: row.description,
    status:      row.status as TaskStatus,
    priority:    row.priority as TaskPriority,
    categoryId:  row.category_id ?? null,
    dueDate:     row.due_date,
    jiraUrl:     row.jira_url,
    slackUrl:    row.slack_url,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
    completedAt: row.completed_at,
  }
}

function mapNote(row: RawNoteRow): Note {
  return {
    id:         row.id,
    title:      row.title,
    content:    row.content,
    type:       row.type as NoteType,
    url:        row.url,
    pinned:     row.pinned === 1,    // INTEGER → boolean
    categoryId: row.category_id ?? null,
    createdAt:  row.created_at,
    updatedAt:  row.updated_at,
  }
}

function mapCategory(row: RawCategoryRow): Category {
  return {
    id:        row.id,
    name:      row.name,
    color:     row.color as CategoryColor | null,
    createdAt: row.created_at,
  }
}

/** Returns the current time as an ISO 8601 datetime string. */
function now(): string {
  return new Date().toISOString()
}

// ---------------------------------------------------------------------------
// Task repository
// ---------------------------------------------------------------------------
// CreateTaskInput / UpdateTaskInput / TaskFilter are defined in @shared/types and
// imported above — no local re-declaration needed.

/** Status cycle: todo → in_progress → done → todo */
const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo:        'in_progress',
  in_progress: 'done',
  done:        'todo',
}

export function taskRepo(db: Database.Database) {
  return {
    /**
     * Lists all tasks, optionally filtered by status and/or category.
     * `categoryId: null` filters to uncategorized tasks; `undefined` means no filter.
     * Ordered newest-first (created_at DESC).
     */
    list(filter?: TaskFilter): Task[] {
      const conditions: string[] = []
      const params: (string | number)[] = []

      if (filter?.status !== undefined) {
        conditions.push('status = ?')
        params.push(filter.status)
      }
      if (filter?.categoryId !== undefined) {
        if (filter.categoryId === null) {
          conditions.push('category_id IS NULL')
        } else {
          conditions.push('category_id = ?')
          params.push(filter.categoryId)
        }
      }

      const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
      const sql = `SELECT * FROM tasks${where} ORDER BY created_at DESC`
      const rows = db.prepare(sql).all(...params) as RawTaskRow[]
      return rows.map(mapTask)
    },

    /** Inserts a new task and returns the persisted domain object. */
    create(input: CreateTaskInput): Task {
      const ts = now()
      const result = db.prepare(`
        INSERT INTO tasks
          (title, description, status, priority, category_id,
           due_date, jira_url, slack_url, created_at, updated_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `).run(
        input.title,
        input.description ?? null,
        input.status     ?? 'todo',
        input.priority   ?? 'medium',
        input.categoryId ?? null,
        input.dueDate    ?? null,
        input.jiraUrl    ?? null,
        input.slackUrl   ?? null,
        ts,
        ts
      )
      return mapTask(
        db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid) as RawTaskRow
      )
    },

    /**
     * Applies a partial patch to a task and returns the updated domain object.
     * Always bumps updated_at.
     */
    update(id: number, patch: UpdateTaskInput): Task {
      const sets: string[] = ['updated_at = ?']
      const params: (string | number | null)[] = [now()]

      if (patch.title       !== undefined) { sets.push('title = ?');       params.push(patch.title) }
      if (patch.description !== undefined) { sets.push('description = ?'); params.push(patch.description ?? null) }
      if (patch.status      !== undefined) { sets.push('status = ?');      params.push(patch.status) }
      if (patch.priority    !== undefined) { sets.push('priority = ?');    params.push(patch.priority) }
      if (patch.categoryId  !== undefined) { sets.push('category_id = ?'); params.push(patch.categoryId) }
      if (patch.dueDate     !== undefined) { sets.push('due_date = ?');    params.push(patch.dueDate ?? null) }
      if (patch.jiraUrl     !== undefined) { sets.push('jira_url = ?');    params.push(patch.jiraUrl ?? null) }
      if (patch.slackUrl    !== undefined) { sets.push('slack_url = ?');   params.push(patch.slackUrl ?? null) }

      params.push(id)
      db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params)
      return mapTask(
        db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as RawTaskRow
      )
    },

    /** Deletes a task by ID. */
    remove(id: number): void {
      db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
    },

    /**
     * Advances the task status in a fixed cycle: todo → in_progress → done → todo.
     * Sets completedAt when transitioning to 'done'; clears it otherwise.
     */
    toggleStatus(id: number): Task {
      const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as RawTaskRow | undefined
      if (!row) throw new Error(`Task ${id} not found`)

      const ts = now()
      const nextStatus = NEXT_STATUS[row.status as TaskStatus] ?? 'todo'
      const completedAt: string | null = nextStatus === 'done' ? ts : null

      db.prepare(
        'UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?'
      ).run(nextStatus, completedAt, ts, id)

      return mapTask(
        db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as RawTaskRow
      )
    },
  }
}

// ---------------------------------------------------------------------------
// Note repository
// ---------------------------------------------------------------------------
// CreateNoteInput / UpdateNoteInput / NoteFilter are defined in @shared/types and
// imported above — no local re-declaration needed.

export function noteRepo(db: Database.Database) {
  return {
    /**
     * Lists all notes, optionally filtered by type, category, and/or pinned status.
     * `categoryId: null` filters to uncategorized notes; `undefined` means no filter.
     * Pinned notes sort first, then newest-first within each group.
     */
    list(filter?: NoteFilter): Note[] {
      const conditions: string[] = []
      const params: (string | number)[] = []

      if (filter?.type !== undefined) {
        conditions.push('type = ?')
        params.push(filter.type)
      }
      if (filter?.categoryId !== undefined) {
        if (filter.categoryId === null) {
          conditions.push('category_id IS NULL')
        } else {
          conditions.push('category_id = ?')
          params.push(filter.categoryId)
        }
      }

      const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
      const sql = `SELECT * FROM notes${where} ORDER BY pinned DESC, updated_at DESC`
      const rows = db.prepare(sql).all(...params) as RawNoteRow[]
      return rows.map(mapNote)
    },

    /** Inserts a new note and returns the persisted domain object. */
    create(input: CreateNoteInput): Note {
      const ts = now()
      const result = db.prepare(`
        INSERT INTO notes
          (title, content, type, url, pinned, category_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.title,
        input.content    ?? '',
        input.type       ?? 'note',
        input.url        ?? null,
        input.pinned     ? 1 : 0,
        input.categoryId ?? null,
        ts,
        ts
      )
      return mapNote(
        db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid) as RawNoteRow
      )
    },

    /**
     * Applies a partial patch to a note and returns the updated domain object.
     * Always bumps updated_at.
     */
    update(id: number, patch: UpdateNoteInput): Note {
      const sets: string[] = ['updated_at = ?']
      const params: (string | number | null)[] = [now()]

      if (patch.title      !== undefined) { sets.push('title = ?');       params.push(patch.title) }
      if (patch.content    !== undefined) { sets.push('content = ?');     params.push(patch.content) }
      if (patch.type       !== undefined) { sets.push('type = ?');        params.push(patch.type) }
      if (patch.url        !== undefined) { sets.push('url = ?');         params.push(patch.url ?? null) }
      if (patch.pinned     !== undefined) { sets.push('pinned = ?');      params.push(patch.pinned ? 1 : 0) }
      if (patch.categoryId !== undefined) { sets.push('category_id = ?'); params.push(patch.categoryId) }

      params.push(id)
      db.prepare(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`).run(...params)
      return mapNote(
        db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as RawNoteRow
      )
    },

    /** Deletes a note by ID. */
    remove(id: number): void {
      db.prepare('DELETE FROM notes WHERE id = ?').run(id)
    },

    /** Toggles the pinned flag and returns the updated domain object. */
    togglePin(id: number): Note {
      const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as RawNoteRow | undefined
      if (!row) throw new Error(`Note ${id} not found`)

      const ts = now()
      const newPinned = row.pinned === 0 ? 1 : 0

      db.prepare(
        'UPDATE notes SET pinned = ?, updated_at = ? WHERE id = ?'
      ).run(newPinned, ts, id)

      return mapNote(
        db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as RawNoteRow
      )
    },
  }
}

// ---------------------------------------------------------------------------
// Category repository — user-managed, shared by tasks & notes
// ---------------------------------------------------------------------------
// CreateCategoryInput / UpdateCategoryInput are defined in @shared/types and
// imported above — no local re-declaration needed.

/** True when the SQLite error is a UNIQUE constraint violation (duplicate name). */
function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed/.test(err.message)
}

export function categoryRepo(db: Database.Database) {
  return {
    /** Lists all categories, ordered by name ascending. */
    list(): Category[] {
      const rows = db.prepare('SELECT * FROM categories ORDER BY name ASC').all() as RawCategoryRow[]
      return rows.map(mapCategory)
    },

    /** Inserts a new category and returns the persisted domain object. */
    create(input: CreateCategoryInput): Category {
      const ts = now()
      let result
      try {
        result = db.prepare(
          'INSERT INTO categories (name, color, created_at) VALUES (?, ?, ?)'
        ).run(input.name, input.color ?? null, ts)
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          throw new Error(`A category named '${input.name}' already exists.`)
        }
        throw err
      }
      return mapCategory(
        db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid) as RawCategoryRow
      )
    },

    /** Applies a partial patch (rename / recolor) and returns the updated domain object. */
    update(id: number, patch: UpdateCategoryInput): Category {
      const sets: string[] = []
      const params: (string | null)[] = []

      if (patch.name  !== undefined) { sets.push('name = ?');  params.push(patch.name) }
      if (patch.color !== undefined) { sets.push('color = ?'); params.push(patch.color ?? null) }

      if (sets.length > 0) {
        try {
          db.prepare(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`).run(...params, id)
        } catch (err) {
          if (isUniqueConstraintError(err)) {
            throw new Error(`A category named '${patch.name}' already exists.`)
          }
          throw err
        }
      }

      return mapCategory(
        db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as RawCategoryRow
      )
    },

    /**
     * Deletes a category. Tasks/notes referencing it are nulled out first
     * (become uncategorized) so no orphaned category_id remains.
     */
    remove(id: number): void {
      db.prepare('UPDATE tasks SET category_id = NULL WHERE category_id = ?').run(id)
      db.prepare('UPDATE notes SET category_id = NULL WHERE category_id = ?').run(id)
      db.prepare('DELETE FROM categories WHERE id = ?').run(id)
    },
  }
}

// ---------------------------------------------------------------------------
// Search repository (FTS5)
// ---------------------------------------------------------------------------

/** Raw row returned by a tasks_fts join query. */
interface RawTaskSearchRow extends RawTaskRow {
  snippet: string
  rank: number
}

/** Raw row returned by a notes_fts join query. */
interface RawNoteSearchRow extends RawNoteRow {
  snippet: string
  rank: number
}

/**
 * Builds a safe FTS5 MATCH expression from user input.
 *
 * Each whitespace-separated token is double-quoted (escaping any embedded
 * double-quotes) and suffixed with * for prefix matching.  Multiple tokens
 * are space-joined (FTS5 treats them as implicit AND).
 *
 * Example: 'hello "world"' → '"hello"* """world"""*'
 */
function buildMatchExpr(q: string): string {
  return q
    .trim()
    .split(/\s+/)
    .filter(t => t.length > 0)
    .map(t => `"${t.replace(/"/g, '""')}"*`)
    .join(' ')
}

const MAX_RESULTS = 50
const SNIPPET_TOKENS = 16

export function searchRepo(db: Database.Database) {
  return {
    /**
     * Full-text search across tasks and notes.
     * Returns merged, bm25-ranked SearchResult[] (lower rank = better match).
     * Empty or whitespace-only query returns [].
     */
    query(q: string): SearchResult[] {
      if (!q.trim()) return []

      const matchExpr = buildMatchExpr(q)

      // --- tasks ---
      const taskRows = db.prepare(`
        SELECT
          t.id, t.title, t.description, t.status, t.priority, t.category_id,
          t.due_date, t.jira_url, t.slack_url, t.created_at, t.updated_at, t.completed_at,
          snippet(tasks_fts, -1, '<mark>', '</mark>', '…', ${SNIPPET_TOKENS}) AS snippet,
          bm25(tasks_fts) AS rank
        FROM tasks_fts
        JOIN tasks t ON t.id = tasks_fts.rowid
        WHERE tasks_fts MATCH ?
        ORDER BY rank
        LIMIT ${MAX_RESULTS}
      `).all(matchExpr) as RawTaskSearchRow[]

      // --- notes ---
      const noteRows = db.prepare(`
        SELECT
          n.id, n.title, n.content, n.type, n.url, n.pinned, n.category_id, n.created_at, n.updated_at,
          snippet(notes_fts, -1, '<mark>', '</mark>', '…', ${SNIPPET_TOKENS}) AS snippet,
          bm25(notes_fts) AS rank
        FROM notes_fts
        JOIN notes n ON n.id = notes_fts.rowid
        WHERE notes_fts MATCH ?
        ORDER BY rank
        LIMIT ${MAX_RESULTS}
      `).all(matchExpr) as RawNoteSearchRow[]

      // Merge, sort by bm25 rank ascending (lower = better), cap total.
      const taskResults: SearchResult[] = taskRows.map(row => ({
        kind: 'task' as const,
        task: mapTask(row),
        snippet: row.snippet,
        rank: row.rank,
      }))

      const noteResults: SearchResult[] = noteRows.map(row => ({
        kind: 'note' as const,
        note: mapNote(row),
        snippet: row.snippet,
        rank: row.rank,
      }))

      return [...taskResults, ...noteResults]
        .sort((a, b) => a.rank - b.rank)
        .slice(0, MAX_RESULTS)
    },
  }
}
