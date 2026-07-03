import React, { useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useSessionStore } from '@/store/session'
import { useSettingsStore } from '@/store/settings'
import LockGate from '@/routes/LockGate'
import AppShell from '@/routes/AppShell'

/** Throttle delay in ms for activity pings */
const ACTIVITY_THROTTLE = 10_000

export default function App(): React.ReactElement {
  const { state, setSessionState, refresh } = useSessionStore()
  const { settings, load: loadSettings } = useSettingsStore()
  const lastPing = useRef(0)

  // Fetch initial session state
  useEffect(() => {
    refresh()
  }, [refresh])

  // Load settings on mount — readable from plaintext config even before unlock.
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Subscribe to session changes pushed from main process
  useEffect(() => {
    const unsub = window.api.onSessionChanged((s) => {
      setSessionState(s)
    })
    return unsub
  }, [setSessionState])

  // Global activity listener — throttled, sends ping to main for auto-lock reset
  useEffect(() => {
    function handleActivity(): void {
      const now = Date.now()
      if (now - lastPing.current >= ACTIVITY_THROTTLE) {
        lastPing.current = now
        window.api.pingActivity()
      }
    }
    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('keydown', handleActivity)
    return () => {
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('keydown', handleActivity)
    }
  }, [])

  // Apply .dark class on <html> based on settings.theme + system preference.
  // Defaults to 'system' until settings load — no FOUC for system-preference users.
  useEffect(() => {
    const theme = settings?.theme ?? 'system'
    const root = document.documentElement

    if (theme === 'dark') {
      root.classList.add('dark')
      return
    }
    if (theme === 'light') {
      root.classList.remove('dark')
      return
    }

    // 'system' — follow the OS media query live
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    root.classList.toggle('dark', mq.matches)

    const handler = (e: MediaQueryListEvent): void => {
      root.classList.toggle('dark', e.matches)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [settings?.theme])

  if (!state.unlocked) {
    return <LockGate />
  }

  return (
    <Routes>
      <Route path="/*" element={<AppShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
