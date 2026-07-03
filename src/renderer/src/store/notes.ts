/**
 * notes.ts — Zustand store for the Notes feature.
 *
 * Owns the note list, the active type filter, the selected note ID, and
 * loading state. All mutations go through window.api.notes.* (via unwrap)
 * and surface errors as toasts via the ToastContext.
 *
 * Sort order: pinned notes first, then updatedAt descending within each group.
 */

import { create } from 'zustand'
import type { Note, NoteFilter, CreateNoteInput, UpdateNoteInput } from '@shared/types'
import { unwrap } from '@/lib/api'

// ---------------------------------------------------------------------------
// Sort helper
// ---------------------------------------------------------------------------

function compareNotes(a: Note, b: Note): number {
  // Pinned notes sort first
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  // Within the same group: updatedAt desc (most-recently-updated first)
  return b.updatedAt.localeCompare(a.updatedAt)
}

// ---------------------------------------------------------------------------
// Toast type alias (matches ToastProvider signature)
// ---------------------------------------------------------------------------

type ToastFn = (msg: string, kind?: 'error' | 'success' | 'info') => void

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface NotesStore {
  notes: Note[]
  filter: NoteFilter
  selectedId: number | null
  loading: boolean

  /** Load (or reload) notes from the main process, applying the current filter. */
  load(): Promise<void>

  /** Update the filter and reload. Clears selection. */
  setFilter(filter: NoteFilter): Promise<void>

  /** Select a note by id (or clear selection with null). */
  select(id: number | null): void

  /** Create a new note, add it to the list, and select it. Returns the new note or null on error. */
  create(input: CreateNoteInput, toast: ToastFn): Promise<Note | null>

  /** Patch an existing note (e.g. autosave). Silently updates the list without showing success toast. */
  update(id: number, patch: UpdateNoteInput, toast: ToastFn): Promise<void>

  /** Toggle the pinned flag on a note. */
  togglePin(id: number, toast: ToastFn): Promise<void>

  /** Delete a note. Clears selection if the deleted note was selected. */
  remove(id: number, toast: ToastFn): Promise<void>
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: [],
  filter: {},
  selectedId: null,
  loading: false,

  async load() {
    set({ loading: true })
    try {
      const notes = await unwrap(window.api.notes.list(get().filter))
      set({ notes: [...notes].sort(compareNotes), loading: false })
    } catch (e) {
      set({ loading: false })
      // load() callers handle their own error display
      throw e
    }
  },

  async setFilter(filter) {
    set({ filter, selectedId: null })
    await get().load()
  },

  select(id) {
    set({ selectedId: id })
  },

  async create(input, toast) {
    try {
      const note = await unwrap(window.api.notes.create(input))
      set(s => ({
        notes: [...s.notes, note].sort(compareNotes),
        selectedId: note.id,
      }))
      toast('Note created', 'success')
      return note
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to create note', 'error')
      return null
    }
  },

  async update(id, patch, toast) {
    try {
      const updated = await unwrap(window.api.notes.update(id, patch))
      set(s => ({
        notes: s.notes.map(n => (n.id === id ? updated : n)).sort(compareNotes),
      }))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to save note', 'error')
    }
  },

  async togglePin(id, toast) {
    try {
      const updated = await unwrap(window.api.notes.togglePin(id))
      set(s => ({
        notes: s.notes.map(n => (n.id === id ? updated : n)).sort(compareNotes),
      }))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to toggle pin', 'error')
    }
  },

  async remove(id, toast) {
    try {
      await unwrap(window.api.notes.remove(id))
      set(s => ({
        notes: s.notes.filter(n => n.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
      }))
      toast('Note deleted', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to delete note', 'error')
    }
  },
}))
