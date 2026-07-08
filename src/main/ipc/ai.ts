/**
 * ai.ts — IPC handlers for the local Ollama AI foundation (status / listModels / generate).
 *
 * No DB access — these run regardless of unlock state, same as settings. All
 * requests happen in main via `../ai/ollama.ts`; the renderer never fetches
 * directly (untrusted-renderer boundary + CSP unchanged).
 */

import type { AiStatus, AiGenerateInput, AiGenerateResult } from '@shared/types'
import { IPC } from '@shared/ipc'
import { handle } from './result'
import { getSettings } from '../datasource/config'
import * as ollama from '../ai/ollama'

export function registerAiHandlers(): void {
  // Probes the configured Ollama server. Never throws — failure is surfaced as data
  // ({ reachable: false, error }) so the renderer can show a friendly message.
  handle<AiStatus>(IPC.ai.status, () => {
    return ollama.getStatus()
  })

  handle<string[]>(IPC.ai.listModels, () => {
    return ollama.getModels()
  })

  handle<AiGenerateResult>(IPC.ai.generate, (_event, input) => {
    const { prompt, system, model } = input as AiGenerateInput
    const resolvedModel = model ?? getSettings().ai.model
    if (!resolvedModel) {
      throw new Error('No AI model configured. Pick a model in Settings → AI (Ollama).')
    }
    return ollama.generate({ model: resolvedModel, prompt, system })
  })
}
