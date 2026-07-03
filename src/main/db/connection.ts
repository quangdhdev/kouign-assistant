/**
 * connection.ts — open, key, and close the SQLCipher-encrypted database.
 *
 * Security rules:
 *  - The password is NEVER logged or persisted.
 *  - SQLCipher pragmas are applied in the exact order mandated by the spec.
 *  - A probe query validates the key before returning the handle.
 */

import Database from 'better-sqlite3-multiple-ciphers'
import { existsSync } from 'node:fs'
import { DatasourceError } from '@shared/types'

/** Escape single quotes for use inside a PRAGMA key literal. */
function escapePragmaString(value: string): string {
  return value.replace(/'/g, "''")
}

/**
 * Opens an existing encrypted database file and keys it with the supplied password.
 *
 * Pragma order (mandatory for SQLCipher):
 *   1. PRAGMA cipher = 'sqlcipher'
 *   2. PRAGMA key = '<escaped-password>'
 *   3. Probe: SELECT count(*) FROM sqlite_master  (fails → INVALID_PASSWORD)
 *   4. PRAGMA journal_mode = WAL
 *   5. PRAGMA foreign_keys = ON
 *
 * @throws {DatasourceError} code='INVALID_PASSWORD' when the password is wrong.
 */
export function openDatabase(filePath: string, password: string): Database.Database {
  const db = new Database(filePath)
  const escaped = escapePragmaString(password)

  db.pragma("cipher = 'sqlcipher'")
  db.pragma(`key = '${escaped}'`)

  // Probe: a wrong key makes the file appear as "not a database".
  // This SELECT is the recommended detection mechanism (see ARCHITECTURE §5).
  try {
    db.prepare('SELECT count(*) FROM sqlite_master').get()
  } catch {
    db.close()
    throw new DatasourceError('INVALID_PASSWORD')
  }

  // WAL and FK enforcement are set AFTER successful keying.
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  return db
}

/**
 * Creates a brand-new encrypted database at the given path.
 * The file must not already exist.
 *
 * @throws {DatasourceError} code='ALREADY_EXISTS' when the path is occupied.
 */
export function createDatabase(filePath: string, password: string): Database.Database {
  if (existsSync(filePath)) {
    throw new DatasourceError('ALREADY_EXISTS')
  }
  return openDatabase(filePath, password)
}

/**
 * Closes the database handle.  The caller (session lifecycle in Phase 2) is
 * responsible for discarding the reference after calling this.
 */
export function closeDatabase(db: Database.Database): void {
  db.close()
}
