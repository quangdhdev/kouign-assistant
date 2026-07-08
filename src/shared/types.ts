// Shared domain types — single source of truth across main / preload / renderer.

// ---------------------------------------------------------------------------
// Utility types
// ---------------------------------------------------------------------------

/** Placeholder kept so @shared/types can be imported before Phase 1 types are used. */
export type Placeholder = never

/** Discriminated union returned by every IPC handler — handlers never throw across the boundary. */
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

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

export interface AiSettings {
  enabled: boolean   // default false — opt-in
  baseUrl: string    // default 'http://localhost:11434'
  model: string      // default '' — user must pick after Test connection
}

export interface AppSettings {
  autoLockMinutes: number     // 0 = never; default 15
  theme: 'light' | 'dark' | 'system'
  ai: AiSettings
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoLockMinutes: 15,
  theme: 'system',
  ai: { enabled: false, baseUrl: 'http://localhost:11434', model: '' },
}

// ---------------------------------------------------------------------------
// AI (local Ollama) — foundation IPC DTOs
// ---------------------------------------------------------------------------

/** Result of probing the configured Ollama server. Never thrown — always returned as data. */
export interface AiStatus {
  reachable: boolean
  models: string[]
  error?: string
}

export interface AiGenerateInput {
  prompt: string
  system?: string
  model?: string   // defaults to settings.ai.model when omitted
}

export interface AiGenerateResult {
  text: string
  model: string
}

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

// ---------------------------------------------------------------------------
// Session state (Phase 2)
// ---------------------------------------------------------------------------

export interface SessionState {
  unlocked: boolean
  datasource: { path: string; label: string } | null
}

// ---------------------------------------------------------------------------
// Task input DTOs (Phase 3 — single source of truth; repositories.ts imports from here)
// ---------------------------------------------------------------------------

export interface CreateTaskInput {
  title: string
  description?: string | null
  status?: TaskStatus         // default 'todo'
  priority?: TaskPriority     // default 'medium'
  category?: TaskCategory     // default 'personal'
  dueDate?: string | null
  jiraUrl?: string | null
  slackUrl?: string | null
}

export type UpdateTaskInput = Partial<CreateTaskInput>

export interface TaskFilter {
  category?: TaskCategory
  status?: TaskStatus
}

// ---------------------------------------------------------------------------
// Note input DTOs (Phase 4 — single source of truth; repositories.ts imports from here)
// ---------------------------------------------------------------------------

export interface CreateNoteInput {
  title: string
  content?: string           // markdown source, default ''
  type?: NoteType            // default 'note'
  url?: string | null        // bookmarks
  pinned?: boolean           // default false
}

export type UpdateNoteInput = Partial<CreateNoteInput>

export interface NoteFilter { type?: NoteType }

// ---------------------------------------------------------------------------
// Search (Phase 2 declaration, Phase 4.5 implementation)
// ---------------------------------------------------------------------------

export type SearchResult =
  | { kind: 'task'; task: Task; snippet: string; rank: number }
  | { kind: 'note'; note: Note; snippet: string; rank: number }
