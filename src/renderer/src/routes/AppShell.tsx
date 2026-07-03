import React, { useState, useEffect, useCallback } from 'react'
import { NavLink, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Search, Sun, Moon, Monitor } from 'lucide-react'
import { useSessionStore } from '@/store/session'
import { useSettingsStore } from '@/store/settings'
import { useUiStore } from '@/store/ui'
import SettingsPage from './SettingsPage'
import TodosPage from '@/features/todos/TodosPage'
import NotesPage from '@/features/notes/NotesPage'
import SearchPalette from '@/features/search/SearchPalette'
import type { AppSettings } from '@shared/types'

// ---------------------------------------------------------------------------
// Theme icon helper
// ---------------------------------------------------------------------------

function ThemeIcon({ theme }: { theme: AppSettings['theme'] }): React.ReactElement {
  if (theme === 'dark') return <Moon className="h-3.5 w-3.5" />
  if (theme === 'light') return <Sun className="h-3.5 w-3.5" />
  return <Monitor className="h-3.5 w-3.5" />
}

const THEME_CYCLE: AppSettings['theme'][] = ['light', 'dark', 'system']
const THEME_TITLE: Record<AppSettings['theme'], string> = {
  light: 'Theme: Light (click for Dark)',
  dark: 'Theme: Dark (click for System)',
  system: 'Theme: System (click for Light)',
}

// ---------------------------------------------------------------------------
// Sidebar nav link
// ---------------------------------------------------------------------------

function SidebarLink({ to, children }: { to: string; children: React.ReactNode }): React.ReactElement {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center px-4 py-2 text-sm font-medium rounded mx-2 transition-colors ${
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground hover:bg-secondary'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------

export default function AppShell(): React.ReactElement {
  const { state, lock } = useSessionStore()
  const { settings, update: updateSettings } = useSettingsStore()
  const { fireNewTask, fireNewNote } = useUiStore()
  const navigate = useNavigate()
  const location = useLocation()

  const [searchOpen, setSearchOpen] = useState(false)

  // ---------------------------------------------------------------------------
  // Global keyboard shortcut handler
  //
  // Shortcuts that fire while typing:  Esc (handled by Radix), ⌘K
  // Shortcuts suppressed while typing: ⌘N, ⌘L, ⌘,
  // ---------------------------------------------------------------------------

  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    const isEditing =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable

    // ⌘K — open / toggle search (fires even while typing)
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setSearchOpen((prev) => !prev)
      return
    }

    // Suppress remaining shortcuts while editing
    if (isEditing) return

    // ⌘N — new task (on /todos) or new note (on /notes)
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault()
      if (location.pathname.startsWith('/notes')) {
        fireNewNote()
      } else {
        // Default: navigate to todos and open new-task dialog
        if (!location.pathname.startsWith('/todos')) {
          navigate('/todos')
        }
        fireNewTask()
      }
      return
    }

    // ⌘L — lock the datasource
    if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
      e.preventDefault()
      lock()
      return
    }

    // ⌘, — open Settings
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault()
      navigate('/settings')
      return
    }
  }, [location.pathname, navigate, lock, fireNewTask, fireNewNote])

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleGlobalKeyDown])

  // ---------------------------------------------------------------------------
  // Theme quick-toggle (cycles light → dark → system)
  // ---------------------------------------------------------------------------

  function handleThemeCycle(): void {
    const current = settings?.theme ?? 'system'
    const idx = THEME_CYCLE.indexOf(current)
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]
    updateSettings({ theme: next })
  }

  const currentTheme = settings?.theme ?? 'system'

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar — 48px, draggable */}
      <div className="app-drag h-12 flex items-center px-4 border-b border-border bg-card flex-shrink-0">
        {/* Traffic light gap for macOS hiddenInset title bar */}
        <div className="w-20 flex-shrink-0" />
        <span className="text-sm font-medium text-foreground truncate flex-1">
          {state.datasource?.label ?? ''}
        </span>
        <div className="app-no-drag flex items-center gap-2 flex-shrink-0">
          {/* Theme quick-toggle */}
          <button
            onClick={handleThemeCycle}
            className="flex items-center justify-center h-7 w-7 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            title={THEME_TITLE[currentTheme]}
            aria-label={`Current theme: ${currentTheme}. Click to cycle.`}
          >
            <ThemeIcon theme={currentTheme} />
          </button>

          {/* Search button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary transition-colors"
            title="Search (⌘K)"
            aria-label="Open search palette"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden sm:inline text-[10px] border border-border rounded px-1 py-0.5 ml-0.5">⌘K</kbd>
          </button>

          <button
            onClick={lock}
            className="text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1 rounded hover:bg-secondary transition-colors"
            title="Lock datasource (⌘L)"
          >
            Lock
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar — 208px */}
        <nav className="app-no-drag w-52 flex-shrink-0 bg-sidebar border-r border-sidebar-border py-2 flex flex-col">
          <SidebarLink to="/todos">Todos</SidebarLink>
          <SidebarLink to="/notes">Notes</SidebarLink>
          <SidebarLink to="/settings">Settings</SidebarLink>
        </nav>

        {/* Content area — scrollable */}
        <main className="app-no-drag flex-1 overflow-y-auto">
          <Routes>
            <Route index element={<Navigate to="/todos" replace />} />
            <Route path="todos" element={<TodosPage />} />
            <Route path="notes" element={<NotesPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/todos" replace />} />
          </Routes>
        </main>
      </div>

      {/* Global search palette — rendered outside the main layout so it can portal correctly */}
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
