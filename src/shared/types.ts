// Placeholder — shared domain types live here (Phase 1+).
// This file proves the @shared alias resolves in both main/preload and renderer.

export type Placeholder = never

// IpcResult discriminated union — used by every IPC handler (Phase 2+)
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }
