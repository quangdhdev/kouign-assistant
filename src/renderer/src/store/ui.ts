/**
 * ui.ts — Zustand store for cross-component UI signals.
 *
 * Provides monotonically-incrementing sequence numbers that components
 * watch to react to global shortcut triggers without prop-drilling.
 *
 * Pattern: AppShell increments the seq when a shortcut fires;
 * the target page watches the seq in a useEffect and opens its dialog when it changes.
 */

import { create } from 'zustand'

interface UiStore {
  /** Increment to signal TodosPage to open the "New task" dialog. */
  newTaskSeq: number

  /** Increment to signal NotesPage to create a new note. */
  newNoteSeq: number

  fireNewTask(): void
  fireNewNote(): void
}

export const useUiStore = create<UiStore>((set) => ({
  newTaskSeq: 0,
  newNoteSeq: 0,
  fireNewTask: () => set((s) => ({ newTaskSeq: s.newTaskSeq + 1 })),
  fireNewNote: () => set((s) => ({ newNoteSeq: s.newNoteSeq + 1 })),
}))
