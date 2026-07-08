/**
 * categories.ts — IPC handlers for category CRUD.
 *
 * User-managed categories are shared by tasks and notes (single-select each).
 * All handlers reject with a typed error when the session is locked (no open
 * DB handle). On success they delegate to categoryRepo and return the domain
 * type wrapped in IpcResult<T> via the handle() wrapper.
 */

import type { Category } from '@shared/types'
import type { CreateCategoryInput, UpdateCategoryInput } from '@shared/types'
import { IPC } from '@shared/ipc'
import { handle } from './result'
import { getDb } from '../session'
import { categoryRepo } from '../db/repositories'

/** Throws a plain Error when the session is locked. handle() maps it to IpcResult. */
function requireDb() {
  const db = getDb()
  if (!db) throw new Error('The datasource is locked. Unlock to access categories.')
  return db
}

export function registerCategoryHandlers(): void {
  // List all categories, ordered by name
  handle<Category[]>(IPC.categories.list, () => {
    const db = requireDb()
    return categoryRepo(db).list()
  })

  // Create a new category
  handle<Category>(IPC.categories.create, (_event, input) => {
    const db = requireDb()
    return categoryRepo(db).create(input as CreateCategoryInput)
  })

  // Rename / recolor an existing category
  handle<Category>(IPC.categories.update, (_event, id, patch) => {
    const db = requireDb()
    return categoryRepo(db).update(id as number, patch as UpdateCategoryInput)
  })

  // Delete a category; referencing tasks/notes become uncategorized. Returns the id that was removed.
  handle<number>(IPC.categories.remove, (_event, id) => {
    const db = requireDb()
    categoryRepo(db).remove(id as number)
    return id as number
  })
}
