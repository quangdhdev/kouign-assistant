import React, { useState, useEffect, useCallback } from 'react'
import { NavLink, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import {
  Search,
  Sun,
  Moon,
  Monitor,
  ListTodo,
  StickyNote,
  Settings as SettingsIcon,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react'
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
// Sidebar nav model
// ---------------------------------------------------------------------------

const SIDEBAR_COLLAPSED_KEY = 'kouign.sidebar.collapsed'

const NAV_ITEMS: Array<{ to: string; label: string; Icon: LucideIcon }> = [
  { to: '/todos', label: 'Todos', Icon: ListTodo },
  { to: '/notes', label: 'Notes', Icon: StickyNote },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
]

function SidebarLink({
  to,
  label,
  Icon,
  collapsed,
}: {
  to: string
  label: string
  Icon: LucideIcon
  collapsed: boolean
}): React.ReactElement {
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) =>
        `flex items-center w-full py-3 text-sm font-medium transition-colors ${
          collapsed ? 'justify-center px-2' : 'gap-2 px-4'
        } ${
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground hover:bg-secondary'
        }`
      }
    >
      <Icon className="size-6 flex-shrink-0" />
      <span className={collapsed ? 'sr-only' : ''}>{label}</span>
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

  // Sidebar collapse — read synchronously so there's no expand→collapse flash on load.
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
  )

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed))
  }, [sidebarCollapsed])

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
        {/* Left sidebar — 208px expanded / 56px collapsed */}
        <nav
          className={`app-no-drag flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col transition-[width] duration-150 ${
            sidebarCollapsed ? 'w-14' : 'w-52'
          }`}
        >
          <div className="flex-1 flex flex-col">
            {NAV_ITEMS.map(({ to, label, Icon }) => (
              <SidebarLink key={to} to={to} label={label} Icon={Icon} collapsed={sidebarCollapsed} />
            ))}
          </div>

          <button
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`flex items-center w-full py-3 text-sidebar-foreground hover:bg-secondary transition-colors ${
              sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-4'
            }`}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="size-6 flex-shrink-0" />
            ) : (
              <PanelLeftClose className="size-6 flex-shrink-0" />
            )}
          </button>
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
