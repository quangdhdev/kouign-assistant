/**
 * TodosPage.tsx — Full Todos feature page.
 *
 * Layout:
 *   - Header: page title + "New task" button
 *   - Filter pills: category (All / Personal / Company) + status (All / To Do / In Progress / Done)
 *   - Task list (sorted: incomplete first, then due/created)
 *   - Empty state when the filtered list is empty
 *
 * Each task row has:
 *   - Checkbox that cycles status (todo → in_progress → done → todo)
 *   - Title + meta (due date, category)
 *   - Status + priority badges
 *   - Jira / Slack chips (shown only when set)
 *   - Overflow menu (Edit, Set status →, Delete with confirm)
 */

import React, { useEffect, useRef, useState } from 'react'
import { Plus, ExternalLink, MoreHorizontal, Pencil, Trash2, List, LayoutGrid } from 'lucide-react'
import type { Task, TaskStatus } from '@shared/types'
import { useTasksStore } from '@/store/tasks'
import { useUiStore } from '@/store/ui'
import { useCategoriesStore } from '@/store/categories'
import { useToast } from '@/components/ToastProvider'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import CategoryTag from '@/components/CategoryTag'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import TaskDialog from './TaskDialog'
import TodosBoard from './TodosBoard'
import {
  STATUS_LABEL,
  STATUS_BADGE_VARIANT,
  PRIORITY_BADGE_VARIANT,
  PRIORITY_LABEL,
} from './meta'

// ---------------------------------------------------------------------------
// View toggle (List / Board) — persisted in localStorage
// ---------------------------------------------------------------------------

type TodosView = 'list' | 'board'

const VIEW_KEY = 'kouign.todos.view'

function readStoredView(): TodosView {
  return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list'
}

// ---------------------------------------------------------------------------
// Pill filter helpers
// ---------------------------------------------------------------------------

