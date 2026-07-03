/**
 * result.ts — IPC handler wrapper that ensures every channel returns IpcResult<T>.
 *
 * Use handle() instead of ipcMain.handle() directly. It catches all throws and
 * maps them to { ok: false, error } so no unhandled rejection ever crosses the
 * IPC boundary.
 */

import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import type { IpcResult } from '@shared/types'
import { DatasourceError } from '@shared/types'

/** Human-readable messages for each DatasourceErrorCode (renderer-facing copy). */
export function errorMessage(code: string): string {
  switch (code) {
    case 'INVALID_PASSWORD':       return 'Incorrect password.'
    case 'ICLOUD_NOT_DOWNLOADED':  return 'This datasource is in iCloud and hasn\'t downloaded yet.'
    case 'WEAK_PASSWORD':          return 'Password must be at least 8 characters.'
    case 'ALREADY_EXISTS':         return 'A datasource already exists at that location.'
    case 'FILE_NOT_FOUND':         return 'Datasource file not found.'
    case 'IO_ERROR':               return 'A file I/O error occurred.'
    default:                       return 'An unexpected error occurred.'
  }
}

/**
 * Registers an ipcMain handler that always resolves to IpcResult<T>.
 * - On success: { ok: true, data: T }
 * - On DatasourceError: { ok: false, error: { code, message } } using the code passthrough
 * - On unknown error: { ok: false, error: { code: 'UNKNOWN', message } }
 */
export function handle<T>(
  channel: string,
  fn: (event: IpcMainInvokeEvent, ...args: unknown[]) => T | Promise<T>
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      const data = await fn(event, ...args)
      return { ok: true, data } satisfies IpcResult<T>
    } catch (err) {
      if (err instanceof DatasourceError) {
        return {
          ok: false,
          error: { code: err.code, message: errorMessage(err.code) }
        } satisfies IpcResult<T>
      }
      const message = err instanceof Error ? err.message : String(err)
      return {
        ok: false,
        error: { code: 'UNKNOWN', message: errorMessage('UNKNOWN') + (message ? ` (${message})` : '') }
      } satisfies IpcResult<T>
    }
  })
}
