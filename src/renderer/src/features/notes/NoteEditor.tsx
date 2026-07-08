/**
 * NoteEditor.tsx — Editor pane for the active tab's note.
 *
 * Features:
 *   - Plain notes (`type: 'note'`): no separate title field — the first line of
 *     `content` is the header (rendered as a title-styled single-line input); the
 *     rest of `content` is the markdown body. Editing the header re-derives the
 *     DB `title` column (leading markdown `#` markers stripped) so search, the
 *     sidebar list, and the tab label stay in sync.
 *   - Daily notes & bookmarks: separate title `Input` + a full-content markdown
 *     textarea (no dedicated URL field — links just go in the body, Notion-style).
 *   - Debounced autosave (~500 ms) on any field change → store.update
 *   - Pin toggle button
 *   - Delete with inline confirm
 *   - The editor canvas always renders on a fixed white surface (Notion-style
 *     paper), regardless of the app's light/dark theme.
 *
 * When `note.id` changes (user switched tabs), the editor resets its local
 * form state and cancels any pending autosave timer.
 */

import React, { useState, useEffect, useRef } from 'react'
import { Pin, PinOff, Trash2 } from 'lucide-react'
import type { Note, UpdateNoteInput } from '@shared/types'
import { useNotesStore } from '@/store/notes'
import { useToast } from '@/components/ToastProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import CategorySelect from '@/components/CategorySelect'

// Blends the (otherwise theme-following) CategorySelect trigger into the
// editor's always-white canvas, matching the title/body field treatment.
const CATEGORY_TRIGGER_CLASS =
  'h-7 w-auto min-w-[120px] text-xs bg-transparent border-neutral-200 text-neutral-900 shadow-none'

// ---------------------------------------------------------------------------
// First-line header helpers (plain notes only)
// ---------------------------------------------------------------------------

/** Split content into the first line (header) and the rest (body). */
function splitContent(content: string): { header: string; body: string } {
  const nl = content.indexOf('\n')
  return nl === -1
    ? { header: content, body: '' }
    : { header: content.slice(0, nl), body: content.slice(nl + 1) }
}

/** Derive the DB `title` from the first-line header (strip leading markdown `#`s). */
function deriveTitle(header: string): string {
  return header.replace(/^#{1,6}\s*/, '').trim() || 'Untitled'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NoteEditorProps {
  note: Note
}

export default function NoteEditor({ note }: NoteEditorProps): React.ReactElement {
  const { toast } = useToast()
  const { update, togglePin, remove } = useNotesStore()

  const isPlainNote = note.type === 'note'

  const [title, setTitle] = useState(note.title)       // daily / bookmark only
  const [content, setContent] = useState(note.content)  // full markdown source (all types)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset local state when switching to a different note; cancel pending autosave.
  useEffect(() => {
    setTitle(note.title)
    setContent(note.content)
    setConfirmDelete(false)

    return () => {
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [note.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Autosave scheduler — debounced 500 ms
  // ---------------------------------------------------------------------------

  function scheduleSave(patch: UpdateNoteInput): void {
    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      update(note.id, patch, toast)
    }, 500)
  }

  // ---------------------------------------------------------------------------
  // Plain note: first-line header + body — both derived from `content`
  // ---------------------------------------------------------------------------

  const { header, body } = splitContent(content)

  function handleHeaderChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const newHeader = e.target.value
    const nextContent = body.length ? `${newHeader}\n${body}` : newHeader
    setContent(nextContent)
    scheduleSave({ title: deriveTitle(newHeader), content: nextContent })
  }

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    const newBody = e.target.value
    const nextContent = newBody.length ? `${header}\n${newBody}` : header
    setContent(nextContent)
    scheduleSave({ title: deriveTitle(header), content: nextContent })
  }

  // ---------------------------------------------------------------------------
  // Daily / bookmark: separate title field + full content
  // ---------------------------------------------------------------------------

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const val = e.target.value
    setTitle(val)
    scheduleSave({ title: val, content })
  }

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    const val = e.target.value
    setContent(val)
    scheduleSave({ title, content: val })
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  function handleTogglePin(): void {
    togglePin(note.id, toast)
  }

  function handleCategoryChange(categoryId: number | null): void {
    update(note.id, { categoryId }, toast)
  }

  function handleDelete(): void {
    // Cancel any pending autosave before deleting
    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    remove(note.id, toast)
  }

  // ---------------------------------------------------------------------------
  // Render — always a fixed white canvas (Notion-style paper), independent of
  // the app's light/dark theme.
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full bg-white text-neutral-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-neutral-200 flex-shrink-0">
        {/* Left: pin + type badge */}
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleTogglePin}
            title={note.pinned ? 'Unpin note' : 'Pin note'}
            className="h-7 w-7 hover:bg-neutral-100"
          >
            {note.pinned
              ? <Pin className="h-4 w-4 text-primary" />
              : <PinOff className="h-4 w-4 text-neutral-400" />}
          </Button>
          <span className="text-xs font-medium text-neutral-500 capitalize">{note.type}</span>
          <CategorySelect
            value={note.categoryId}
            onChange={handleCategoryChange}
            triggerClassName={CATEGORY_TRIGGER_CLASS}
          />
        </div>

        {/* Right: delete with confirm */}
        <div className="flex items-center gap-1.5">
          {confirmDelete ? (
            <>
              <span className="text-xs text-neutral-500 mr-1">Delete this note?</span>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 px-2 text-xs"
                onClick={handleDelete}
              >
                Yes, delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs hover:bg-neutral-100"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              title="Delete note"
              className="h-7 w-7 text-neutral-400 hover:text-destructive hover:bg-neutral-100"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Editor body — scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
        {/* Title — plain notes: first-line header; daily/bookmark: separate title field */}
        {isPlainNote ? (
          <Input
            value={header}
            onChange={handleHeaderChange}
            placeholder="Note title (first line)…"
            aria-label="Note title (first line)"
            className="text-base font-semibold border-0 border-b border-neutral-200 rounded-none px-0 shadow-none bg-transparent text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-0 focus-visible:border-primary h-auto py-1.5"
          />
        ) : (
          <Input
            value={title}
            onChange={handleTitleChange}
            placeholder="Note title…"
            aria-label="Note title"
            className="text-base font-semibold border-0 border-b border-neutral-200 rounded-none px-0 shadow-none bg-transparent text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-0 focus-visible:border-primary h-auto py-1.5"
          />
        )}

        {/* Content — markdown source */}
        <div className="flex flex-col gap-1.5 flex-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {isPlainNote ? 'Body' : 'Content'}
            <span className="ml-1 font-normal normal-case text-neutral-400">(markdown)</span>
          </Label>
          <Textarea
            value={isPlainNote ? body : content}
            onChange={isPlainNote ? handleBodyChange : handleContentChange}
            placeholder="Start writing… (markdown supported)"
            aria-label={isPlainNote ? 'Note body' : 'Note content'}
            className="font-mono text-sm resize-none min-h-[320px] flex-1 bg-transparent text-neutral-900 placeholder:text-neutral-400 border-neutral-200 shadow-none"
            rows={18}
          />
        </div>
      </div>
    </div>
  )
}
