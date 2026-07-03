/**
 * shell.ts — shell.openExternal with allowlist (http / https / slack only).
 */

import { shell } from 'electron'
import { IPC } from '@shared/ipc'
import { handle } from './result'
import { ipcMain } from 'electron'
import { pingActivity } from '../session'

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'slack:'])

export function registerShellHandlers(): void {
  handle<boolean>(IPC.shell.openExternal, async (_event, url) => {
    const u = url as string
    let protocol: string
    try {
      protocol = new URL(u).protocol
    } catch {
      return false
    }
    if (!ALLOWED_PROTOCOLS.has(protocol)) return false
    await shell.openExternal(u)
    return true
  })

  // Activity ping — fire-and-forget, no result wrapper needed
  ipcMain.on(IPC.activity.ping, () => {
    pingActivity()
  })
}