interface PillProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function Pill({ active, onClick, children }: PillProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        active
          ? 'bg-accent text-accent-foreground'
          : 'bg-secondary text-secondary-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Confirm-delete state
// ---------------------------------------------------------------------------

export function useConfirmDelete() {
  const [pendingId, setPendingId] = useState<number | null>(null)
  return {
    pendingId,
    request: (id: number) => setPendingId(id),
    cancel: () => setPendingId(null),
    isFor: (id: number) => pendingId === id,
  }
}

// ---------------------------------------------------------------------------
// Jira / Slack chip
// ---------------------------------------------------------------------------

export interface LinkChipProps {
  label: string
  url: string
}

export function LinkChip({ label, url }: LinkChipProps): React.ReactElement {
  function handleClick(e: React.MouseEvent): void {
    e.stopPropagation()
    window.api.shell.openExternal(url)
  }

  return (
    <button
      onClick={handleClick}
      title={`Open in browser: ${url}`}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-secondary text-secondary-foreground hover:bg-muted transition-colors"
    >
      <ExternalLink className="h-3 w-3" />
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Task row
// ---------------------------------------------------------------------------

interface TaskRowProps {
  task: Task
  onEdit: (task: Task) => void
  onDelete: (id: number) => void
  confirmDelete: ReturnType<typeof useConfirmDelete>
}

function TaskRow({ task, onEdit, onDelete, confirmDelete }: TaskRowProps): React.ReactElement {
  const { toast } = useToast()
  const { toggleStatus, update } = useTasksStore()

  const isDone = task.status === 'done'

  function handleCheckbox(): void {
    toggleStatus(task.id, toast)
  }

  function handleSetStatus(status: TaskStatus): void {
    update(task.id, { status }, toast)
  }

  const checkboxChecked: boolean | 'indeterminate' =
    task.status === 'done' ? true : task.status === 'in_progress' ? 'indeterminate' : false

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors group">
      {/* Checkbox — advances status cycle */}
      <div className="flex-shrink-0 mt-0.5">
        <Checkbox
          checked={checkboxChecked}
          onCheckedChange={handleCheckbox}
          aria-label={`Toggle status: ${STATUS_LABEL[task.status]}`}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <p className={`text-sm font-medium leading-snug ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {task.title}
        </p>

        {/* Meta row: due date, category, badges, chips */}
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {/* Due date */}
          {task.dueDate && (
            <span className="text-xs text-muted-foreground">
              Due {task.dueDate}
            </span>
          )}

          {/* Category */}
          <CategoryTag categoryId={task.categoryId} />

          {/* Status badge */}
          <Badge variant={STATUS_BADGE_VARIANT[task.status]}>
            {STATUS_LABEL[task.status]}
          </Badge>

          {/* Priority badge */}
          <Badge variant={PRIORITY_BADGE_VARIANT[task.priority]}>
            {PRIORITY_LABEL[task.priority]}
          </Badge>

          {/* Jira chip */}
          {task.jiraUrl && <LinkChip label="Jira" url={task.jiraUrl} />}

          {/* Slack chip */}
          {task.slackUrl && <LinkChip label="Slack" url={task.slackUrl} />}
        </div>

        {/* Description (collapsed, shown as secondary text) */}
        {task.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{task.description}</p>
        )}
      </div>

      {/* Overflow menu */}
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {confirmDelete.isFor(task.id) ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Delete?</span>
            <Button
              size="sm"
              variant="destructive"
              className="h-6 px-2 text-xs"
              onClick={() => onDelete(task.id)}
            >
              Yes
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={confirmDelete.cancel}
            >
              No
            </Button>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                aria-label="Task options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onEdit(task)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Set status</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {(['todo', 'in_progress', 'done'] as const).map(s => (
                    <DropdownMenuItem
                      key={s}
                      onClick={() => handleSetStatus(s)}
                      className={task.status === s ? 'font-semibold text-accent-foreground' : ''}
                    >
                      {STATUS_LABEL[s]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => confirmDelete.request(task.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TodosPage(): React.ReactElement {
  const { toast } = useToast()
  const { tasks, filter, loading, load, setFilter, remove, openEditId, setOpenEditId } = useTasksStore()
  const { categories } = useCategoriesStore()
  const newTaskSeq = useUiStore((s) => s.newTaskSeq)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const confirmDelete = useConfirmDelete()

  // View toggle (List / Board) — read synchronously so there's no flash on load.
  const [view, setView] = useState<TodosView>(readStoredView)
  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view)
  }, [view])

  // Load tasks on mount
  useEffect(() => {
    load().catch(e => toast(e instanceof Error ? e.message : 'Failed to load tasks', 'error'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Open edit dialog when the search palette navigates here with a target task id.
  // Re-runs whenever openEditId or tasks changes (tasks may still be loading when
  // openEditId is first set — we wait until the task appears in the list).
  useEffect(() => {
    if (openEditId === null) return
    const target = tasks.find(t => t.id === openEditId)
    if (target) {
      setEditingTask(target)
      setDialogOpen(true)
      setOpenEditId(null) // consume
    }
  }, [openEditId, tasks]) // eslint-disable-line react-hooks/exhaustive-deps

  // Open "New task" dialog when the ⌘N shortcut fires from AppShell.
  const lastNewTaskSeqRef = useRef(newTaskSeq)
  useEffect(() => {
    if (newTaskSeq === lastNewTaskSeqRef.current) return
    lastNewTaskSeqRef.current = newTaskSeq
    openCreate()
  }, [newTaskSeq])

  // -- Category filter --
  // undefined = All, null = Uncategorized, number = a specific category id.
  const activeCategoryId = filter.categoryId
  const activeStatus     = filter.status ?? null

  function handleCategoryFilter(categoryId: number | null | undefined): void {
    setFilter({ ...filter, categoryId }).catch(
      e => toast(e instanceof Error ? e.message : 'Filter failed', 'error')
    )
  }

  function handleStatusFilter(status: TaskStatus | null): void {
    setFilter({ ...filter, status: status ?? undefined }).catch(
      e => toast(e instanceof Error ? e.message : 'Filter failed', 'error')
    )
  }

  function openCreate(): void {
    setEditingTask(null)
    setDialogOpen(true)
  }

  function openEdit(task: Task): void {
    setEditingTask(task)
    setDialogOpen(true)
  }

  function handleDelete(id: number): void {
    confirmDelete.cancel()
    remove(id, toast)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
        <h1 className="text-lg font-semibold text-foreground">Todos</h1>
        <div className="flex items-center gap-2">
          {/* List / Board view toggle */}
          <div className="flex items-center bg-secondary rounded-md p-0.5">
            <button
              onClick={() => setView('list')}
              title="List view"
              aria-label="List view"
              aria-pressed={view === 'list'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                view === 'list'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-secondary-foreground hover:bg-muted'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
            <button
              onClick={() => setView('board')}
              title="Board view"
              aria-label="Board view"
              aria-pressed={view === 'board'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                view === 'board'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-secondary-foreground hover:bg-muted'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Board
            </button>
          </div>

          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New task
          </Button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="px-6 pb-3 flex flex-col gap-2 flex-shrink-0">
        {/* Category pills — dynamic from user-managed categories */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground w-16 flex-shrink-0">Category</span>
          <div className="flex gap-1.5 flex-wrap">
            <Pill active={activeCategoryId === undefined} onClick={() => handleCategoryFilter(undefined)}>All</Pill>
            {categories.map(cat => (
              <Pill key={cat.id} active={activeCategoryId === cat.id} onClick={() => handleCategoryFilter(cat.id)}>
                {cat.name}
              </Pill>
            ))}
            <Pill active={activeCategoryId === null} onClick={() => handleCategoryFilter(null)}>Uncategorized</Pill>
          </div>
        </div>

        {/* Status pills — hidden in Board view: columns represent status */}
        {view === 'list' && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground w-16 flex-shrink-0">Status</span>
            <div className="flex gap-1.5 flex-wrap">
              <Pill active={activeStatus === null} onClick={() => handleStatusFilter(null)}>All</Pill>
              <Pill active={activeStatus === 'todo'} onClick={() => handleStatusFilter('todo')}>{STATUS_LABEL.todo}</Pill>
              <Pill active={activeStatus === 'in_progress'} onClick={() => handleStatusFilter('in_progress')}>{STATUS_LABEL.in_progress}</Pill>
              <Pill active={activeStatus === 'done'} onClick={() => handleStatusFilter('done')}>{STATUS_LABEL.done}</Pill>
            </div>
          </div>
        )}
      </div>

      {/* Task list / board */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Loading…
        </div>
      ) : view === 'board' ? (
        <TodosBoard
          tasks={tasks}
          onEdit={openEdit}
          onDelete={handleDelete}
          confirmDelete={confirmDelete}
          onCreate={openCreate}
        />
      ) : (
        <div className="flex-1 overflow-y-auto px-2">
          {tasks.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-48 text-center px-6">
              <p className="text-sm font-medium text-foreground mb-1">No tasks here</p>
              <p className="text-xs text-muted-foreground mb-4">
                {activeCategoryId !== undefined || activeStatus !== null
                  ? 'Try clearing the filters, or create a new task.'
                  : 'Create your first task to get started.'}
              </p>
              <Button size="sm" variant="outline" onClick={openCreate} className="gap-1.5">
                <Plus className="h-4 w-4" />
                New task
              </Button>
            </div>
          ) : (
            <div className="bg-card rounded-[var(--radius-card)] border border-border overflow-hidden">
              {tasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  confirmDelete={confirmDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit dialog */}
      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        defaultCategoryId={typeof activeCategoryId === 'number' ? activeCategoryId : null}
      />
    </div>
  )
}
