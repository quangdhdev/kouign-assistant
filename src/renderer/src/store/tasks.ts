/**
 * tasks.ts — Zustand store for the Todos feature.
 *
 * Owns the task list, the active filter, and loading state.
 * All mutations go through window.api.tasks.* (via unwrap) and surface
 * errors as toasts via the ToastContext. The list is kept sorted after every
 * mutation: incomplete tasks (todo / in_progress) first, then done; within
 * each group ordered by dueDate ASC (nulls last), then createdAt ASC.
 */

import { create } from 'zustand'
import type { Task, TaskFilter, CreateTaskInput, UpdateTaskInput } from '@shared/types'
import { unwrap } from '@/lib/api'

// ---------------------------------------------------------------------------
// Sort helper
// ---------------------------------------------------------------------------

function compareTasks(a: Task, b: Task): number {
  // Incomplete (todo / in_progress) sorts before done
  const aIncomplete = a.status !== 'done' ? 0 : 1
  const bIncomplete = b.status !== 'done' ? 0 : 1
  if (aIncomplete !== bIncomplete) return aIncomplete - bIncomplete

  // Within the same group: due date ASC (null last), then createdAt ASC
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1
    if (b.dueDate === null) return -1
    return a.dueDate.localeCompare(b.dueDate)
  }
  return a.createdAt.localeCompare(b.createdAt)
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface TasksStore {
  tasks: Task[]
  filter: TaskFilter
  loading: boolean

  /**
   * When set to a task id, TodosPage opens the edit dialog for that task.
   * Consumed (set back to null) by TodosPage after the dialog opens.
   * Used by the search palette to jump to a specific task.
   */
  openEditId: number | null

  /** Load (or reload) tasks from the main process, applying the current filter. */
  load(): Promise<void>

  /** Update the filter and reload. */
  setFilter(filter: TaskFilter): Promise<void>

  /** Create a new task and add it to the list. */
  create(input: CreateTaskInput, toast: (msg: string, kind?: 'error' | 'success' | 'info') => void): Promise<void>

  /** Patch an existing task. */
  update(id: number, patch: UpdateTaskInput, toast: (msg: string, kind?: 'error' | 'success' | 'info') => void): Promise<void>

  /** Advance status cycle: todo → in_progress → done → todo. */
  toggleStatus(id: number, toast: (msg: string, kind?: 'error' | 'success' | 'info') => void): Promise<void>

  /** Delete a task by ID. */
  remove(id: number, toast: (msg: string, kind?: 'error' | 'success' | 'info') => void): Promise<void>

  /**
   * Signal TodosPage to open the edit dialog for the given task id.
   * Call before navigating to /todos; the page consumes and resets this to null.
   */
  setOpenEditId(id: number | null): void
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useTasksStore = create<TasksStore>((set, get) => ({
  tasks: [],
  filter: {},
  loading: false,
  openEditId: null,

  async load() {
    set({ loading: true })
    try {
      const tasks = await unwrap(window.api.tasks.list(get().filter))
      set({ tasks: [...tasks].sort(compareTasks), loading: false })
    } catch (e) {
      set({ loading: false })
      // load() callers handle their own error display
      throw e
    }
  },

  async setFilter(filter) {
    set({ filter })
    await get().load()
  },

  async create(input, toast) {
    try {
      const task = await unwrap(window.api.tasks.create(input))
      set(s => ({ tasks: [...s.tasks, task].sort(compareTasks) }))
      toast('Task created', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to create task', 'error')
    }
  },

  async update(id, patch, toast) {
    try {
      const updated = await unwrap(window.api.tasks.update(id, patch))
      set(s => ({
        tasks: s.tasks.map(t => (t.id === id ? updated : t)).sort(compareTasks),
      }))
      toast('Task updated', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to update task', 'error')
    }
  },

  async toggleStatus(id, toast) {
    try {
      const updated = await unwrap(window.api.tasks.toggleStatus(id))
      set(s => ({
        tasks: s.tasks.map(t => (t.id === id ? updated : t)).sort(compareTasks),
      }))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to update task status', 'error')
    }
  },

  async remove(id, toast) {
    try {
      await unwrap(window.api.tasks.remove(id))
      set(s => ({ tasks: s.tasks.filter(t => t.id !== id) }))
      toast('Task deleted', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to delete task', 'error')
    }
  },

  setOpenEditId(id) {
    set({ openEditId: id })
  },
}))
