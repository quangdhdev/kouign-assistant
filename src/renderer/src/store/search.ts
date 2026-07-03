/**
 * search.ts — Zustand store for global FTS5 search.
 *
 * Holds the current query string, the last result set, and loading state.
 * Calls are debounced (200 ms) so that keystroke-by-keystroke typing does
 * not flood the main process.
 */

import { create } from 'zustand'
import type { SearchResult } from '@shared/types'

// Module-level debounce timer — safe for a singleton store.
let _debounceTimer: ReturnType<typeof setTimeout> | null = null
const DEBOUNCE_MS = 200

interface SearchStore {
  query: string
  results: SearchResult[]
  loading: boolean

  /**
   * Update the query and schedule a debounced search.
   * Clears results immediately when query is empty.
   */
  setQuery(q: string): void

  /** Execute the search immediately (called by the debounce timer). */
  _run(q: string): Promise<void>

  /** Reset to idle state (called when the palette closes). */
  clear(): void
}

export const useSearchStore = create<SearchStore>((set, get) => ({
  query: '',
  results: [],
  loading: false,

  setQuery(q) {
    set({ query: q })

    // Cancel any in-flight debounce
    if (_debounceTimer !== null) {
      clearTimeout(_debounceTimer)
      _debounceTimer = null
    }

    if (!q.trim()) {
      set({ results: [], loading: false })
      return
    }

    set({ loading: true })
    _debounceTimer = setTimeout(() => {
      _debounceTimer = null
      get()._run(q).catch(() => {/* errors surfaced via loading: false */})
    }, DEBOUNCE_MS)
  },

  async _run(q) {
    try {
      const result = await window.api.search.query(q)
      if (result.ok) {
        set({ results: result.data, loading: false })
      } else {
        set({ results: [], loading: false })
      }
    } catch {
      set({ results: [], loading: false })
    }
  },

  clear() {
    if (_debounceTimer !== null) {
      clearTimeout(_debounceTimer)
      _debounceTimer = null
    }
    set({ query: '', results: [], loading: false })
  },
}))
