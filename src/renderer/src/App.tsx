import React from 'react'
import '@/styles/globals.css'
import { Button } from '@/components/ui/button'
// Prove @shared alias resolves in the renderer
import type { Placeholder as _Placeholder } from '@shared/types'

function App(): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="rounded-lg border border-border bg-card p-10 shadow-sm text-center space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Kouign Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Your private, offline-first personal assistant.
        </p>
        <Button>Get Started</Button>
      </div>
    </div>
  )
}

export default App
