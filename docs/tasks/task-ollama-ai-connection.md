# Task: Connect to local Ollama for on-device AI

> **Owner:** coder sub-agent (model: sonnet) · **Status:** done
> **Depends on:** nothing — builds on shipped MVP (`AppSettings` + `settings` IPC, `handle()` wrapper, preload bridge, `SettingsPage`)
> **Read first:** [ARCHITECTURE.md](../../ARCHITECTURE.md) §2 (process model), §6 (IPC surface), §8 (security posture);
> [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md) §5 (Input/Select/Button), §6 (Settings layout)

## Goal
In **Settings**, the user can enable an **AI (Ollama)** integration that talks to a
locally-running [Ollama](https://ollama.com) server. They set a base URL (default
`http://localhost:11434`), click **Test connection** to verify Ollama is reachable and load the
installed model list, and pick a default model. This lays the **foundation IPC**
(`ai.status` / `ai.listModels` / `ai.generate`) that future in-app AI features build on. All
requests run in the **main process** to the user's local Ollama — no cloud, no telemetry, no
data leaves the machine.

## Local-first compliance (why this is allowed)
- CLAUDE.md forbids servers/network for **core** features. AI here is an **opt-in,
  off-by-default** add-on that connects **only** to a user-configured Ollama endpoint (default
  localhost). Nothing is sent to any cloud.
- Requests are made from **main** (Node `fetch`), never the renderer — the untrusted-renderer
  boundary and strict CSP are preserved (no CSP change; renderer still can't make network calls).
- The base URL and model are non-secret prefs stored in the plaintext app config (same place as
  `theme`) — no user content is persisted for AI.

## Dependencies & setup
- Reuses `AppSettings` + `settings.get/update` (config in `src/main/datasource/config.ts`) and
  the `useSettingsStore`.
- Adds a **new `ai` IPC domain** (`src/main/ipc/ai.ts`) + a small Ollama client
  (`src/main/ai/ollama.ts`).
- Extends `SettingsPage` with an AI section. No DB schema/migration change (config lives in
  plaintext, not the encrypted DB).
- **Backward-compat:** `getSettings()` must merge defaults so existing configs without an `ai`
  block get `DEFAULT_SETTINGS.ai`.

## Scope (sub-tasks)
### 1. Contract — `src/shared/types.ts`, `src/shared/ipc.ts`, `src/shared/api.ts`
```ts
// types.ts — extend AppSettings
export interface AiSettings {
  enabled: boolean   // default false
  baseUrl: string    // default 'http://localhost:11434'
  model: string      // default '' (user must pick after Test connection)
}
export interface AppSettings {
  autoLockMinutes: number
  theme: 'light' | 'dark' | 'system'
  ai: AiSettings                     // NEW
}
export const DEFAULT_SETTINGS: AppSettings = {
  autoLockMinutes: 15,
  theme: 'system',
  ai: { enabled: false, baseUrl: 'http://localhost:11434', model: '' },
}

// AI IPC DTOs
export interface AiStatus { reachable: boolean; models: string[]; error?: string }
export interface AiGenerateInput { prompt: string; system?: string; model?: string } // model defaults to settings.ai.model
export interface AiGenerateResult { text: string; model: string }
```
```ts
// ipc.ts — add channel group
ai: { status: 'ai:status', listModels: 'ai:listModels', generate: 'ai:generate' }

// api.ts — add namespace to KouignApi
ai: {
  status(): Promise<IpcResult<AiStatus>>          // GET /api/tags against configured baseUrl
  listModels(): Promise<IpcResult<string[]>>
  generate(input: AiGenerateInput): Promise<IpcResult<AiGenerateResult>>
}
```

### 2. Main — `src/main/ai/ollama.ts` + `src/main/ipc/ai.ts`
- `ollama.ts`: thin client over Node `fetch` using `getSettings().ai.baseUrl`:
  - `getModels()` → `GET {baseUrl}/api/tags`, map `.models[].name` → `string[]`. Wrap with
    `AbortController` (~5s timeout).
  - `generate({model, prompt, system})` → `POST {baseUrl}/api/generate` body
    `{ model, prompt, system, stream: false }`; return `.response` as `text`. Longer timeout
    (~120s).
  - Normalize failures (connection refused / timeout / non-200) into friendly messages, e.g.
    `Couldn't reach Ollama at <baseUrl>. Is it running?`.
- `ai.ts`: register `ai:status`, `ai:listModels`, `ai:generate` via the `handle()` wrapper (each
  returns `IpcResult<T>`).
  - `status` → `{ reachable, models }`, or `{ reachable:false, models:[], error }` on failure
    (do **not** throw — surface as data).
  - `generate` → resolve model from `input.model ?? settings.ai.model`; error with a clear
    message if no model configured. No DB access, so no unlock gate needed.
- Register `registerAiHandlers()` alongside the other handler registrations in main; add the
  three channels to the preload bridge whitelist.

### 3. Renderer — AI section in `SettingsPage.tsx`
- New **AI (Ollama)** section (matches existing section styling):
  - **Enable** toggle → persists `ai.enabled` via `update({ ai: { ...settings.ai, enabled } })`.
  - **Base URL** text input (default shown) → persists `ai.baseUrl` on blur/change.
  - **Test connection** button → `unwrap(window.api.ai.status())`; on success show a green
    "Connected · N models" line and populate the model `Select`; on failure show the returned
    `error` in destructive color.
  - **Model** `Select` (from status models) → persists `ai.model`. Disabled until a successful
    test / non-empty model list.
  - Short helper text: "Runs entirely on your Mac via Ollama. Install from ollama.com and
    `ollama pull <model>`. Nothing is sent to the cloud."
- Fields under the section are disabled/dimmed when `enabled` is false (except the Enable toggle).

## Out of scope (do NOT do)
- **No actual in-app AI features yet** (note summarization, task drafting, chat UI) — this task
  only ships the connection + `ai.generate` foundation. Those are separate follow-up tasks.
- No cloud/remote LLM providers (OpenAI, Anthropic, etc.) — local Ollama only.
- No response **streaming**, no chat/history persistence, no storing prompts or completions.
- No auto-installing Ollama or auto-pulling models; no bundling a model.
- **Do not** relax the CSP or make any fetch from the renderer; **do not** store AI data in the
  encrypted DB.

## Acceptance criteria
- [x] Settings shows an **AI (Ollama)** section with Enable toggle, Base URL, Test connection, and
      Model select.
- [x] With Ollama running locally, **Test connection** reports success and lists the installed
      models; selecting a model persists across an app restart.
- [x] With Ollama **not** running (or a bad URL), Test connection shows a clear, non-crashing error
      message (no unhandled rejection).
- [x] `ai.generate` returns text from the selected model (verifiable via Test connection wiring or
      a temporary call) — round-trips through main, not the renderer.
- [x] Existing datasources/configs created before this change still load (settings merge in
      `DEFAULT_SETTINGS.ai`).
- [x] No renderer-side network calls; CSP unchanged; nothing AI-related written to the encrypted DB.
- [x] `npm run lint` / `npm run build` exit 0.

## Verification
```bash
# Prereq: Ollama installed & running locally, e.g.  ollama pull llama3.2
npm run lint && npm run build
npm run dev
# 1. Settings → AI (Ollama) → Enable → Base URL prefilled http://localhost:11434.
# 2. Test connection → "Connected · N models"; Model dropdown fills; pick one.
# 3. Quit & relaunch → Settings still shows enabled + chosen model.
# 4. Stop Ollama → Test connection → friendly error, app stays responsive.
# 5. Open an older datasource (pre-change config) → no crash; AI section shows defaults.
```
