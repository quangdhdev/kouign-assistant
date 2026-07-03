import React, { useState, useEffect, useCallback } from 'react'
import { NavLink, Routes, Route, Navigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useSessionStore } from '@/store/session'
import SettingsPage from './SettingsPage'
import TodosPage from '@/features/todos/TodosPage'
import NotesPage from '@/features/notes/NotesPage'
import SearchPalette from '@/features/search/SearchPalette'

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

export default function AppShell(): React.ReactElement {
  const { state, lock } = useSessionStore()
  const [searchOpen, setSearchOpen] = useState(false)

  // Register ⌘K (macOS) / Ctrl+K (other) keyboard shortcut to open search.
  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setSearchOpen(prev => !prev)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleGlobalKeyDown])

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
            title="Lock datasource"
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
