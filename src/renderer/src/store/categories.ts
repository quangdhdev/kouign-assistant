/**
 * categories.ts — Zustand store for user-managed categories (shared by Todos & Notes).
 *
 * Owns the full category list, sorted by name. All mutations go through
 * window.api.categories.* (via unwrap) and surface errors as toasts via the
 * ToastContext. Loaded once on unlock (see AppShell) and consumed by the
 * Todos/Notes filters, pickers, and the Settings ▸ Categories manager.
 */

import { create } from 'zustand'
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '@shared/types'
import { unwrap } from '@/lib/api'

type ToastFn = (msg: string, kind?: 'error' | 'success' | 'info') => void

function compareCategories(a: Category, b: Category): number {
  return a.name.localeCompare(b.name)
}

interface CategoriesStore {
  categories: Category[]
  loading: boolean

  /** Load (or reload) the full category list from the main process. */
  load(): Promise<void>

  /** Create a new category. Returns the persisted category or null on error (e.g. duplicate name). */
  create(input: CreateCategoryInput, toast: ToastFn): Promise<Category | null>

  /** Rename and/or recolor an existing category. Returns the updated category or null on error. */
  update(id: number, patch: UpdateCategoryInput, toast: ToastFn): Promise<Category | null>

  /** Delete a category. Referencing tasks/notes become uncategorized (handled server-side). */
  remove(id: number, toast: ToastFn): Promise<void>
}

export const useCategoriesStore = create<CategoriesStore>((set) => ({
  categories: [],
  loading: false,

  async load() {
    set({ loading: true })
    try {
      const categories = await unwrap(window.api.categories.list())
      set({ categories: [...categories].sort(compareCategories), loading: false })
    } catch (e) {
      set({ loading: false })
      throw e
    }
  },

  async create(input, toast) {
    try {
      const category = await unwrap(window.api.categories.create(input))
      set(s => ({ categories: [...s.categories, category].sort(compareCategories) }))
      toast('Category created', 'success')
      return category
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to create category', 'error')
      return null
    }
  },

  async update(id, patch, toast) {
    try {
      const updated = await unwrap(window.api.categories.update(id, patch))
      set(s => ({
        categories: s.categories.map(c => (c.id === id ? updated : c)).sort(compareCategories),
      }))
      return updated
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to update category', 'error')
      return null
    }
  },

  async remove(id, toast) {
    try {
      await unwrap(window.api.categories.remove(id))
      set(s => ({ categories: s.categories.filter(c => c.id !== id) }))
      toast('Category deleted', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to delete category', 'error')
    }
  },
}))
