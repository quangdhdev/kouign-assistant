# Task: Phase 2 — App shell & unlock UI

> **Owner:** coder sub-agent (model: sonnet) · **Phase:** 2 · **Status:** ready
> **Depends on:** Phase 1 (datasource core) complete.
> **Read first:** [ARCHITECTURE.md](../../ARCHITECTURE.md) §2 (process model), §6 (IPC surface),
> §7 (unlock flow), §8 (security); [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md) §2 (tokens),
> §6 (layout & shell). This spec is the source of scope.

## Goal

Wire the **security boundary and unlock experience** end-to-end: the shared type/IPC contract,
main-process IPC handlers over the Phase 1 data layer, the typed preload bridge, and the renderer
shell — LockGate (pick/create/unlock a datasource with the password policy), AppShell (sidebar +
top bar), the session store, Settings (with the auto-lock control), and the full design tokens.

After this phase the app can create/open an encrypted datasource, route to an empty Todos/Notes/
Settings shell, auto-lock on inactivity, and lock manually. Todos/Notes **content** is Phase 3/4.

## Dependencies & setup

- Phase 1 modules (`db/*`, `datasource/*`) exist and are imported here.
- Add `react-router-dom` and `zustand` if not already present.
- Session state (the single open DB handle + idle timer) is owned by a main-process
  `session` module created in this phase.

## Scope (sub-tasks)

### 2.1 Shared contract — the single source of truth

Extend `src/shared/types.ts` (Phase 1 subset) and add `ipc.ts`, `api.ts`. **Embed verbatim:**

```ts
// src/shared/types.ts  (Phase 2 additions — keep Phase 1 domain types above)
export interface DatasourceRef { path: string; label: string; lastOpenedAt: string }

export interface SessionState {
  unlocked: boolean
  datasource: { path: string; label: string } | null
}

export type SearchResult =
  | { kind: 'task'; task: Task; snippet: string; rank: number }
  | { kind: 'note'; note: Note; snippet: string; rank: number }

// Discriminated result crossing the IPC boundary — handlers never throw across it.
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }
```

```ts
// src/shared/ipc.ts — centralized channel names; NEVER use raw strings at call sites.
export const IPC = {
  datasource: {
    list: 'datasource:list',
    pickExisting: 'datasource:pickExisting',
    pickNewLocation: 'datasource:pickNewLocation',
    create: 'datasource:create',
    unlock: 'datasource:unlock',
    lock: 'datasource:lock',
    remove: 'datasource:remove',
    session: 'datasource:session',
  },
  tasks:    { list: 'tasks:list', create: 'tasks:create', update: 'tasks:update', remove: 'tasks:remove', toggleStatus: 'tasks:toggleStatus' },
  notes:    { list: 'notes:list', create: 'notes:create', update: 'notes:update', remove: 'notes:remove', togglePin: 'notes:togglePin' },
  search:   { query: 'search:query' },
  settings: { get: 'settings:get', update: 'settings:update' },
  shell:    { openExternal: 'shell:openExternal' },
  // main → renderer push events
  events:   { sessionChanged: 'event:sessionChanged' },
  // renderer → main, activity ping for auto-lock
  activity: { ping: 'activity:ping' },
} as const
```

```ts
// src/shared/api.ts — shape of window.api exposed by preload. Every method resolves IpcResult<T>.
import type { Task, Note, DatasourceRef, SessionState, SearchResult, AppSettings } from './types'

export interface BassistantApi {
  datasource: {
    list(): Promise<IpcResult<DatasourceRef[]>>
    pickExisting(): Promise<IpcResult<string | null>>
    pickNewLocation(defaultName: string): Promise<IpcResult<string | null>>
    create(input: { path: string; label: string; password: string }): Promise<IpcResult<SessionState>>
    unlock(input: { path: string; password: string }): Promise<IpcResult<SessionState>>
    lock(): Promise<IpcResult<SessionState>>
    remove(path: string): Promise<IpcResult<DatasourceRef[]>>
    session(): Promise<IpcResult<SessionState>>
  }
  tasks: { /* Phase 3 fills signatures; declare the namespace now */ }
  notes: { /* Phase 4 */ }
  search: { query(q: string): Promise<IpcResult<SearchResult[]>> }
  settings: {
    get(): Promise<IpcResult<AppSettings>>
    update(patch: Partial<AppSettings>): Promise<IpcResult<AppSettings>>
  }
  shell: { openExternal(url: string): Promise<IpcResult<boolean>> }
  onSessionChanged(cb: (s: SessionState) => void): () => void  // returns unsubscribe
  pingActivity(): void
}
```

