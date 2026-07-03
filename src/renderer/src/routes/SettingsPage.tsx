import React, { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/types'
import { useSessionStore } from '@/store/session'
import { unwrap } from '@/lib/api'
import { Button } from '@/components/ui/button'

const AUTO_LOCK_OPTIONS: { label: string; value: number }[] = [
  { label: 'Never', value: 0 },
  { label: '5 minutes', value: 5 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '60 minutes', value: 60 },
]

export default function SettingsPage(): React.ReactElement {
  const { state, lock } = useSessionStore()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    unwrap(window.api.settings.get())
      .then(s => setSettings(s))
      .catch(() => {})
  }, [])

  async function handleAutoLockChange(value: number): Promise<void> {
    if (!settings) return
    setSaving(true)
    try {
      const updated = await unwrap(window.api.settings.update({ autoLockMinutes: value }))
      setSettings(updated)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <h2 className="text-base font-semibold text-foreground mb-6">Settings</h2>

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

      {/* Auto-lock timeout */}
      <section className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Auto-lock after inactivity
        </p>
        <div className="flex flex-wrap gap-2">
          {AUTO_LOCK_OPTIONS.map(opt => (
            <button
              key={opt.value}
              disabled={saving || settings === null}
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
    </div>
  )
}
