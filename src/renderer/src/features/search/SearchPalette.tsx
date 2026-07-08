/**
 * SearchPalette.tsx — Global ⌘K command palette for full-text search.
 *
 * Renders a dialog-style overlay with:
 *  - A search input at the top (auto-focused)
 *  - Results grouped by Tasks and Notes with bm25 snippets
 *  - Keyboard navigation: ↑↓ to move, Enter to select, Escape to close
 *  - On select: navigate to /todos (open edit dialog) or /notes (select note)
 *
 * Uses @radix-ui/react-dialog primitives directly for focus-trap + Escape
 * handling without the opinionated styling of the shadcn DialogContent wrapper.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Search, FileText, CheckSquare, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { SearchResult } from '@shared/types'
import { useSearchStore } from '@/store/search'
import { useTasksStore } from '@/store/tasks'
import { useNotesStore } from '@/store/notes'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Snippet renderer — parses <mark>…</mark> markers from FTS5 snippet()
// ---------------------------------------------------------------------------

function SnippetText({ raw }: { raw: string }): React.ReactElement {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  const re = /<mark>([\s\S]*?)<\/mark>/g
  let m: RegExpExecArray | null
  let key = 0

  while ((m = re.exec(raw)) !== null) {
    if (m.index > lastIndex) {
      parts.push(<span key={key++}>{raw.slice(lastIndex, m.index)}</span>)
    }
    parts.push(
      <span
        key={key++}
        className="bg-yellow-200 dark:bg-yellow-700 text-foreground rounded-sm px-0.5"
      >
        {m[1]}
      </span>
    )
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < raw.length) {
    parts.push(<span key={key++}>{raw.slice(lastIndex)}</span>)
  }

  return <>{parts}</>
}

// ---------------------------------------------------------------------------
// Result row
// ---------------------------------------------------------------------------

interface ResultRowProps {
  result: SearchResult
  active: boolean
  onPointerEnter: () => void
  onSelect: () => void
  rowRef?: React.Ref<HTMLButtonElement>
}

function ResultRow({ result, active, onPointerEnter, onSelect, rowRef }: ResultRowProps): React.ReactElement {
  const title = result.kind === 'task' ? result.task.title : result.note.title
  const meta  = result.kind === 'task'
    ? `${result.task.status} · ${result.task.category}`
    : result.note.type

  return (
    <button
      ref={rowRef}
      onPointerEnter={onPointerEnter}
      onClick={onSelect}
      className={cn(
        'w-full text-left flex items-start gap-3 px-4 py-2.5 transition-colors focus:outline-none',
        active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60'
      )}
    >
      {/* Icon */}
      <div className={cn('flex-shrink-0 mt-0.5', active ? 'text-accent-foreground' : 'text-muted-foreground')}>
        {result.kind === 'task'
          ? <CheckSquare className="h-4 w-4" />
          : <FileText className="h-4 w-4" />
        }
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium truncate', active ? 'text-accent-foreground' : 'text-foreground')}>
          {title}
        </p>
        <p className={cn('text-xs mt-0.5 line-clamp-2', active ? 'text-accent-foreground/70' : 'text-muted-foreground')}>
          <SnippetText raw={result.snippet} />
        </p>
        <p className={cn('text-[11px] mt-0.5 capitalize', active ? 'text-accent-foreground/60' : 'text-muted-foreground/70')}>
          {meta}
        </p>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Group header
// ---------------------------------------------------------------------------

