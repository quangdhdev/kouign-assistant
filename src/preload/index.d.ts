// Global Window augmentation for the typed IPC bridge.
// The full KouignAssistantApi interface is added in Phase 2.
declare global {
  interface Window {
    api: Record<string, never>
  }
}

export {}
