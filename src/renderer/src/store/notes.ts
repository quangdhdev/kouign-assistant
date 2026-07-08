/**
 * notes.ts — Zustand store for the Notes feature.
 *
 * Owns the full note list, the (client-side, sidebar-only) type filter, tab
 * state, and loading state. All mutations go through window.api.notes.* (via
 * unwrap) and surface errors as toasts via the ToastContext.
 *
 * Sort order: pinned notes first, then updatedAt descending within each group.
 *
 * Tabs — multiple notes can be open at once (like browser tabs). `load()`
 * always fetches the full list (no server-side filter) so an open tab's note
 * data is available even when the sidebar's type filter would hide it; the
 * `filter` field is a display-only filter applied by NotesPage for the
 * sidebar list. Open tabs + the active tab persist to localStorage, scoped
 * per datasource path (see the persistence helpers below).
 */

import { create } from 'zustand'
import type { Note, NoteFilter, CreateNoteInput, UpdateNoteInput } from '@shared/types'
import { unwrap } from '@/lib/api'
import { useSessionStore } from '@/store/session'

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
// Tab persistence — localStorage, keyed by datasource path
// ---------------------------------------------------------------------------

const TABS_STORAGE_KEY = 'kouign.notes.tabs'

interface PersistedTabs {
  openTabIds: number[]
  activeTabId: number | null
}

function currentDatasourcePath(): string | null {
  return useSessionStore.getState().state.datasource?.path ?? null
}

function readTabsMap(): Record<string, PersistedTabs> {
  try {
    const raw = localStorage.getItem(TABS_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, PersistedTabs>) : {}
  } catch {
    return {}
  }
}

function loadPersistedTabs(path: string): PersistedTabs | null {
  return readTabsMap()[path] ?? null
}

function persistTabs(openTabIds: number[], activeTabId: number | null): void {
  const path = currentDatasourcePath()
  if (!path) return
  try {
    const map = readTabsMap()
    map[path] = { openTabIds, activeTabId }
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore storage errors (quota, etc.)
  }
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
  loading: boolean

  /** Ids of currently open tabs, in tab order. */
  openTabIds: number[]
  /** Id of the currently active (visible) tab, or null when no tabs are open. */
  activeTabId: number | null

  /** Load the full note list from the main process; restores persisted tabs. */
  load(): Promise<void>

  /** Update the display filter used by the sidebar list. Does not reload or touch tabs. */
  setFilter(filter: NoteFilter): void

  /** Open a note as a tab (if not already open) and activate it. */
  select(id: number): void

  /** Activate an already-open tab. */
  setActiveTab(id: number): void

  /** Close a tab; if it was active, activate its neighbor (or null). */
  closeTab(id: number): void

  /** Create a new note, open it as a tab, and activate it. Returns the new note or null on error. */
  create(input: CreateNoteInput, toast: ToastFn): Promise<Note | null>

  /** Patch an existing note (e.g. autosave). Silently updates the list without showing success toast. */
  update(id: number, patch: UpdateNoteInput, toast: ToastFn): Promise<void>

  /** Toggle the pinned flag on a note. */
  togglePin(id: number, toast: ToastFn): Promise<void>

  /** Delete a note. Also closes its tab. */
  remove(id: number, toast: ToastFn): Promise<void>
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: [],
  filter: {},
  loading: false,
  openTabIds: [],
  activeTabId: null,

  async load() {
    set({ loading: true })
    try {
      // Always fetch the full list — filtering is client-side (sidebar-only)
      // so an open tab's data stays available regardless of the active filter.
      const notes = await unwrap(window.api.notes.list({}))
      const sorted = [...notes].sort(compareNotes)

      // Restore persisted tabs for the current datasource, dropping ids that
      // no longer exist (deleted since we last saved).
      const path = currentDatasourcePath()
      const persisted = path ? loadPersistedTabs(path) : null
      const validIds = new Set(sorted.map(n => n.id))
      const openTabIds = (persisted?.openTabIds ?? []).filter(id => validIds.has(id))
      let activeTabId = persisted?.activeTabId ?? null
      if (activeTabId !== null && !openTabIds.includes(activeTabId)) {
        activeTabId = openTabIds[0] ?? null
      }

      set({ notes: sorted, loading: false, openTabIds, activeTabId })
    } catch (e) {
      set({ loading: false })
      // load() callers handle their own error display
      throw e
    }
  },

  setFilter(filter) {
    set({ filter })
  },

  select(id) {
    set(s => {
      const openTabIds = s.openTabIds.includes(id) ? s.openTabIds : [...s.openTabIds, id]
      persistTabs(openTabIds, id)
      return { openTabIds, activeTabId: id }
    })
  },

  setActiveTab(id) {
    set(s => {
      persistTabs(s.openTabIds, id)
      return { activeTabId: id }
    })
  },

  closeTab(id) {
    set(s => {
      const idx = s.openTabIds.indexOf(id)
      if (idx === -1) return s
      const openTabIds = s.openTabIds.filter(t => t !== id)
      let activeTabId = s.activeTabId
      if (activeTabId === id) {
        // Activate the neighbor that took this tab's position, or the one before it.
        activeTabId = openTabIds[idx] ?? openTabIds[idx - 1] ?? null
      }
      persistTabs(openTabIds, activeTabId)
      return { openTabIds, activeTabId }
    })
  },

  async create(input, toast) {
    try {
      const note = await unwrap(window.api.notes.create(input))
      set(s => {
        const openTabIds = [...s.openTabIds, note.id]
        persistTabs(openTabIds, note.id)
        return {
          notes: [...s.notes, note].sort(compareNotes),
          openTabIds,
          activeTabId: note.id,
        }
      })
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
      get().closeTab(id)
      set(s => ({ notes: s.notes.filter(n => n.id !== id) }))
      toast('Note deleted', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to delete note', 'error')
    }
  },
}))
