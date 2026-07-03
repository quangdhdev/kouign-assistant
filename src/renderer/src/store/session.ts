/**
 * session.ts — Zustand store for session state.
 *
 * Wraps window.api calls and surfaces errors via the toast context.
 */
import { create } from 'zustand'
import type { SessionState } from '@shared/types'
import { unwrap } from '@/lib/api'

interface SessionStore {
  state: SessionState
  error: string | null
  setError: (msg: string | null) => void
  refresh: () => Promise<void>
  unlock: (path: string, password: string) => Promise<boolean>
  create: (input: { path: string; label: string; password: string }) => Promise<boolean>
  lock: () => Promise<void>
  setSessionState: (s: SessionState) => void
}

export const useSessionStore = create<SessionStore>((set) => ({
  state: { unlocked: false, datasource: null },
  error: null,

  setError: (msg) => set({ error: msg }),

  setSessionState: (s) => set({ state: s }),

  refresh: async () => {
    try {
      const s = await unwrap(window.api.datasource.session())
      set({ state: s, error: null })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    }
  },

  unlock: async (path, password) => {
    try {
      const s = await unwrap(window.api.datasource.unlock({ path, password }))
      set({ state: s, error: null })
      return true
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      return false
    }
  },

  create: async (input) => {
    try {
      const s = await unwrap(window.api.datasource.create(input))
      set({ state: s, error: null })
      return true
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      return false
    }
  },

  lock: async () => {
    try {
      const s = await unwrap(window.api.datasource.lock())
      set({ state: s, error: null })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    }
  },
}))