### 2.2 Main — IPC result wrapper (`src/main/ipc/result.ts`)

- `handle<T>(channel, fn)` — registers `ipcMain.handle`, runs `fn`, returns `{ ok: true, data }`;
  on throw, maps to `{ ok: false, error: { code, message } }`. `DatasourceError.code` passes
  through; unknown errors → `code: 'UNKNOWN'`.
- `errorMessage(code)` map (renderer-facing copy), e.g. `INVALID_PASSWORD → "Incorrect password."`,
  `ICLOUD_NOT_DOWNLOADED → "This datasource is in iCloud and hasn't downloaded yet."`,
  `WEAK_PASSWORD → "Password must be at least 8 characters."`,
  `ALREADY_EXISTS → "A datasource already exists at that location."`.

### 2.3 Main — session module (`src/main/session.ts`)

- Holds the single open `Database` handle + current `DatasourceRef` (in memory only).
- `getState(): SessionState`, `unlock(path, password)`, `create({path,label,password})`,
  `lock()`. On unlock/create: guard iCloud placeholder (`ICLOUD_NOT_DOWNLOADED`), open/create +
  key (Phase 1), run `migrate`, `addRecent`, start the idle timer.
- **Auto-lock timer:** read `autoLockMinutes` from settings; if `> 0`, arm a timer reset by
  `activity:ping`. On expiry: `lock()` (close handle) and push `IPC.events.sessionChanged` with
  the locked state to all windows. `pingActivity` from renderer resets it. Setting change
  re-arms/disarms.
- Broadcast `sessionChanged` on every state transition (unlock/create/lock/auto-lock).

### 2.4 Main — datasource + settings handlers

- `src/main/ipc/datasource.ts` — register all `IPC.datasource.*`:
  - `pickExisting` → `dialog.showOpenDialog` (single `.bassistantdb` file) → path | null.
  - `pickNewLocation` → `dialog.showSaveDialog` defaulting to `defaultDatasourceDir()` and
    `<defaultName>.bassistantdb` → path | null.
  - `create` → **re-validate password policy** (min 8 → else `WEAK_PASSWORD`) before creating.
  - `unlock` / `lock` / `session` → delegate to `session.ts`. `remove` → `removeRecent` → list.
- `src/main/ipc/settings.ts` — `get`/`update` over Phase 1 `config.ts`; on `update` of
  `autoLockMinutes`, re-arm the session timer.
- `src/main/ipc/shell.ts` — `openExternal(url)` with allowlist `http:`/`https:`/`slack:` only
  (reject others with `false`). Register all handlers from `src/main/index.ts` at startup.
- Ensure `BrowserWindow` webPreferences keep Phase 0 security defaults; add `setWindowOpenHandler`
  routing external links via `shell.openExternal`.

### 2.5 Preload (`src/preload/index.ts` + `index.d.ts`)

- Build `BassistantApi` by wrapping `ipcRenderer.invoke(IPC.*, payload)` per method; expose on
  `window.api` via `contextBridge.exposeInMainWorld('api', api)`.
- `onSessionChanged(cb)` subscribes to `IPC.events.sessionChanged` and returns an unsubscribe.
- `pingActivity()` sends `IPC.activity.ping` (fire-and-forget).
- `index.d.ts` augments `Window` with `api: BassistantApi`. Only whitelisted channels are forwarded.

### 2.6 Renderer — shell & unlock

- `main.tsx` — React root + `HashRouter` + a lightweight `ToastProvider` (no external dep, per
  DESIGN_SYSTEM §5).
- `App.tsx` — **session gate**: call `window.api.datasource.session()` on mount, subscribe via
  `onSessionChanged`; render `LockGate` when locked, `AppShell` (routes) when unlocked. Install a
  global activity listener (mousemove/keydown, throttled) → `window.api.pingActivity()`.
