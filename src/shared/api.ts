// src/shared/api.ts — shape of window.api exposed by preload. Every method resolves IpcResult<T>.
import type { Task, Note, DatasourceRef, SessionState, SearchResult, AppSettings, IpcResult } from './types'

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
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  tasks: { /* Phase 3 fills signatures; namespace declared now */ }
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
export type { Task, Note, DatasourceRef, SessionState, SearchResult, AppSettings, IpcResult }
