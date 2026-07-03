import React from 'react'
import { NavLink, Routes, Route, Navigate } from 'react-router-dom'
import { useSessionStore } from '@/store/session'
import SettingsPage from './SettingsPage'
import TodosPage from '@/features/todos/TodosPage'

function NotesPlaceholder(): React.ReactElement {
  return (
    <div className="p-6">
      <h2 className="text-base font-semibold text-foreground mb-2">Notes</h2>
      <p className="text-sm text-muted-foreground">Notes will appear here in Phase 4.</p>
    </div>
  )
}

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

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar — 48px, draggable */}
      <div className="app-drag h-12 flex items-center px-4 border-b border-border bg-card flex-shrink-0">
        {/* Traffic light gap for macOS hiddenInset title bar */}
        <div className="w-20 flex-shrink-0" />
        <span className="text-sm font-medium text-foreground truncate flex-1">
          {state.datasource?.label ?? ''}
        </span>
        <div className="app-no-drag flex-shrink-0">
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
            <Route path="notes" element={<NotesPlaceholder />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/todos" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
