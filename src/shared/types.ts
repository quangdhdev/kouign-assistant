// Shared domain types — single source of truth across main / preload / renderer.

// ---------------------------------------------------------------------------
// Utility types (Phase 0 + Phase 2+)
// ---------------------------------------------------------------------------

/** Placeholder kept so @shared/types can be imported before Phase 1 types are used. */
export type Placeholder = never

/** Discriminated union returned by every IPC handler (Phase 2+). */
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// ---------------------------------------------------------------------------
// Domain enums (Phase 1)
// ---------------------------------------------------------------------------

export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskCategory = 'personal' | 'company'
export type NoteType = 'note' | 'daily' | 'bookmark'

// ---------------------------------------------------------------------------
// Domain entities (Phase 1)
// ---------------------------------------------------------------------------

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
  updatedAt: string           // ISO datetime
  completedAt: string | null  // set when status → done, cleared otherwise
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

// ---------------------------------------------------------------------------
// App settings (Phase 1)
// ---------------------------------------------------------------------------

export interface AppSettings {
  autoLockMinutes: number     // 0 = never; default 15
  theme: 'light' | 'dark' | 'system'
}

export const DEFAULT_SETTINGS: AppSettings = { autoLockMinutes: 15, theme: 'system' }

// ---------------------------------------------------------------------------
// Datasource config (Phase 1)
// ---------------------------------------------------------------------------

/** One entry in the recent-datasources list (stored in plaintext config). */
export interface DatasourceRef {
  path: string
  label: string
  lastOpenedAt: string  // ISO datetime
}

// ---------------------------------------------------------------------------
// Datasource error (Phase 1 — used throughout main process; Phase 2 maps to user messages)
// ---------------------------------------------------------------------------

export type DatasourceErrorCode =
  | 'INVALID_PASSWORD'
  | 'ICLOUD_NOT_DOWNLOADED'
  | 'FILE_NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'WEAK_PASSWORD'
  | 'IO_ERROR'
  | 'UNKNOWN'

export class DatasourceError extends Error {
  constructor(
    public readonly code: DatasourceErrorCode,
    message?: string
  ) {
    super(message ?? code)
    this.name = 'DatasourceError'
  }
}
