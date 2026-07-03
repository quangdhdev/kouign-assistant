/**
 * icloud.ts — iCloud Drive resolution and .icloud placeholder detection.
 *
 * macOS evicts files from local storage when iCloud Drive storage is reclaimed.
 * An evicted file is replaced by a ".<name>.icloud" placeholder file.
 * Phase 2 calls isICloudPlaceholder() before unlocking to reject with
 * DatasourceError('ICLOUD_NOT_DOWNLOADED') rather than surfacing a confusing
 * "file is not a database" error.
 */

import { app } from 'electron'
import { join, basename, dirname } from 'node:path'
import { existsSync } from 'node:fs'

/** Canonical path to the user's iCloud Drive documents root on macOS. */
const ICLOUD_DOCS_DIR = join(
  process.env['HOME'] ?? '',
  'Library',
  'Mobile Documents',
  'com~apple~CloudDocs'
)

/**
 * Returns the iCloud Drive directory path if it is present and accessible,
 * or null if iCloud Drive is not available on this Mac.
 */
export function getICloudDriveDir(): string | null {
  return existsSync(ICLOUD_DOCS_DIR) ? ICLOUD_DOCS_DIR : null
}

/**
 * Returns true when `filePath` refers to an evicted iCloud file.
 *
 * Detection logic:
 *   1. If the real file exists at `filePath` — it is NOT a placeholder.
 *   2. If the sibling file `.<basename>.icloud` exists in the same directory —
 *      the file has been evicted and the placeholder is present.
 */
export function isICloudPlaceholder(filePath: string): boolean {
  if (existsSync(filePath)) return false
  const placeholder = join(dirname(filePath), `.${basename(filePath)}.icloud`)
  return existsSync(placeholder)
}

/**
 * Returns the recommended directory for creating a new datasource.
 * Prefers iCloud Drive (so the file syncs automatically) and falls back to
 * the user's Documents folder when iCloud is not available.
 */
export function defaultDatasourceDir(): string {
  return getICloudDriveDir() ?? app.getPath('documents')
}
