/**
 * session.ts — single in-memory DB handle + session lifecycle.
 *
 * Owns the open Database handle, the current DatasourceRef, and the auto-lock
 * idle timer. Nothing here touches the filesystem except through the db/ modules.
 *
 * Security: the password is never stored; only the open handle lives in memory.
 */

import { BrowserWindow } from 'electron'
import type Database from 'better-sqlite3-multiple-ciphers'
import type { SessionState, DatasourceRef } from '@shared/types'
import { DatasourceError } from '@shared/types'
import { IPC } from '@shared/ipc'
import { openDatabase, createDatabase, closeDatabase } from './db/connection'
import { migrate } from './db/migrate'
import { addRecent, getSettings } from './datasource/config'
import { isICloudPlaceholder } from './datasource/icloud'

// ---------------------------------------------------------------------------
// State (module-level singletons)
// ---------------------------------------------------------------------------

let _db: Database.Database | null = null
let _ref: DatasourceRef | null = null
let _lockTimer: ReturnType<typeof setTimeout> | null = null

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function broadcastSessionChanged(): void {
  const state = getState()
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.events.sessionChanged, state)
    }
  })
}

function clearTimer(): void {
  if (_lockTimer !== null) {
    clearTimeout(_lockTimer)
    _lockTimer = null
  }
}

function armTimer(minutes: number): void {
  clearTimer()
  if (minutes <= 0) return
  _lockTimer = setTimeout(() => {
    lock()
  }, minutes * 60 * 1000)
}

function startIdleTimer(): void {
  const settings = getSettings()
  armTimer(settings.autoLockMinutes)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns the current session state (safe to expose to renderer). */
export function getState(): SessionState {
  return {
    unlocked: _db !== null,
    datasource: _ref ? { path: _ref.path, label: _ref.label } : null,
  }
}

/** Returns the open DB handle if unlocked, null otherwise. */
export function getDb(): Database.Database | null {
  return _db
}

/**
 * Opens an existing encrypted datasource.
 * Guards against iCloud placeholders, keys the DB, migrates, adds to recents.
 */
export function unlock(path: string, password: string): SessionState {
  // Guard iCloud placeholder
  if (isICloudPlaceholder(path)) {
    throw new DatasourceError('ICLOUD_NOT_DOWNLOADED')
  }

  // Close any existing session first
  if (_db) {
    closeDatabase(_db)
    _db = null
    _ref = null
  }

  const db = openDatabase(path, password)
  migrate(db)

  const ref: DatasourceRef = {
    path,
    label: path.split('/').pop()?.replace(/\.kouigndb$/, '') ?? path,
    lastOpenedAt: new Date().toISOString(),
  }

  addRecent(ref)

  _db = db
  _ref = ref

  startIdleTimer()
  broadcastSessionChanged()

  return getState()
}

/**
 * Creates a brand-new encrypted datasource.
 * Re-validates password policy (min 8 chars) before delegating to db layer.
 */
export function create(input: { path: string; label: string; password: string }): SessionState {
  if (input.password.length < 8) {
    throw new DatasourceError('WEAK_PASSWORD')
  }

  // Guard iCloud placeholder (shouldn't exist yet, but guard anyway)
  if (isICloudPlaceholder(input.path)) {
    throw new DatasourceError('ICLOUD_NOT_DOWNLOADED')
  }

  // Close any existing session first
  if (_db) {
    closeDatabase(_db)
    _db = null
    _ref = null
  }

  const db = createDatabase(input.path, input.password)
  migrate(db)

  const ref: DatasourceRef = {
    path: input.path,
    label: input.label,
    lastOpenedAt: new Date().toISOString(),
  }

  addRecent(ref)

  _db = db
  _ref = ref

  startIdleTimer()
  broadcastSessionChanged()

  return getState()
}

/** Closes the DB handle and returns to a locked state. */
export function lock(): SessionState {
  clearTimer()
  if (_db) {
    closeDatabase(_db)
    _db = null
  }
  _ref = null

  broadcastSessionChanged()

  return getState()
}

/**
 * Resets the idle timer — called when the renderer reports activity.
 * No-op when the session is locked.
 */
export function pingActivity(): void {
  if (_db === null) return
  const settings = getSettings()
  armTimer(settings.autoLockMinutes)
}

/**
 * Re-arms (or disarms) the idle timer when autoLockMinutes changes.
 * Called by the settings IPC handler after persisting the new value.
 */
export function rearmTimer(minutes: number): void {
  if (_db === null) return
  armTimer(minutes)
}
