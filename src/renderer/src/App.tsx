import React, { useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useSessionStore } from '@/store/session'
import LockGate from '@/routes/LockGate'
import AppShell from '@/routes/AppShell'

/** Throttle delay in ms for activity pings */
const ACTIVITY_THROTTLE = 10_000

export default function App(): React.ReactElement {
  const { state, setSessionState, refresh } = useSessionStore()
  const lastPing = useRef(0)

  // Fetch initial session state
  useEffect(() => {
    refresh()
  }, [refresh])

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
