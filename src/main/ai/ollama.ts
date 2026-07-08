/**
 * ollama.ts — thin client over a locally-running Ollama server.
 *
 * All requests run in the main process against the user-configured base URL
 * (`getSettings().ai.baseUrl`, default `http://localhost:11434`). No cloud
 * provider, no telemetry — this only ever talks to whatever the user pointed
 * it at, and defaults to localhost.
 *
 * `getStatus()` never throws: connection failures are normalized into
 * `{ reachable: false, models: [], error }` so the IPC layer can surface them
 * as data rather than an IpcResult failure. `getModels()` and `generate()`
 * throw friendly Error messages on failure (caught by the `handle()` wrapper).
 */

import type { AiStatus, AiGenerateResult } from '@shared/types'
import { getSettings } from '../datasource/config'

const STATUS_TIMEOUT_MS = 5_000
const GENERATE_TIMEOUT_MS = 120_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FetchInit {
  method?: string
  headers?: Record<string, string>
  body?: string
}

async function fetchWithTimeout(url: string, init: FetchInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Normalizes connection failures (refused / timeout / DNS) into a friendly message. */
function friendlyConnectionError(baseUrl: string, err: unknown): string {
  const detail = err instanceof Error ? err.message : String(err)
  return `Couldn't reach Ollama at ${baseUrl}. Is it running? (${detail})`
}

// ---------------------------------------------------------------------------
// Status / model list
// ---------------------------------------------------------------------------

/** Probes the configured Ollama server. Never throws. */
export async function getStatus(): Promise<AiStatus> {
  const { baseUrl } = getSettings().ai
  try {
    const res = await fetchWithTimeout(`${baseUrl}/api/tags`, {}, STATUS_TIMEOUT_MS)
    if (!res.ok) {
      return { reachable: false, models: [], error: `Ollama returned an error (HTTP ${res.status}).` }
    }
    const body = (await res.json()) as { models?: { name: string }[] }
    const models = Array.isArray(body.models) ? body.models.map(m => m.name) : []
    return { reachable: true, models }
  } catch (err) {
    return { reachable: false, models: [], error: friendlyConnectionError(baseUrl, err) }
  }
}

/** Returns the installed model list, or throws a friendly Error if Ollama isn't reachable. */
export async function getModels(): Promise<string[]> {
  const status = await getStatus()
  if (!status.reachable) {
    throw new Error(status.error ?? "Couldn't reach Ollama.")
  }
  return status.models
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

export async function generate(input: { model: string; prompt: string; system?: string }): Promise<AiGenerateResult> {
  const { baseUrl } = getSettings().ai
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/api/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: input.model,
          prompt: input.prompt,
          system: input.system,
          stream: false,
        }),
      },
      GENERATE_TIMEOUT_MS
    )
    if (!res.ok) {
      throw new Error(`Ollama returned an error (HTTP ${res.status}).`)
    }
    const body = (await res.json()) as { response?: string }
    return { text: body.response ?? '', model: input.model }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Ollama returned')) throw err
    throw new Error(friendlyConnectionError(baseUrl, err))
  }
}
