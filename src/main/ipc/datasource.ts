/**
 * datasource.ts — IPC handlers for datasource lifecycle (list, pick, create, unlock, lock, remove, session).
 */

import { dialog, BrowserWindow } from 'electron'
import type { DatasourceRef, SessionState } from '@shared/types'
import { IPC } from '@shared/ipc'
import { handle } from './result'
import { listRecents, removeRecent } from '../datasource/config'
import { defaultDatasourceDir } from '../datasource/icloud'
import * as session from '../session'

export function registerDatasourceHandlers(): void {
  // List recent datasources
  handle<DatasourceRef[]>(IPC.datasource.list, () => {
    return listRecents()
  })

  // Native open-file dialog → path | null
  handle<string | null>(IPC.datasource.pickExisting, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const opts = {
      title: 'Open Datasource',
      defaultPath: defaultDatasourceDir(),
      filters: [{ name: 'Kouign Datasource', extensions: ['kouigndb'] }],
      properties: ['openFile'] as ('openFile')[],
    }
    const result = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts)
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  // Native save dialog → path | null
  handle<string | null>(IPC.datasource.pickNewLocation, async (event, defaultName) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const name = typeof defaultName === 'string' ? defaultName : 'My Datasource'
    const opts = {
      title: 'Create Datasource',
      defaultPath: `${defaultDatasourceDir()}/${name}.kouigndb`,
      filters: [{ name: 'Kouign Datasource', extensions: ['kouigndb'] }],
    }
    const result = win
      ? await dialog.showSaveDialog(win, opts)
      : await dialog.showSaveDialog(opts)
    return result.canceled ? null : (result.filePath ?? null)
  })

  // Create new datasource (password re-validated in session.create)
  handle<SessionState>(IPC.datasource.create, (_event, input) => {
    const { path, label, password } = input as { path: string; label: string; password: string }
    return session.create({ path, label, password })
  })

  // Unlock existing datasource
  handle<SessionState>(IPC.datasource.unlock, (_event, input) => {
    const { path, password } = input as { path: string; password: string }
    return session.unlock(path, password)
  })

  // Lock
  handle<SessionState>(IPC.datasource.lock, () => {
    return session.lock()
  })

  // Remove from recents
  handle<DatasourceRef[]>(IPC.datasource.remove, (_event, path) => {
    removeRecent(path as string)
    return listRecents()
  })

  // Get current session state
  handle<SessionState>(IPC.datasource.session, () => {
    return session.getState()
  })
}
