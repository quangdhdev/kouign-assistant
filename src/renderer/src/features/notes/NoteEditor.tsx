/**
 * NoteEditor.tsx — Editor pane for a single note.
 *
 * Features:
 *   - Title input + markdown-source textarea body (no live preview — post-MVP)
 *   - Debounced autosave (~500 ms) on title / body / url change → store.update
 *   - Pin toggle button
 *   - Delete with inline confirm
 *   - Bookmark type: shows a URL field + open-in-browser button
 *
 * When `note.id` changes (user selected a different note), the editor resets
 * its local form state and cancels any pending autosave timer.
 */

import React, { useState, useEffect, useRef } from 'react'
import { Pin, PinOff, Trash2, ExternalLink } from 'lucide-react'
import type { Note, UpdateNoteInput } from '@shared/types'
import { useNotesStore } from '@/store/notes'
import { useToast } from '@/components/ToastProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NoteEditorProps {
  note: Note
}

export default function NoteEditor({ note }: NoteEditorProps): React.ReactElement {
  const { toast } = useToast()
  const { update, togglePin, remove } = useNotesStore()

  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [url, setUrl] = useState(note.url ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset local state when switching to a different note; cancel pending autosave.
  useEffect(() => {
    setTitle(note.title)
    setContent(note.content)
    setUrl(note.url ?? '')
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
  // Field change handlers
  // ---------------------------------------------------------------------------

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const val = e.target.value
    setTitle(val)
    scheduleSave({ title: val, content, url: url || null })
  }

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    const val = e.target.value
    setContent(val)
    scheduleSave({ title, content: val, url: url || null })
  }

  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const val = e.target.value
    setUrl(val)
    scheduleSave({ title, content, url: val || null })
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  function handleOpenUrl(): void {
    if (url) window.api.shell.openExternal(url)
  }

  function handleTogglePin(): void {
    togglePin(note.id, toast)
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
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-border flex-shrink-0">
        {/* Left: pin + type badge */}
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleTogglePin}
            title={note.pinned ? 'Unpin note' : 'Pin note'}
            className="h-7 w-7"
          >
            {note.pinned
              ? <Pin className="h-4 w-4 text-primary" />
              : <PinOff className="h-4 w-4 text-muted-foreground" />}
          </Button>
          <span className="text-xs font-medium text-muted-foreground capitalize">{note.type}</span>
        </div>

        {/* Right: delete with confirm */}
        <div className="flex items-center gap-1.5">
          {confirmDelete ? (
            <>
              <span className="text-xs text-muted-foreground mr-1">Delete this note?</span>
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
                className="h-7 px-2 text-xs"
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
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Editor body — scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
        {/* Title */}
        <Input
          value={title}
          onChange={handleTitleChange}
          placeholder="Note title…"
          aria-label="Note title"
          className="text-base font-semibold border-0 border-b border-border rounded-none px-0 shadow-none focus-visible:ring-0 focus-visible:border-primary h-auto py-1.5"
        />

        {/* URL field — bookmarks only */}
        {note.type === 'bookmark' && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note-url" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              URL
            </Label>
            <div className="flex gap-2">
              <Input
                id="note-url"
                type="url"
                value={url}
                onChange={handleUrlChange}
                placeholder="https://…"
                className="flex-1"
              />
              {url && (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={handleOpenUrl}
                  title="Open in browser"
                  className="h-8 w-8 flex-shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Content — markdown source */}
        <div className="flex flex-col gap-1.5 flex-1">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Content
            <span className="ml-1 font-normal normal-case text-muted-foreground/60">(markdown)</span>
          </Label>
          <Textarea
            value={content}
            onChange={handleContentChange}
            placeholder="Start writing… (markdown supported)"
            aria-label="Note content"
            className="font-mono text-sm resize-none min-h-[320px] flex-1"
            rows={18}
          />
        </div>
      </div>
    </div>
  )
}
