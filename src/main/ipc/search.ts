/**
 * search.ts — IPC handler for full-text search.
 *
 * Delegates to searchRepo which queries the FTS5 external-content tables
 * (tasks_fts, notes_fts) and returns bm25-ranked, snippet-annotated results.
 * Rejects with a typed error when the session is locked.
 */

import type { SearchResult } from '@shared/types'
import { IPC } from '@shared/ipc'
import { handle } from './result'
import { getDb } from '../session'
import { searchRepo } from '../db/repositories'

/** Throws a plain Error when the session is locked. handle() maps it to IpcResult. */
function requireDb() {
  const db = getDb()
  if (!db) throw new Error('The datasource is locked. Unlock to search.')
  return db
}

export function registerSearchHandlers(): void {
  // Full-text search across tasks and notes; q is the raw user query string.
  handle<SearchResult[]>(IPC.search.query, (_event, q) => {
    const db = requireDb()
    return searchRepo(db).query(q as string)
  })
}
