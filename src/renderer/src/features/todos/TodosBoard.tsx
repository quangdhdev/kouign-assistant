/**
 * TodosBoard.tsx — Kanban board view for Todos.
 *
 * Three columns (To Do / In Progress / Done) grouped from the same `tasks` array
 * TodosPage passes to the list view (already filtered by the store's category/status
 * filter, already sorted). Dragging a card to another column updates the task's
 * status via the existing `tasks.update` IPC (no new IPC/schema).
 *
 * Native HTML5 drag-and-drop — no new dependency. Each card also keeps the
 * "Set status →" overflow menu so status is changeable without dragging.
 */

import React, { useState } from 'react'
import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { Task, TaskStatus } from '@shared/types'
import { useTasksStore } from '@/store/tasks'
import { useToast } from '@/components/ToastProvider'
import { Button } from '@/components/ui/button'
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
import { LinkChip, useConfirmDelete } from './TodosPage'
import {
  STATUS_LABEL,
  STATUS_BADGE_VARIANT,
  PRIORITY_BADGE_VARIANT,
  PRIORITY_LABEL,
  CATEGORY_LABEL,
} from './meta'

const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'done']

// The dataTransfer MIME type used to pass the dragged task id.
const DRAG_MIME = 'application/x-kouign-task-id'

// ---------------------------------------------------------------------------
// TaskCard
// ---------------------------------------------------------------------------

interface TaskCardProps {
  task: Task
  onEdit: (task: Task) => void
  onDelete: (id: number) => void
  confirmDelete: ReturnType<typeof useConfirmDelete>
}

function TaskCard({ task, onEdit, onDelete, confirmDelete }: TaskCardProps): React.ReactElement {
  const { toast } = useToast()
  const { update } = useTasksStore()
  const [isDragging, setIsDragging] = useState(false)

  function handleSetStatus(status: TaskStatus): void {
    update(task.id, { status }, toast)
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>): void {
    e.dataTransfer.setData(DRAG_MIME, String(task.id))
    e.dataTransfer.effectAllowed = 'move'
    setIsDragging(true)
  }

  function handleDragEnd(): void {
    setIsDragging(false)
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onEdit(task)}
      className={`bg-card rounded-[var(--radius-card)] border border-border shadow-sm p-3 cursor-pointer hover:border-primary/40 transition-colors ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug text-foreground flex-1 min-w-0">
          {task.title}
        </p>

        {/* Overflow menu */}
        <div
          className="flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
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
                  className="h-6 w-6"
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
                    {STATUS_ORDER.map((s) => (
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

      {/* Meta row: due date, category, priority, chips */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {task.dueDate && (
          <span className="text-xs text-muted-foreground">Due {task.dueDate}</span>
        )}
        <span className="text-xs text-muted-foreground">{CATEGORY_LABEL[task.category]}</span>
        <Badge variant={PRIORITY_BADGE_VARIANT[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>
        {task.jiraUrl && <LinkChip label="Jira" url={task.jiraUrl} />}
        {task.slackUrl && <LinkChip label="Slack" url={task.slackUrl} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BoardColumn
// ---------------------------------------------------------------------------

interface BoardColumnProps {
  status: TaskStatus
  tasks: Task[]
  isDragOver: boolean
  onDragEnter: () => void
  onDragLeave: () => void
  onDrop: (status: TaskStatus, e: React.DragEvent<HTMLDivElement>) => void
  onEdit: (task: Task) => void
  onDelete: (id: number) => void
  confirmDelete: ReturnType<typeof useConfirmDelete>
}

function BoardColumn({
  status,
  tasks,
  isDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onEdit,
  onDelete,
  confirmDelete,
}: BoardColumnProps): React.ReactElement {
  function handleDragOver(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    onDrop(status, e)
  }

  return (
    <div className="flex-1 min-w-[240px] flex flex-col h-full">
      {/* Column header */}
      <div className="flex items-center gap-2 px-1 pb-2 flex-shrink-0">
        <h2 className="text-sm font-semibold text-foreground">{STATUS_LABEL[status]}</h2>
        <Badge variant={STATUS_BADGE_VARIANT[status]}>{tasks.length}</Badge>
      </div>

      {/* Column body — drop target */}
      <div
        onDragOver={handleDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDrop={handleDrop}
        className={`flex-1 overflow-y-auto rounded-[var(--radius-card)] p-1.5 transition-shadow ${
          isDragOver ? 'ring-2 ring-primary/40' : ''
        }`}
      >
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-24 rounded-[var(--radius-card)] border border-dashed border-border text-xs text-muted-foreground">
            Drop tasks here
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={onEdit}
                onDelete={onDelete}
                confirmDelete={confirmDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TodosBoard
// ---------------------------------------------------------------------------

interface TodosBoardProps {
  tasks: Task[]
  onEdit: (task: Task) => void
  onDelete: (id: number) => void
  confirmDelete: ReturnType<typeof useConfirmDelete>
  onCreate: () => void
}

export default function TodosBoard({
  tasks,
  onEdit,
  onDelete,
  confirmDelete,
  onCreate,
}: TodosBoardProps): React.ReactElement {
  const { toast } = useToast()
  const { update } = useTasksStore()
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null)

  const tasksByStatus: Record<TaskStatus, Task[]> = {
    todo: [],
    in_progress: [],
    done: [],
  }
  for (const task of tasks) {
    tasksByStatus[task.status].push(task)
  }

  function handleDrop(columnStatus: TaskStatus, e: React.DragEvent<HTMLDivElement>): void {
    setDragOverStatus(null)
    const idRaw = e.dataTransfer.getData(DRAG_MIME)
    const id = Number(idRaw)
    if (!idRaw || Number.isNaN(id)) return

    const dragged = tasks.find((t) => t.id === id)
    if (!dragged || dragged.status === columnStatus) return

    update(id, { status: columnStatus }, toast)
  }

  if (tasks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-48 text-center px-6">
        <p className="text-sm font-medium text-foreground mb-1">No tasks here</p>
        <p className="text-xs text-muted-foreground mb-4">Create your first task to get started.</p>
        <Button size="sm" variant="outline" onClick={onCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New task
        </Button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex gap-4 overflow-x-auto px-6 pb-4 min-h-0">
      {STATUS_ORDER.map((status) => (
        <BoardColumn
          key={status}
          status={status}
          tasks={tasksByStatus[status]}
          isDragOver={dragOverStatus === status}
          onDragEnter={() => setDragOverStatus(status)}
          onDragLeave={() => setDragOverStatus((prev) => (prev === status ? null : prev))}
          onDrop={handleDrop}
          onEdit={onEdit}
          onDelete={onDelete}
          confirmDelete={confirmDelete}
        />
      ))}
    </div>
  )
}
