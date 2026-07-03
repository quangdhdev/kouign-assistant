// Global Window augmentation for the renderer — makes window.api typed.
import type { KouignApi } from '@shared/api'

declare global {
  interface Window {
    api: KouignApi
  }
}

export {}
