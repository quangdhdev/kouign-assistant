/**
 * notes.ts — IPC handlers for note CRUD + togglePin.
 *
 * All handlers reject with a typed error when the session is locked (no open
 * DB handle). On success they delegate to noteRepo and return the domain type
 * wrapped in IpcResult<T> via the handle() wrapper.
 */

import type { Note } from '@shared/types'
import type { CreateNoteInput, UpdateNoteInput, NoteFilter } from '@shared/types'
import { IPC } from '@shared/ipc'
import { handle } from './result'
import { getDb } from '../session'
import { noteRepo } from '../db/repositories'

/** Throws a plain Error when the session is locked. handle() maps it to IpcResult. */
function requireDb() {
  const db = getDb()
  if (!db) throw new Error('The datasource is locked. Unlock to access notes.')
  return db
}

export function registerNoteHandlers(): void {
  // List notes, optionally filtered by type
  handle<Note[]>(IPC.notes.list, (_event, filter) => {
    const db = requireDb()
    return noteRepo(db).list(filter as NoteFilter | undefined)
  })

  // Create a new note
  handle<Note>(IPC.notes.create, (_event, input) => {
    const db = requireDb()
    return noteRepo(db).create(input as CreateNoteInput)
  })

  // Patch an existing note
  handle<Note>(IPC.notes.update, (_event, id, patch) => {
    const db = requireDb()
    return noteRepo(db).update(id as number, patch as UpdateNoteInput)
  })

  // Delete a note; returns the id that was removed
  handle<number>(IPC.notes.remove, (_event, id) => {
    const db = requireDb()
    noteRepo(db).remove(id as number)
    return id as number
  })

  // Toggle the pinned flag on a note
  handle<Note>(IPC.notes.togglePin, (_event, id) => {
    const db = requireDb()
    return noteRepo(db).togglePin(id as number)
  })
}
