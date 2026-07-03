import { contextBridge } from 'electron'

// Minimal no-op preload for Phase 0.
// The full typed KouignAssistantApi will be exposed here in Phase 2.
contextBridge.exposeInMainWorld('api', {
  // placeholder — no channels exposed yet
})
