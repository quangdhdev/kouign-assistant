import React, { useEffect, useState, useCallback } from 'react'
import type { DatasourceRef } from '@shared/types'
import { useSessionStore } from '@/store/session'
import { unwrap } from '@/lib/api'
import { Button } from '@/components/ui/button'

type View =
  | { mode: 'list' }
  | { mode: 'unlock'; path: string; label: string }
  | { mode: 'create'; path: string; label: string }

export default function LockGate(): React.ReactElement {
  const [view, setView] = useState<View>({ mode: 'list' })
  const [recents, setRecents] = useState<DatasourceRef[]>([])
  const { unlock, create, error, setError } = useSessionStore()

  const loadRecents = useCallback(async () => {
    try {
      const list = await unwrap(window.api.datasource.list())
      setRecents(list)
    } catch {
      // ignore — empty list is fine
    }
  }, [])

  useEffect(() => {
    loadRecents()
    return () => { setError(null) }
  }, [loadRecents, setError])

  // Clear error when view changes
  useEffect(() => { setError(null) }, [view, setError])

  async function handlePickExisting(): Promise<void> {
    try {
      const path = await unwrap(window.api.datasource.pickExisting())
      if (!path) return
      const label = path.split('/').pop()?.replace(/\.kouigndb$/, '') ?? path
      setView({ mode: 'unlock', path, label })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handlePickNewLocation(): Promise<void> {
    try {
      const path = await unwrap(window.api.datasource.pickNewLocation('My Datasource'))
      if (!path) return
      const label = path.split('/').pop()?.replace(/\.kouigndb$/, '') ?? path
      setView({ mode: 'create', path, label })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleRemove(path: string, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    try {
      const list = await unwrap(window.api.datasource.remove(path))
      setRecents(list)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        {/* App name header — sits in draggable title area */}
        <div className="app-drag h-12" />

        <div className="app-no-drag px-6 pb-8">
          <h1 className="text-xl font-semibold text-foreground mb-1">Kouign Assistant</h1>
          <p className="text-sm text-muted-foreground mb-6">Private, offline-first personal assistant.</p>

          {view.mode === 'list' && (
            <ListView
              recents={recents}
              error={error}
              onSelect={(r) => setView({ mode: 'unlock', path: r.path, label: r.label })}
              onRemove={handleRemove}
              onPickExisting={handlePickExisting}
              onPickNewLocation={handlePickNewLocation}
            />
          )}

          {view.mode === 'unlock' && (
            <UnlockForm
              path={view.path}
              label={view.label}
              error={error}
              onUnlock={async (password) => {
                const ok = await unlock(view.path, password)
                if (!ok) {
                  // error already set in store
                }
              }}
              onBack={() => { setView({ mode: 'list' }); loadRecents() }}
            />
          )}

          {view.mode === 'create' && (
            <CreateForm
              path={view.path}
              label={view.label}
              error={error}
              onCreate={async (label, password) => {
                await create({ path: view.path, label, password })
              }}
              onBack={() => setView({ mode: 'list' })}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ListViewProps {
  recents: DatasourceRef[]
  error: string | null
  onSelect: (r: DatasourceRef) => void
  onRemove: (path: string, e: React.MouseEvent) => void
  onPickExisting: () => void
  onPickNewLocation: () => void
}

function ListView({ recents, error, onSelect, onRemove, onPickExisting, onPickNewLocation }: ListViewProps): React.ReactElement {
  return (
    <div className="space-y-4">
      {recents.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recent</p>
          <ul className="space-y-1">
            {recents.map(r => (
              <li key={r.path}>
                <button
                  className="w-full flex items-center justify-between rounded px-3 py-2 text-sm text-left hover:bg-secondary transition-colors"
                  onClick={() => onSelect(r)}
                >
                  <span className="font-medium text-foreground truncate">{r.label}</span>
                  <span
                    className="ml-2 text-muted-foreground hover:text-destructive text-xs flex-shrink-0"
                    onClick={(e) => onRemove(r.path, e)}
                    role="button"
                    title="Remove from recents"
                  >
                    ✕
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col gap-2 pt-2">
        <Button onClick={onPickExisting} variant="outline" className="w-full">
          Open existing…
        </Button>
        <Button onClick={onPickNewLocation} className="w-full">
          Create new…
        </Button>
      </div>
    </div>
  )
}

interface UnlockFormProps {
  path: string
  label: string
  error: string | null
  onUnlock: (password: string) => Promise<void>
  onBack: () => void
}

function UnlockForm({ label, error, onUnlock, onBack }: UnlockFormProps): React.ReactElement {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!password || busy) return
    setBusy(true)
    await onUnlock(password)
    setBusy(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Datasource</p>
        <p className="text-sm font-medium text-foreground">{label}</p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="unlock-password">
          Password
        </label>
        <input
          id="unlock-password"
          type="password"
          autoFocus
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full rounded border border-input bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary h-8"
          placeholder="Enter password"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button type="submit" disabled={!password || busy} className="flex-1">
          {busy ? 'Unlocking…' : 'Unlock'}
        </Button>
      </div>
    </form>
  )
}

interface CreateFormProps {
  path: string
  label: string
  error: string | null
  onCreate: (label: string, password: string) => Promise<void>
  onBack: () => void
}

function CreateForm({ path, label: initialLabel, error, onCreate, onBack }: CreateFormProps): React.ReactElement {
  const [label, setLabel] = useState(initialLabel)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  const passwordTooShort = password.length > 0 && password.length < 8
  const confirmMismatch = confirm.length > 0 && confirm !== password
  const canSubmit = password.length >= 8 && password === confirm && label.trim().length > 0 && !busy

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    await onCreate(label.trim(), password)
    setBusy(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Non-dismissible no-recovery warning */}
      <div className="rounded border border-warning bg-badge-warning-bg px-3 py-2 text-xs text-badge-warning-text" style={{ backgroundColor: '#FFFAE6', borderColor: '#FFAB00', color: '#974F0C' }}>
        <strong>Warning: No recovery / no reset.</strong> If you forget your password, your data cannot be recovered. There is no reset mechanism. Store your password somewhere safe.
      </div>

      <div>
        <p className="text-xs text-muted-foreground truncate" title={path}>{path}</p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="create-label">
          Label
        </label>
        <input
          id="create-label"
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          className="w-full rounded border border-input bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary h-8"
          placeholder="My Datasource"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="create-password">
          Password <span className="text-muted-foreground font-normal normal-case">(min. 8 characters)</span>
        </label>
        <input
          id="create-password"
          type="password"
          autoFocus
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full rounded border border-input bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary h-8"
          placeholder="At least 8 characters"
        />
        {passwordTooShort && (
          <p className="text-xs text-destructive">Password must be at least 8 characters.</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="create-confirm">
          Confirm password
        </label>
        <input
          id="create-confirm"
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className="w-full rounded border border-input bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary h-8"
          placeholder="Repeat password"
        />
        {confirmMismatch && (
          <p className="text-xs text-destructive">Passwords do not match.</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button type="submit" disabled={!canSubmit} className="flex-1">
          {busy ? 'Creating…' : 'Create'}
        </Button>
      </div>
    </form>
  )
}
