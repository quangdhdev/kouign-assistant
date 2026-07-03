/**
 * tasks.ts — IPC handlers for task CRUD + toggleStatus.
 *
 * All handlers reject with a typed error when the session is locked (no open
 * DB handle). On success they delegate to taskRepo and return the domain type
 * wrapped in IpcResult<T> via the handle() wrapper.
 */

import type { Task } from '@shared/types'
import type { CreateTaskInput, UpdateTaskInput, TaskFilter } from '@shared/types'
import { IPC } from '@shared/ipc'
import { handle } from './result'
import { getDb } from '../session'
import { taskRepo } from '../db/repositories'

/** Throws a plain Error when the session is locked. handle() maps it to IpcResult. */
function requireDb() {
  const db = getDb()
  if (!db) throw new Error('The datasource is locked. Unlock to access tasks.')
  return db
}

export function registerTaskHandlers(): void {
  // List tasks, optionally filtered by category and/or status
  handle<Task[]>(IPC.tasks.list, (_event, filter) => {
    const db = requireDb()
    return taskRepo(db).list(filter as TaskFilter | undefined)
  })

  // Create a new task
  handle<Task>(IPC.tasks.create, (_event, input) => {
    const db = requireDb()
    return taskRepo(db).create(input as CreateTaskInput)
  })

  // Patch an existing task
  handle<Task>(IPC.tasks.update, (_event, id, patch) => {
    const db = requireDb()
    return taskRepo(db).update(id as number, patch as UpdateTaskInput)
  })

  // Delete a task; returns the id that was removed
  handle<number>(IPC.tasks.remove, (_event, id) => {
    const db = requireDb()
    taskRepo(db).remove(id as number)
    return id as number
  })

  // Advance status cycle: todo → in_progress → done → todo
  handle<Task>(IPC.tasks.toggleStatus, (_event, id) => {
    const db = requireDb()
    return taskRepo(db).toggleStatus(id as number)
  })
}
