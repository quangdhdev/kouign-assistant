/**
 * ToastProvider — lightweight in-app toast notifications, no external dep.
 *
 * Toasts slide up from the bottom-right corner with a 150 ms ease-out animation.
 * Respects prefers-reduced-motion: if the user has reduced motion enabled,
 * animation is skipped (class is still applied but overridden by CSS media query).
 *
 * Usage: wrap app in <ToastProvider>, call useToast() anywhere.
 */
import React, { createContext, useCallback, useContext, useState } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  kind: ToastKind
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

let _nextId = 1

export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = _nextId++
    setToasts(prev => [...prev, { id, message, kind }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const bgClass = (kind: ToastKind): string => {
    if (kind === 'error') return 'bg-destructive text-destructive-foreground'
    if (kind === 'success') return 'bg-[var(--success)] text-white'
    return 'bg-card text-foreground border border-border'
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 app-no-drag"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className={`toast-enter rounded px-4 py-2 text-sm shadow-lg max-w-xs ${bgClass(t.kind)}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext)
}
