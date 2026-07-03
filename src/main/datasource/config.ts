/**
 * config.ts — plaintext app config: recent datasource list + AppSettings.
 *
 * Stored at: <userData>/kouign.config.json
 *
 * Security note: this file NEVER contains passwords, encryption keys, or any
 * database content.  It holds only file paths, labels, and display settings.
 *
 * A missing or corrupt file is treated as an empty defaults config so the app
 * always starts cleanly on first run.
 */

import { app } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import type { DatasourceRef, AppSettings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'

// ---------------------------------------------------------------------------
// Internal config shape
// ---------------------------------------------------------------------------

interface Config {
  recents: DatasourceRef[]
  settings: AppSettings
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getConfigPath(): string {
  return join(app.getPath('userData'), 'kouign.config.json')
}

function defaultConfig(): Config {
  return { recents: [], settings: { ...DEFAULT_SETTINGS } }
}

/**
 * Reads and parses the config file.
 * Returns defaults if the file is absent or cannot be parsed (corrupt JSON,
 * unexpected shape, etc.).
 */
function readConfig(): Config {
  try {
    const raw = readFileSync(getConfigPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<Config>
    return {
      recents:  Array.isArray(parsed.recents) ? (parsed.recents as DatasourceRef[]) : [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    }
  } catch {
    // File not found or corrupt — fall back to defaults silently.
    return defaultConfig()
  }
}

function writeConfig(config: Config): void {
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Adds or updates a datasource reference in the recents list.
 * If a ref with the same path already exists it is updated in-place;
 * otherwise the new ref is prepended so the most-recent item is first.
 */
export function addRecent(ref: DatasourceRef): void {
  const config = readConfig()
  const idx = config.recents.findIndex(r => r.path === ref.path)
  if (idx >= 0) {
    config.recents[idx] = ref
  } else {
    config.recents.unshift(ref)
  }
  writeConfig(config)
}

/**
 * Removes the datasource reference with the given path from the recents list.
 * No-op if the path is not found.
 */
export function removeRecent(filePath: string): void {
  const config = readConfig()
  config.recents = config.recents.filter(r => r.path !== filePath)
  writeConfig(config)
}

/** Returns the current list of recent datasource references (most-recent first). */
export function listRecents(): DatasourceRef[] {
  return readConfig().recents
}

/**
 * Returns the current AppSettings, merged with DEFAULT_SETTINGS so that any
 * new keys added in future versions are always present with their defaults.
 */
export function getSettings(): AppSettings {
  return readConfig().settings
}

/**
 * Merges a partial settings patch over the current settings and persists.
 * Returns the fully merged settings object.
 */
export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const config = readConfig()
  config.settings = { ...config.settings, ...patch }
  writeConfig(config)
  return config.settings
}
