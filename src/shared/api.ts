// src/shared/api.ts — shape of window.api exposed by preload. Every method resolves IpcResult<T>.
import type { Task, Note, DatasourceRef, SessionState, SearchResult, AppSettings, IpcResult, CreateTaskInput, UpdateTaskInput, TaskFilter } from './types'

export interface KouignApi {
  datasource: {
    list(): Promise<IpcResult<DatasourceRef[]>>
    pickExisting(): Promise<IpcResult<string | null>>
    pickNewLocation(defaultName: string): Promise<IpcResult<string | null>>
    create(input: { path: string; label: string; password: string }): Promise<IpcResult<SessionState>>
    unlock(input: { path: string; password: string }): Promise<IpcResult<SessionState>>
    lock(): Promise<IpcResult<SessionState>>
    remove(path: string): Promise<IpcResult<DatasourceRef[]>>
    session(): Promise<IpcResult<SessionState>>
  }
  tasks: {
    list(filter?: TaskFilter): Promise<IpcResult<Task[]>>
    create(input: CreateTaskInput): Promise<IpcResult<Task>>
    update(id: number, patch: UpdateTaskInput): Promise<IpcResult<Task>>
    remove(id: number): Promise<IpcResult<number>>        // returns removed id
    toggleStatus(id: number): Promise<IpcResult<Task>>   // advances todo→in_progress→done→todo
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  notes: { /* Phase 4 fills signatures; namespace declared now */ }
  search: { query(q: string): Promise<IpcResult<SearchResult[]>> }
  settings: {
    get(): Promise<IpcResult<AppSettings>>
    update(patch: Partial<AppSettings>): Promise<IpcResult<AppSettings>>
  }
  shell: { openExternal(url: string): Promise<IpcResult<boolean>> }
  onSessionChanged(cb: (s: SessionState) => void): () => void  // returns unsubscribe
  pingActivity(): void
}

// Re-export for convenience
export type { Task, Note, DatasourceRef, SessionState, SearchResult, AppSettings, IpcResult, CreateTaskInput, UpdateTaskInput, TaskFilter }
