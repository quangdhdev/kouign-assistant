/**
 * NotesPage.tsx — Master–detail Notes feature page.
 *
 * Layout (DESIGN_SYSTEM §6):
 *   Left panel (256px):
 *     - Header: "Notes" title + New dropdown (New note / New daily note / New bookmark)
 *     - Type tabs: All / Notes / Daily / Bookmarks — drives store.setFilter
 *     - Scrollable note list with pin indicator on rows; selected row highlighted
 *   Right panel (flex-1):
 *     - NoteEditor for the selected note, or an empty state
 *
 * Daily note quick-create: creates a 'daily' note titled yyyy-mm-dd for today.
 * If one already exists for today, selects it instead of creating a duplicate.
 */

import React, { useEffect } from 'react'
import { Plus, Pin, FileText, BookOpen, Bookmark, ChevronDown } from 'lucide-react'
import type { NoteType } from '@shared/types'
import type { Note } from '@shared/types'
import { useNotesStore } from '@/store/notes'
import { useToast } from '@/components/ToastProvider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import NoteEditor from './NoteEditor'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns today's date as yyyy-mm-dd in local time. */
function todayIso(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ---------------------------------------------------------------------------
// Type tabs config
// ---------------------------------------------------------------------------

interface TypeTabConfig {
  label: string
  type: NoteType | undefined
}

const TYPE_TABS: TypeTabConfig[] = [
  { label: 'All', type: undefined },
  { label: 'Notes', type: 'note' },
  { label: 'Daily', type: 'daily' },
  { label: 'Bookmarks', type: 'bookmark' },
]

// ---------------------------------------------------------------------------
// Note list item
// ---------------------------------------------------------------------------

interface NoteListItemProps {
  note: Note
  selected: boolean
  onClick: () => void
}

function NoteListItem({ note, selected, onClick }: NoteListItemProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-b border-border last:border-b-0 transition-colors ${
        selected
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-muted/60 text-foreground'
      }`}
    >
      <div className="flex items-start gap-1.5">
        {/* Pin indicator */}
        {note.pinned && (
          <Pin
            className={`h-3 w-3 flex-shrink-0 mt-1 ${selected ? 'text-accent-foreground' : 'text-primary'}`}
          />
        )}

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate leading-snug">
            {note.title || 'Untitled'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs capitalize ${selected ? 'text-accent-foreground/70' : 'text-muted-foreground'}`}>
              {note.type}
            </span>
            <span className={`text-xs ${selected ? 'text-accent-foreground/60' : 'text-muted-foreground'}`}>
              {note.updatedAt.split('T')[0]}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Empty state (no note selected)
// ---------------------------------------------------------------------------

function EmptyState({ onNew }: { onNew: () => void }): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <FileText className="h-10 w-10 text-muted-foreground mb-3 opacity-40" />
      <p className="text-sm font-medium text-foreground mb-1">No note selected</p>
      <p className="text-xs text-muted-foreground mb-4">
        Select a note from the list or create a new one.
      </p>
      <Button size="sm" variant="outline" onClick={onNew} className="gap-1.5">
        <Plus className="h-4 w-4" />
        New note
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function NotesPage(): React.ReactElement {
  const { toast } = useToast()
  const { notes, filter, selectedId, loading, load, setFilter, select, create } = useNotesStore()

  // Derive the active tab type from the current store filter
  const activeTabType = filter.type

  // Load notes on mount
  useEffect(() => {
    load().catch(e => toast(e instanceof Error ? e.message : 'Failed to load notes', 'error'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Tab change
  // ---------------------------------------------------------------------------

  function handleTabChange(type: NoteType | undefined): void {
    setFilter(type !== undefined ? { type } : {}).catch(
      e => toast(e instanceof Error ? e.message : 'Failed to filter notes', 'error')
    )
  }

  // ---------------------------------------------------------------------------
  // New note actions
  // ---------------------------------------------------------------------------

  function handleNewNote(): void {
    create({ title: 'Untitled note', type: 'note' }, toast).catch(() => {})
  }

  function handleNewDailyNote(): void {
    const today = todayIso()

    // If a daily note for today already exists anywhere in the loaded list
    // (search across all types, not just the current filter), select it.
    // We load all notes to detect duplicates: use the store's full list which
    // may be filtered. To be safe, we reload without filter or just search the
    // existing list and let the user navigate if not visible.
    const existing = notes.find(n => n.type === 'daily' && n.title === today)
    if (existing) {
      // If we're on a filter that hides dailies, switch to All first
      if (filter.type !== undefined && filter.type !== 'daily') {
        setFilter({})
          .then(() => select(existing.id))
          .catch(e => toast(e instanceof Error ? e.message : 'Failed to switch filter', 'error'))
      } else {
        select(existing.id)
      }
      return
    }

    create({ title: today, type: 'daily' }, toast).catch(() => {})
  }

  function handleNewBookmark(): void {
    create({ title: 'New bookmark', type: 'bookmark', url: '' }, toast).catch(() => {})
  }

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const selectedNote = notes.find(n => n.id === selectedId) ?? null

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-full">
      {/* ── Left panel — note list ─────────────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 flex flex-col border-r border-border bg-card">
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-4 pb-2 flex-shrink-0">
          <h1 className="text-sm font-semibold text-foreground">Notes</h1>

          {/* New note dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1 h-7 px-2 text-xs app-no-drag">
                <Plus className="h-3.5 w-3.5" />
                New
                <ChevronDown className="h-3 w-3 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={handleNewNote}>
                <FileText className="mr-2 h-4 w-4" />
                New note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleNewDailyNote}>
                <BookOpen className="mr-2 h-4 w-4" />
                New daily note
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleNewBookmark}>
                <Bookmark className="mr-2 h-4 w-4" />
                New bookmark
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Type tabs */}
        <div className="flex px-2 gap-0.5 pb-2 flex-shrink-0">
          {TYPE_TABS.map(tab => (
            <button
              key={tab.label}
              onClick={() => handleTabChange(tab.type)}
              className={`flex-1 py-1 text-xs font-medium rounded transition-colors ${
                activeTabType === tab.type
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
              Loading…
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-center px-4">
              <p className="text-xs text-muted-foreground">No notes yet.</p>
            </div>
          ) : (
            notes.map(note => (
              <NoteListItem
                key={note.id}
                note={note}
                selected={note.id === selectedId}
                onClick={() => select(note.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right panel — editor or empty state ──────────────────────────── */}
      <div className="flex-1 min-w-0">
        {selectedNote ? (
          <NoteEditor note={selectedNote} />
        ) : (
          <EmptyState onNew={handleNewNote} />
        )}
      </div>
    </div>
  )
}
