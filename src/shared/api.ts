// src/shared/api.ts — shape of window.api exposed by preload. Every method resolves IpcResult<T>.
import type { Task, Note, DatasourceRef, SessionState, SearchResult, AppSettings, IpcResult, CreateTaskInput, UpdateTaskInput, TaskFilter, CreateNoteInput, UpdateNoteInput, NoteFilter, AiStatus, AiGenerateInput, AiGenerateResult, Category, CreateCategoryInput, UpdateCategoryInput } from './types'

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
  notes: {
    list(filter?: NoteFilter): Promise<IpcResult<Note[]>>
    create(input: CreateNoteInput): Promise<IpcResult<Note>>
    update(id: number, patch: UpdateNoteInput): Promise<IpcResult<Note>>
    remove(id: number): Promise<IpcResult<number>>       // returns removed id
    togglePin(id: number): Promise<IpcResult<Note>>
  }
  categories: {
    list(): Promise<IpcResult<Category[]>>
    create(input: CreateCategoryInput): Promise<IpcResult<Category>>
    update(id: number, patch: UpdateCategoryInput): Promise<IpcResult<Category>>
    remove(id: number): Promise<IpcResult<number>>   // returns removed id; referencing tasks/notes become uncategorized
  }
  search: { query(q: string): Promise<IpcResult<SearchResult[]>> }
  settings: {
    get(): Promise<IpcResult<AppSettings>>
    update(patch: Partial<AppSettings>): Promise<IpcResult<AppSettings>>
  }
  ai: {
    status(): Promise<IpcResult<AiStatus>>          // probes the configured Ollama baseUrl
    listModels(): Promise<IpcResult<string[]>>
    generate(input: AiGenerateInput): Promise<IpcResult<AiGenerateResult>>
  }
  shell: { openExternal(url: string): Promise<IpcResult<boolean>> }
  onSessionChanged(cb: (s: SessionState) => void): () => void  // returns unsubscribe
  pingActivity(): void
}

// Re-export for convenience
export type { Task, Note, DatasourceRef, SessionState, SearchResult, AppSettings, IpcResult, CreateTaskInput, UpdateTaskInput, TaskFilter, CreateNoteInput, UpdateNoteInput, NoteFilter, AiStatus, AiGenerateInput, AiGenerateResult, Category, CreateCategoryInput, UpdateCategoryInput }