- `store/session.ts` (Zustand) — `state`, `refresh()`, `unlock()`, `create()`, `lock()`; wraps the
  api and surfaces errors as toasts via `lib/api.ts` unwrap helper.
- `lib/api.ts` — `unwrap<T>(p: Promise<IpcResult<T>>): Promise<T>` that throws on `!ok` so stores
  can `try/catch` → toast.
- `routes/LockGate.tsx`:
  - Recent datasources list (open on click → password prompt), "Open existing…"
    (`pickExisting`), "Create new…" (`pickNewLocation`).
  - **Create form password policy:** password + confirm fields; disable submit until length ≥ 8 and
    confirm matches; show a **non-dismissible "No recovery / no reset" warning** before creation.
    (Server re-validates — never rely on the client alone.)
  - Unlock form: password → `unlock`; wrong password shows the mapped error inline.
- `routes/AppShell.tsx` — frameless macOS layout (DESIGN_SYSTEM §6): 48px top bar
  (`-webkit-app-region: drag`, datasource label left, **Lock** button right — `.app-no-drag`),
  208px left sidebar nav (Todos / Notes / Settings, active = accent bg), scrollable content with
  nested `<Outlet/>` routes. Todos/Notes routes render placeholder empty pages this phase.
- `routes/SettingsPage.tsx` — show current datasource, **Lock & switch**, **auto-lock timeout
  control** (Never / 5 / 15 / 30 / 60 min bound to `settings.update`), and the security note.

### 2.7 Design tokens (`src/renderer/src/styles/globals.css`)

Replace the Phase 0 placeholder tokens with the **full Atlassian palette** from DESIGN_SYSTEM §2
(light + `.dark`), mapped to Tailwind via `@theme inline`, plus status/priority badge colors,
radius (`--radius` 3px, `--radius-card` 8px), and the sidebar tokens. shadcn primitives consume
these variables.

## Out of scope (do NOT do)

- No task/note CRUD UI or content (`tasks`/`notes` IPC namespaces are declared but their methods
  are Phase 3/4). Todos/Notes pages are empty placeholders.
- No search implementation (Phase 4.5) — the `search` api method may be declared but unused.
- No packaging, no dark-mode toggle UI (Settings stores `theme` but the toggle/polish is Phase 5).

## Acceptance criteria

- [ ] `shared/types.ts`, `shared/ipc.ts`, `shared/api.ts` match the embedded contracts; no raw
      channel strings at any call site.
- [ ] Every main handler returns `IpcResult<T>`; no unhandled rejection crosses the boundary.
- [ ] Create flow enforces min-8 + confirm-match + no-recovery warning in the UI **and** the main
      `create` handler rejects `< 8` with `WEAK_PASSWORD`.
- [ ] Unlock with correct password routes to AppShell; wrong password shows "Incorrect password."
- [ ] Manual **Lock** returns to LockGate and closes the DB handle.
- [ ] Auto-lock: after `autoLockMinutes` of no activity the app locks and returns to LockGate;
      activity resets the timer; setting it to "Never" disables it; changing the setting re-arms.
- [ ] Sidebar nav routes between (empty) Todos / Notes / Settings; top bar drag + traffic lights
      behave; Lock button is interactive (not draggable).
- [ ] Design tokens applied (light + dark variables present); `shell.openExternal` allows only
      http/https/slack.
- [ ] `npm run build` and `npm run lint` exit 0; `npm run dev` runs the full unlock→shell→lock loop.

## Verification

```bash
npm run lint && npm run build
npm run dev   # create a new datasource (test the password policy), lock, re-open with wrong then
              # right password, navigate the sidebar, set auto-lock to 5 min and confirm it locks
```

Report the lint/build results and walk through the manual unlock/lock/auto-lock checks you ran.

## Report back (to orchestrator)

Files created/edited, mapping of each acceptance criterion to what you did, verification walkthrough,
and any blockers. Confirm the `tasks`/`notes` api namespaces are stubbed cleanly so Phase 3/4 can
fill them without touching the contract shape.
