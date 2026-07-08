/**
 * NotesPage.tsx — Tabbed Notes feature page.
 *
 * Layout (DESIGN_SYSTEM §6):
 *   Left panel (256px):
 *     - Header: "Notes" title + New dropdown (New note / New daily note / New bookmark)
 *     - Type tabs: All / Notes / Daily / Bookmarks — client-side display filter for the
 *       sidebar list only; does not affect which tabs are open
 *     - Scrollable note list (filtered) with pin indicator on rows; rows whose note is an
 *       open tab are highlighted, the active tab most strongly
 *   Right panel (flex-1):
 *     - Tab strip: one tab per open note (title + close ×); clicking a tab activates it
 *     - NoteEditor for the active tab's note, or an empty state when no tabs are open
 *
 * Daily note quick-create: creates a 'daily' note titled yyyy-mm-dd for today.
 * If one already exists for today, opens it as a tab instead of creating a duplicate.
 */

import React, { useEffect, useRef } from 'react'
import { Plus, Pin, FileText, BookOpen, Bookmark, ChevronDown, X } from 'lucide-react'
import type { NoteType, Note } from '@shared/types'
import { useNotesStore } from '@/store/notes'
import { useUiStore } from '@/store/ui'
import { useCategoriesStore } from '@/store/categories'
import { useToast } from '@/components/ToastProvider'
import { Button } from '@/components/ui/button'
import CategoryTag from '@/components/CategoryTag'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import NoteEditor from './NoteEditor'

// ---------------------------------------------------------------------------
// Category filter (sidebar display filter) — Radix Select disallows empty
// string item values, so "All" / "Uncategorized" use sentinel strings.
// ---------------------------------------------------------------------------

const ALL_CATEGORIES_VALUE = '__all__'
const UNCATEGORIZED_VALUE = '__uncategorized__'

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
// Type tabs config (sidebar display filter)
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
  open: boolean
  active: boolean
  onClick: () => void
}

function NoteListItem({ note, open, active, onClick }: NoteListItemProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-b border-border last:border-b-0 transition-colors ${
        active
          ? 'bg-accent text-accent-foreground'
          : open
            ? 'bg-secondary text-foreground'
            : 'hover:bg-muted/60 text-foreground'
      }`}
    >
      <div className="flex items-start gap-1.5">
        {/* Pin indicator */}
        {note.pinned && (
          <Pin
            className={`h-3 w-3 flex-shrink-0 mt-1 ${active ? 'text-accent-foreground' : 'text-primary'}`}
          />
        )}

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate leading-snug">
            {note.title || 'Untitled'}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-xs capitalize ${active ? 'text-accent-foreground/70' : 'text-muted-foreground'}`}>
              {note.type}
            </span>
            <span className={`text-xs ${active ? 'text-accent-foreground/60' : 'text-muted-foreground'}`}>
              {note.updatedAt.split('T')[0]}
            </span>
            <CategoryTag categoryId={note.categoryId} className={active ? 'text-accent-foreground/70' : ''} />
          </div>
        </div>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Tab strip
// ---------------------------------------------------------------------------

interface NoteTabProps {
  note: Note
  active: boolean
  onActivate: () => void
  onClose: () => void
}

