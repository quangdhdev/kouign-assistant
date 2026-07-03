/**
 * settings.ts — IPC handlers for AppSettings (get / update).
 */

import type { AppSettings } from '@shared/types'
import { IPC } from '@shared/ipc'
import { handle } from './result'
import { getSettings, updateSettings } from '../datasource/config'
import { rearmTimer } from '../session'

export function registerSettingsHandlers(): void {
  handle<AppSettings>(IPC.settings.get, () => {
    return getSettings()
  })

  handle<AppSettings>(IPC.settings.update, (_event, patch) => {
    const updated = updateSettings(patch as Partial<AppSettings>)
    // Re-arm idle timer when autoLockMinutes changes
    if ((patch as Partial<AppSettings>).autoLockMinutes !== undefined) {
      rearmTimer(updated.autoLockMinutes)
    }
    return updated
  })
}
