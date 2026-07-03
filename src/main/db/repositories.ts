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
import type { Task, Note, TaskStatus, TaskPriority, TaskCategory, NoteType, CreateTaskInput, UpdateTaskInput, TaskFilter } from '@shared/types'

// ---------------------------------------------------------------------------
// Raw DB row shapes (snake_case, matching SQLite columns exactly)
// ---------------------------------------------------------------------------

interface RawTaskRow {
  id: number
  title: string
  description: string | null
  status: string
  priority: string
  category: string
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
  created_at: string
  updated_at: string
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
    category:    row.category as TaskCategory,
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
    id:        row.id,
    title:     row.title,
    content:   row.content,
    type:      row.type as NoteType,
    url:       row.url,
    pinned:    row.pinned === 1,    // INTEGER → boolean
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
     * Ordered newest-first (created_at DESC).
     */
    list(filter?: TaskFilter): Task[] {
      const conditions: string[] = []
      const params: string[] = []

      if (filter?.status !== undefined) {
        conditions.push('status = ?')
        params.push(filter.status)
      }
      if (filter?.category !== undefined) {
        conditions.push('category = ?')
        params.push(filter.category)
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
          (title, description, status, priority, category,
           due_date, jira_url, slack_url, created_at, updated_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `).run(
        input.title,
        input.description ?? null,
        input.status    ?? 'todo',
        input.priority  ?? 'medium',
        input.category  ?? 'personal',
        input.dueDate   ?? null,
        input.jiraUrl   ?? null,
        input.slackUrl  ?? null,
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
      if (patch.category    !== undefined) { sets.push('category = ?');    params.push(patch.category) }
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

export type NoteFilter = {
  type?: NoteType
  pinned?: boolean
}

/**
 * Fields the caller supplies when creating a note.
 * Server-managed fields (id, createdAt, updatedAt) are excluded.
 */
export type CreateNoteInput = {
  title: string
  content?: string
  type?: NoteType
  url?: string | null
  pinned?: boolean
}

/**
 * Fields the caller may patch when updating a note.
 * id and timestamp fields cannot be set by the caller.
 */
export type UpdateNoteInput = Partial<{
  title: string
  content: string
  type: NoteType
  url: string | null
  pinned: boolean
}>

export function noteRepo(db: Database.Database) {
  return {
    /**
     * Lists all notes, optionally filtered by type and/or pinned status.
     * Pinned notes sort first, then newest-first within each group.
     */
    list(filter?: NoteFilter): Note[] {
      const conditions: string[] = []
      const params: (string | number)[] = []

      if (filter?.type !== undefined) {
        conditions.push('type = ?')
        params.push(filter.type)
      }
      if (filter?.pinned !== undefined) {
        conditions.push('pinned = ?')
        params.push(filter.pinned ? 1 : 0)
      }

      const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
      const sql = `SELECT * FROM notes${where} ORDER BY pinned DESC, created_at DESC`
      const rows = db.prepare(sql).all(...params) as RawNoteRow[]
      return rows.map(mapNote)
    },

    /** Inserts a new note and returns the persisted domain object. */
    create(input: CreateNoteInput): Note {
      const ts = now()
      const result = db.prepare(`
        INSERT INTO notes
          (title, content, type, url, pinned, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.title,
        input.content ?? '',
        input.type    ?? 'note',
        input.url     ?? null,
        input.pinned  ? 1 : 0,
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

      if (patch.title   !== undefined) { sets.push('title = ?');   params.push(patch.title) }
      if (patch.content !== undefined) { sets.push('content = ?'); params.push(patch.content) }
      if (patch.type    !== undefined) { sets.push('type = ?');    params.push(patch.type) }
      if (patch.url     !== undefined) { sets.push('url = ?');     params.push(patch.url ?? null) }
      if (patch.pinned  !== undefined) { sets.push('pinned = ?');  params.push(patch.pinned ? 1 : 0) }

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
