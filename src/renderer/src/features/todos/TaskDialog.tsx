/**
 * TaskDialog.tsx — Create / edit task in a shadcn Dialog.
 *
 * Pass `task` to edit; omit to create. `onSave` is called with the persisted
 * task after the IPC round-trip succeeds. The dialog closes itself on success
 * or when the user hits Cancel / the X button.
 */

import React, { useState, useEffect } from 'react'
import type { Task, TaskStatus, TaskPriority, TaskCategory } from '@shared/types'
import { useToast } from '@/components/ToastProvider'
import { useTasksStore } from '@/store/tasks'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { STATUS_LABEL, PRIORITY_LABEL, CATEGORY_LABEL } from './meta'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Provide a task to edit; omit to create. */
  task?: Task | null
  onSaved?: () => void
}

// ---------------------------------------------------------------------------
// Form state defaults
// ---------------------------------------------------------------------------

interface FormState {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  category: TaskCategory
  dueDate: string
  jiraUrl: string
  slackUrl: string
}

function defaultForm(task?: Task | null): FormState {
  return {
    title:       task?.title        ?? '',
    description: task?.description  ?? '',
    status:      task?.status       ?? 'todo',
    priority:    task?.priority     ?? 'medium',
    category:    task?.category     ?? 'personal',
    dueDate:     task?.dueDate      ?? '',
    jiraUrl:     task?.jiraUrl      ?? '',
    slackUrl:    task?.slackUrl     ?? '',
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TaskDialog({ open, onOpenChange, task, onSaved }: TaskDialogProps): React.ReactElement {
  const { toast } = useToast()
  const { create, update } = useTasksStore()
  const isEdit = !!task

  const [form, setForm] = useState<FormState>(defaultForm(task))
  const [titleError, setTitleError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Reset form when dialog opens or task changes
  useEffect(() => {
    if (open) {
      setForm(defaultForm(task))
      setTitleError(null)
    }
  }, [open, task])

  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm(prev => ({ ...prev, [key]: value }))
    if (key === 'title') setTitleError(null)
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()

    const trimmedTitle = form.title.trim()
    if (!trimmedTitle) {
      setTitleError('Title is required.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        title:       trimmedTitle,
        description: form.description.trim() || null,
        status:      form.status,
        priority:    form.priority,
        category:    form.category,
        dueDate:     form.dueDate || null,
        jiraUrl:     form.jiraUrl.trim() || null,
        slackUrl:    form.slackUrl.trim() || null,
      }

      if (isEdit && task) {
        await update(task.id, payload, toast)
      } else {
        await create(payload, toast)
      }

      onOpenChange(false)
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit task' : 'New task'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title">Title *</Label>
            <Input
              id="task-title"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
            />
            {titleError && (
              <p className="text-xs text-destructive">{titleError}</p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Optional details…"
              rows={3}
            />
          </div>

          {/* Status / Priority / Category — three columns */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['todo', 'in_progress', 'done'] as const).map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => set('priority', v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['low', 'medium', 'high'] as const).map(p => (
                    <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => set('category', v as TaskCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['personal', 'company'] as const).map(c => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due date */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-due">Due date</Label>
            <Input
              id="task-due"
              type="date"
              value={form.dueDate}
              onChange={e => set('dueDate', e.target.value)}
            />
          </div>

          {/* Jira URL */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-jira">Jira URL</Label>
            <Input
              id="task-jira"
              type="url"
              value={form.jiraUrl}
              onChange={e => set('jiraUrl', e.target.value)}
              placeholder="https://your-org.atlassian.net/browse/PROJ-123"
            />
          </div>

          {/* Slack URL */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-slack">Slack URL</Label>
            <Input
              id="task-slack"
              type="url"
              value={form.slackUrl}
              onChange={e => set('slackUrl', e.target.value)}
              placeholder="https://app.slack.com/…"
            />
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