function GroupHeader({ label, count }: { label: string; count: number }): React.ReactElement {
  return (
    <div className="px-4 py-1.5 flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-[11px] text-muted-foreground/60">{count}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main palette
// ---------------------------------------------------------------------------

interface SearchPaletteProps {
  open: boolean
  onClose: () => void
}

export default function SearchPalette({ open, onClose }: SearchPaletteProps): React.ReactElement {
  const navigate = useNavigate()
  const { query, results, loading, setQuery, clear } = useSearchStore()
  const { setOpenEditId, load: loadTasks } = useTasksStore()
  const { select: selectNote, setFilter: setNotesFilter } = useNotesStore()

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(-1)

  // Split results into groups for display — keep original order (already bm25-sorted).
  const taskResults  = useMemo(() => results.filter(r => r.kind === 'task'), [results])
  const noteResults  = useMemo(() => results.filter(r => r.kind === 'note'), [results])

  // Flat ordered list matching the rendered order (tasks first, then notes).
  const flatResults  = useMemo<SearchResult[]>(() => [...taskResults, ...noteResults], [taskResults, noteResults])

  // Reset active index whenever results change.
  useEffect(() => {
    setActiveIndex(-1)
  }, [results])

  // Clear and reset when palette opens/closes.
  useEffect(() => {
    if (open) {
      // Small delay so input is visible before focus.
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      clear()
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll active row into view.
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return
    const el = listRef.current.querySelector(`[data-idx="${activeIndex}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // ---------------------------------------------------------------------------
  // Navigation + selection
  // ---------------------------------------------------------------------------

  const handleSelect = useCallback((result: SearchResult) => {
    onClose()
    if (result.kind === 'task') {
      // Signal TodosPage to open the edit dialog for this task, then navigate.
      setOpenEditId(result.task.id)
      // Trigger a load so the task is in the list (may already be there).
      loadTasks().catch(() => {})
      navigate('/todos')
    } else {
      // Navigate to notes and open the note as a tab.
      // setFilter({}) clears the sidebar's type filter so the note is visible in the list too.
      setNotesFilter({})
      selectNote(result.note.id)
      navigate('/notes')
    }
  }, [onClose, setOpenEditId, loadTasks, navigate, setNotesFilter, selectNote])

  // ---------------------------------------------------------------------------
  // Keyboard handler (attached to the content div, not the input, so it captures
  // arrows even when the results list is focused via pointer).
  // ---------------------------------------------------------------------------

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, flatResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && flatResults[activeIndex]) {
        handleSelect(flatResults[activeIndex])
      }
    }
    // Escape is handled by Radix Dialog.
  }, [activeIndex, flatResults, handleSelect])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Palette panel */}
        <DialogPrimitive.Content
          onKeyDown={handleKeyDown}
          className="fixed left-[50%] top-[15%] z-50 w-full max-w-2xl -translate-x-1/2 bg-card border border-border rounded-[var(--radius-card)] shadow-2xl overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          aria-label="Search"
        >
          {/* Required accessible title (visually hidden) */}
          <DialogPrimitive.Title className="sr-only">Search tasks and notes</DialogPrimitive.Title>

          {/* Search input row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            {loading
              ? <Loader2 className="h-4 w-4 flex-shrink-0 text-muted-foreground animate-spin" />
              : <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            }
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setActiveIndex(-1) }}
              placeholder="Search tasks and notes…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button
                onClick={() => { setQuery(''); inputRef.current?.focus() }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                tabIndex={-1}
                aria-label="Clear search"
              >
                Clear
              </button>
            )}
            <kbd className="flex-shrink-0 text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
              Esc
            </kbd>
          </div>

          {/* Results */}
          <div
            ref={listRef}
            className="max-h-[420px] overflow-y-auto"
            role="listbox"
            aria-label="Search results"
          >
            {query.trim() === '' ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Type to search across all tasks and notes</p>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-muted-foreground">No results for <strong className="text-foreground">{query}</strong></p>
              </div>
            ) : (
              <div>
                {/* Tasks group */}
                {taskResults.length > 0 && (
                  <div>
                    <GroupHeader label="Tasks" count={taskResults.length} />
                    {taskResults.map((result, i) => {
                      const flatIdx = i  // tasks are first in flatResults
                      return (
                        <div key={result.kind === 'task' ? result.task.id : i} data-idx={flatIdx} role="option" aria-selected={activeIndex === flatIdx}>
                          <ResultRow
                            result={result}
                            active={activeIndex === flatIdx}
                            onPointerEnter={() => setActiveIndex(flatIdx)}
                            onSelect={() => handleSelect(result)}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Notes group */}
                {noteResults.length > 0 && (
                  <div className={taskResults.length > 0 ? 'border-t border-border' : ''}>
                    <GroupHeader label="Notes" count={noteResults.length} />
                    {noteResults.map((result, i) => {
                      const flatIdx = taskResults.length + i
                      return (
                        <div key={result.kind === 'note' ? result.note.id : i} data-idx={flatIdx} role="option" aria-selected={activeIndex === flatIdx}>
                          <ResultRow
                            result={result}
                            active={activeIndex === flatIdx}
                            onPointerEnter={() => setActiveIndex(flatIdx)}
                            onSelect={() => handleSelect(result)}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer hint */}
          {results.length > 0 && (
            <div className="px-4 py-2 border-t border-border flex items-center gap-3 text-[11px] text-muted-foreground">
              <span><kbd className="border border-border rounded px-1 py-0.5">↑↓</kbd> navigate</span>
              <span><kbd className="border border-border rounded px-1 py-0.5">↵</kbd> open</span>
              <span><kbd className="border border-border rounded px-1 py-0.5">Esc</kbd> close</span>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
