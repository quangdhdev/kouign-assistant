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

import React, { useEffect, useState } from 'react'
import { Plus, ExternalLink, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { Task, TaskStatus, TaskCategory } from '@shared/types'
import { useTasksStore } from '@/store/tasks'
import { useToast } from '@/components/ToastProvider'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
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
import {
  STATUS_LABEL,
  STATUS_BADGE_VARIANT,
  PRIORITY_BADGE_VARIANT,
  PRIORITY_LABEL,
  CATEGORY_LABEL,
} from './meta'

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

function useConfirmDelete() {
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

interface LinkChipProps {
  label: string
  url: string
}

function LinkChip({ label, url }: LinkChipProps): React.ReactElement {
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
          <span className="text-xs text-muted-foreground">
            {CATEGORY_LABEL[task.category]}
          </span>

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
  const { tasks, filter, loading, load, setFilter, remove } = useTasksStore()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const confirmDelete = useConfirmDelete()

  // Load tasks on mount
  useEffect(() => {
    load().catch(e => toast(e instanceof Error ? e.message : 'Failed to load tasks', 'error'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // -- Category filter --
  const activeCategory = filter.category ?? null
  const activeStatus   = filter.status   ?? null

  function handleCategoryFilter(category: TaskCategory | null): void {
    setFilter({ ...filter, category: category ?? undefined }).catch(
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
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New task
        </Button>
      </div>

      {/* Filter pills */}
      <div className="px-6 pb-3 flex flex-col gap-2 flex-shrink-0">
        {/* Category pills */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground w-16 flex-shrink-0">Category</span>
          <div className="flex gap-1.5 flex-wrap">
            <Pill active={activeCategory === null} onClick={() => handleCategoryFilter(null)}>All</Pill>
            <Pill active={activeCategory === 'personal'} onClick={() => handleCategoryFilter('personal')}>Personal</Pill>
            <Pill active={activeCategory === 'company'} onClick={() => handleCategoryFilter('company')}>Company</Pill>
          </div>
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground w-16 flex-shrink-0">Status</span>
          <div className="flex gap-1.5 flex-wrap">
            <Pill active={activeStatus === null} onClick={() => handleStatusFilter(null)}>All</Pill>
            <Pill active={activeStatus === 'todo'} onClick={() => handleStatusFilter('todo')}>{STATUS_LABEL.todo}</Pill>
            <Pill active={activeStatus === 'in_progress'} onClick={() => handleStatusFilter('in_progress')}>{STATUS_LABEL.in_progress}</Pill>
            <Pill active={activeStatus === 'done'} onClick={() => handleStatusFilter('done')}>{STATUS_LABEL.done}</Pill>
          </div>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-2">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Loading…
          </div>
        ) : tasks.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-48 text-center px-6">
            <p className="text-sm font-medium text-foreground mb-1">No tasks here</p>
            <p className="text-xs text-muted-foreground mb-4">
              {activeCategory !== null || activeStatus !== null
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

      {/* Create / Edit dialog */}
      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
      />
    </div>
  )
}
