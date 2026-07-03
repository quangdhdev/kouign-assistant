/**
 * settings.ts — Zustand store for AppSettings.
 *
 * Shared source of truth for theme, auto-lock, etc.
 * Loaded from the plaintext config (settings:get) — accessible even before unlock.
 * Used by App.tsx (theme effect), AppShell top bar (quick toggle), and SettingsPage.
 */

import { create } from 'zustand'
import type { AppSettings } from '@shared/types'
import { unwrap } from '@/lib/api'

interface SettingsStore {
  settings: AppSettings | null
  loaded: boolean

  /** Load settings from main process (reads plaintext config — safe pre-unlock). */
  load(): Promise<void>

  /** Persist a patch and update local state. Returns updated settings or null on error. */
  update(patch: Partial<AppSettings>): Promise<AppSettings | null>
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: null,
  loaded: false,

  async load() {
    try {
      const s = await unwrap(window.api.settings.get())
      set({ settings: s, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  async update(patch) {
    try {
      const s = await unwrap(window.api.settings.update(patch))
      set({ settings: s })
      return s
    } catch {
      return null
    }
  },
}))