function NoteTab({ note, active, onActivate, onClose }: NoteTabProps): React.ReactElement {
  const label = note.title || 'Untitled'

  function handleClose(e: React.MouseEvent): void {
    e.stopPropagation()
    onClose()
  }

  return (
    <button
      onClick={onActivate}
      title={label}
      className={`flex items-center gap-1.5 pl-3 pr-2 py-2 text-xs font-medium border-r border-border whitespace-nowrap transition-colors flex-shrink-0 ${
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-secondary'
      }`}
    >
      <span className="max-w-[140px] truncate">{label}</span>
      <span
        role="button"
        tabIndex={-1}
        onClick={handleClose}
        aria-label={`Close ${label}`}
        title={`Close ${label}`}
        className="flex items-center justify-center h-4 w-4 rounded hover:bg-muted/80 flex-shrink-0"
      >
        <X className="h-3 w-3" />
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Empty state (no tabs open)
// ---------------------------------------------------------------------------

function EmptyState({ onNew }: { onNew: () => void }): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 bg-white">
      <FileText className="h-10 w-10 text-neutral-400 mb-3 opacity-40" />
      <p className="text-sm font-medium text-neutral-900 mb-1">No note open</p>
      <p className="text-xs text-neutral-500 mb-4">
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
  const {
    notes,
    filter,
    openTabIds,
    activeTabId,
    loading,
    load,
    setFilter,
    select,
    setActiveTab,
    closeTab,
    create,
  } = useNotesStore()
  const { categories } = useCategoriesStore()
  const newNoteSeq = useUiStore((s) => s.newNoteSeq)

  // Derive the active tab type / category from the current store filter
  const activeTabType = filter.type
  const activeCategoryId = filter.categoryId // undefined = All, null = Uncategorized, number = a category id

  // Load notes on mount
  useEffect(() => {
    load().catch(e => toast(e instanceof Error ? e.message : 'Failed to load notes', 'error'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Create a new note when the ⌘N shortcut fires from AppShell.
  const lastNewNoteSeqRef = useRef(newNoteSeq)
  useEffect(() => {
    if (newNoteSeq === lastNewNoteSeqRef.current) return
    lastNewNoteSeqRef.current = newNoteSeq
    handleNewNote()
  }, [newNoteSeq]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Sidebar type filter (client-side; does not affect open tabs)
  // ---------------------------------------------------------------------------

  function handleTabChange(type: NoteType | undefined): void {
    setFilter({ ...filter, type })
  }

  function handleCategoryFilterChange(v: string): void {
    const categoryId = v === ALL_CATEGORIES_VALUE ? undefined : v === UNCATEGORIZED_VALUE ? null : Number(v)
    setFilter({ ...filter, categoryId })
  }

  const visibleNotes = notes.filter(n => {
    if (activeTabType !== undefined && n.type !== activeTabType) return false
    if (activeCategoryId !== undefined) {
      if (activeCategoryId === null ? n.categoryId !== null : n.categoryId !== activeCategoryId) return false
    }
    return true
  })

  // ---------------------------------------------------------------------------
  // New note actions
  // ---------------------------------------------------------------------------

  function handleNewNote(): void {
    create({ title: 'Untitled note', type: 'note' }, toast).catch(() => {})
  }

  function handleNewDailyNote(): void {
    const today = todayIso()

    // If a daily note for today already exists, open it as a tab instead of
    // creating a duplicate (search the full list — tabs work regardless of
    // the sidebar's current type filter).
    const existing = notes.find(n => n.type === 'daily' && n.title === today)
    if (existing) {
      select(existing.id)
      return
    }

    create({ title: today, type: 'daily' }, toast).catch(() => {})
  }

  function handleNewBookmark(): void {
    create({ title: 'New bookmark', type: 'bookmark' }, toast).catch(() => {})
  }

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const activeNote = notes.find(n => n.id === activeTabId) ?? null

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

        {/* Category filter */}
        <div className="px-2 pb-2 flex-shrink-0">
          <Select
            value={
              activeCategoryId === undefined
                ? ALL_CATEGORIES_VALUE
                : activeCategoryId === null
                  ? UNCATEGORIZED_VALUE
                  : String(activeCategoryId)
            }
            onValueChange={handleCategoryFilterChange}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES_VALUE}>All categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
              ))}
              <SelectItem value={UNCATEGORIZED_VALUE}>Uncategorized</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
              Loading…
            </div>
          ) : visibleNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-center px-4">
              <p className="text-xs text-muted-foreground">No notes yet.</p>
            </div>
          ) : (
            visibleNotes.map(note => (
              <NoteListItem
                key={note.id}
                note={note}
                open={openTabIds.includes(note.id)}
                active={note.id === activeTabId}
                onClick={() => select(note.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right panel — tab strip + editor or empty state ──────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {openTabIds.length > 0 && (
          <div className="flex items-stretch border-b border-border bg-card overflow-x-auto flex-shrink-0">
            {openTabIds.map(id => {
              const note = notes.find(n => n.id === id)
              if (!note) return null
              return (
                <NoteTab
                  key={id}
                  note={note}
                  active={id === activeTabId}
                  onActivate={() => setActiveTab(id)}
                  onClose={() => closeTab(id)}
                />
              )
            })}
          </div>
        )}

        <div className="flex-1 min-h-0">
          {activeNote ? (
            <NoteEditor note={activeNote} />
          ) : (
            <EmptyState onNew={handleNewNote} />
          )}
        </div>
      </div>
    </div>
  )
}
