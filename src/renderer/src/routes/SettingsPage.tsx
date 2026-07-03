import React from 'react'
import type { AppSettings } from '@shared/types'
import { useSessionStore } from '@/store/session'
import { useSettingsStore } from '@/store/settings'
import { useToast } from '@/components/ToastProvider'
import { Button } from '@/components/ui/button'

// ---------------------------------------------------------------------------
// Auto-lock options
// ---------------------------------------------------------------------------

const AUTO_LOCK_OPTIONS: { label: string; value: number }[] = [
  { label: 'Never', value: 0 },
  { label: '5 min', value: 5 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '60 min', value: 60 },
]

// ---------------------------------------------------------------------------
// Theme options
// ---------------------------------------------------------------------------

const THEME_OPTIONS: { label: string; value: AppSettings['theme'] }[] = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
]

// ---------------------------------------------------------------------------
// Keyboard shortcuts reference
// ---------------------------------------------------------------------------

const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: '⌘N', description: 'New task (on Todos) / new note (on Notes)' },
  { keys: '⌘K', description: 'Open global search' },
  { keys: '⌘L', description: 'Lock datasource' },
  { keys: '⌘,', description: 'Open Settings' },
  { keys: 'Esc', description: 'Close dialog / search palette' },
]

// ---------------------------------------------------------------------------
// SettingsPage
// ---------------------------------------------------------------------------

export default function SettingsPage(): React.ReactElement {
  const { state, lock } = useSessionStore()
  const { settings, loaded, update } = useSettingsStore()
  const { toast } = useToast()

  async function handleAutoLockChange(value: number): Promise<void> {
    const result = await update({ autoLockMinutes: value })
    if (result) {
      toast('Auto-lock setting saved', 'success')
    } else {
      toast('Failed to save setting', 'error')
    }
  }

  async function handleThemeChange(theme: AppSettings['theme']): Promise<void> {
    const result = await update({ theme })
    if (result) {
      toast(`Theme set to ${theme}`, 'success')
    } else {
      toast('Failed to save theme', 'error')
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <h2 className="text-base font-semibold text-foreground mb-6">Settings</h2>

      {/* Loading skeleton */}
      {!loaded && (
        <div className="space-y-4 mb-6">
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
          <div className="h-8 w-full bg-muted rounded animate-pulse" />
        </div>
      )}

      {loaded && (
        <>
          {/* Current datasource */}
          <section className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Current Datasource
            </p>
            {state.datasource ? (
              <>
                <p className="text-sm font-medium text-foreground">{state.datasource.label}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{state.datasource.path}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">None</p>
            )}
          </section>

          {/* Lock & switch */}
          <section className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Datasource
            </p>
            <Button variant="outline" onClick={lock}>
              Lock &amp; switch datasource
            </Button>
          </section>

          {/* Appearance — theme */}
          <section className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Appearance
            </p>
            <div className="flex gap-2">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleThemeChange(opt.value)}
                  className={`px-3 py-1 text-sm rounded border transition-colors ${
                    settings?.theme === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-foreground border-border hover:bg-secondary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              System follows your macOS appearance setting.
            </p>
          </section>

          {/* Auto-lock timeout */}
          <section className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Auto-lock after inactivity
            </p>
            <div className="flex flex-wrap gap-2">
              {AUTO_LOCK_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleAutoLockChange(opt.value)}
                  className={`px-3 py-1 text-sm rounded border transition-colors ${
                    settings?.autoLockMinutes === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-foreground border-border hover:bg-secondary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* Keyboard shortcuts */}
          <section className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Keyboard shortcuts
            </p>
            <div className="rounded border border-border bg-card overflow-hidden">
              {SHORTCUTS.map((s, i) => (
                <div
                  key={s.keys}
                  className={`flex items-center justify-between px-3 py-2 text-sm ${
                    i < SHORTCUTS.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  <span className="text-muted-foreground">{s.description}</span>
                  <kbd className="text-xs font-mono bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 flex-shrink-0 ml-4">
                    {s.keys}
                  </kbd>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Shortcuts are suppressed while typing in inputs (except Esc and ⌘K).
            </p>
          </section>

          {/* Security note */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Security
            </p>
            <p className="text-xs text-muted-foreground">
              Your datasource is encrypted with SQLCipher. The password is never stored on disk.
              If you forget your password, your data cannot be recovered — there is no reset mechanism.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
