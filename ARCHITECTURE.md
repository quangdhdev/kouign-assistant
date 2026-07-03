# Architecture — Kouign Assistant

This document describes how Kouign Assistant is structured: the process model, the security
boundary, the data model, the IPC surface, and the startup/unlock flow.

## 1. Goals & constraints

- **Private & offline-first** — no backend, no telemetry. All data is local.
- **Encrypted at rest** — the entire SQLite database file is encrypted with SQLCipher.
- **Portable datasource** — the DB is a single file the user can place in iCloud Drive.
- **Password-gated** — the password derives the encryption key; nothing else unlocks the data.
- **macOS first** — native window chrome, iCloud Drive integration.

## 2. Process model

Electron gives us three layers. The security rule: **the renderer is untrusted and never
touches Node, the filesystem, or the database directly.**

```
┌──────────────────────────────────────────────────────────────┐
│ Renderer (Chromium, React)                                     │
│  - UI: LockGate, AppShell, Todos, Notes, Settings              │
│  - Zustand stores call window.api.*                            │
│  - contextIsolation: true, nodeIntegration: false, strict CSP  │
└───────────────▲───────────────────────────────┬───────────────┘
                │ window.api (typed)             │ ipcRenderer.invoke
                │                                 ▼
┌───────────────┴───────────────────────────────────────────────┐
│ Preload (contextBridge)                                        │
│  - Exposes a typed Kouign AssistantApi on window.api                   │
│  - Only forwards whitelisted IPC channels                      │
└───────────────▲───────────────────────────────────────────────┘
                │ ipcMain.handle
                ▼
┌───────────────────────────────────────────────────────────────┐
│ Main (Node)                                                    │
│  - Window lifecycle                                            │
│  - IPC handlers (datasource, tasks, notes, shell)             │
│  - DB: better-sqlite3-multiple-ciphers + Drizzle ORM          │
│  - Datasource config (recent list) + iCloud resolver          │
│  - Security: password → PRAGMA key                            │
└───────────────────────────────────────────────────────────────┘
                │
                ▼
        Encrypted SQLite file (.kouigndb)  ── optionally in iCloud Drive
```

### Layer responsibilities

- **Main process** — owns everything privileged: creating the `BrowserWindow`, opening and
  keying the encrypted database, running migrations, serving IPC requests, and reading the
  small plaintext config that lists recent datasources.
- **Preload** — the only bridge. It uses `contextBridge.exposeInMainWorld('api', …)` to
  publish a **typed** `Kouign AssistantApi`. It forwards a fixed set of channels and nothing else.
- **Renderer** — the React UI. It calls `window.api.*`, receives plain data, and renders.
  It has no filesystem or DB access and cannot import Node modules.

## 3. Source layout

```
src/
├─ shared/                 # Single source of truth across all layers
│  ├─ types.ts             # Task, Note, DatasourceRef, SessionState, SearchResult, AppSettings, IpcResult<T>
│  ├─ ipc.ts               # Centralized IPC channel name constants
│  └─ api.ts               # Kouign AssistantApi interface (shape of window.api)
│
├─ main/
│  ├─ index.ts             # App lifecycle + window creation
│  ├─ db/
│  │  ├─ connection.ts     # open/create/close encrypted DB, apply PRAGMA key, validate password
│  │  ├─ schema.ts         # Drizzle schema (tasks, notes)
│  │  ├─ migrate.ts        # idempotent DDL bootstrap (incl. FTS5 tables + triggers) + user_version
│  │  └─ repositories.ts   # taskRepo / noteRepo / searchRepo → map rows to domain types
│  ├─ datasource/
│  │  ├─ config.ts         # recent datasources + AppSettings (plaintext userData/kouign.config.json)
│  │  └─ icloud.ts         # resolve iCloud Drive dir, detect .icloud placeholders
│  └─ ipc/
│     ├─ result.ts         # handle() wrapper → IpcResult<T>, error-code → message map
│     ├─ datasource.ts     # list/create/pick/unlock/lock/remove/session
│     ├─ tasks.ts          # list/create/update/remove/toggleStatus
│     ├─ notes.ts          # list/create/update/remove/togglePin
│     ├─ search.ts         # query → SearchResult[] (FTS5, tasks + notes)
│     ├─ settings.ts       # get/update AppSettings (auto-lock, theme)
│     └─ shell.ts          # openExternal (http/https/slack only)
│
├─ preload/
│  ├─ index.ts             # builds Kouign AssistantApi from IPC channels, exposes on window.api
│  └─ index.d.ts           # global Window typing
│
└─ renderer/
   ├─ index.html
   └─ src/
      ├─ main.tsx          # React root + HashRouter + ToastProvider
      ├─ App.tsx           # session gate: LockGate vs AppShell
      ├─ routes/
      │  ├─ LockGate.tsx   # datasource picker + unlock + create
      │  ├─ AppShell.tsx   # sidebar + topbar + nested routes
      │  └─ SettingsPage.tsx
      ├─ features/
      │  ├─ todos/         # TodosPage, TaskDialog, meta (labels/badges)
      │  └─ notes/         # NotesPage, NoteEditor
      ├─ components/ui/    # shadcn/ui primitives (button, dialog, select, …)
      ├─ store/            # zustand: session, tasks, notes
      ├─ lib/              # api wrapper (unwrap), utils (cn, formatDate)
      └─ styles/globals.css# design tokens + Tailwind
```

## 4. Data model

A single encrypted SQLite database with two tables (tags are a post-MVP extension).

### `tasks`

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | autoincrement |
| title | TEXT | required |
| description | TEXT | nullable |
| status | TEXT | `todo` \| `in_progress` \| `done` |
| priority | TEXT | `low` \| `medium` \| `high` |
| category | TEXT | `personal` \| `company` |
| due_date | TEXT | ISO date `yyyy-mm-dd`, nullable |
| jira_url | TEXT | nullable |
| slack_url | TEXT | nullable |
| created_at | TEXT | ISO datetime |
| updated_at | TEXT | ISO datetime |
| completed_at | TEXT | set when status → done |

### `notes`

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | autoincrement |
| title | TEXT | required |
| content | TEXT | markdown |
| type | TEXT | `note` \| `daily` \| `bookmark` |
| url | TEXT | for bookmarks, nullable |
| pinned | INTEGER | boolean 0/1 |
| created_at | TEXT | ISO datetime |
| updated_at | TEXT | ISO datetime |

**Indexes**: `tasks(status)`, `tasks(category)`, `notes(type)`, `notes(pinned)`.

### Full-text search (FTS5)

Search spans **both** tasks and notes ("searchable in one place"). Two FTS5
**external-content** virtual tables mirror the base tables:

- `tasks_fts(title, description)` with `content='tasks', content_rowid='id'`
- `notes_fts(title, content)` with `content='notes', content_rowid='id'`

They are kept in sync by `AFTER INSERT / UPDATE / DELETE` triggers on `tasks` / `notes`
that mirror rows into the FTS index (the standard SQLite external-content pattern). A
query ranks with `bm25()` and returns a `snippet()` for display. Because FTS5 tables are
virtual, they are managed with **raw DDL/SQL in `migrate.ts`** (not the Drizzle schema
builder), guarded by the same `user_version` bump; `searchRepo` wraps the read queries and
returns a merged, ranked `SearchResult[]` (a discriminated union over task/note hits).

**Migrations**: schema is created with idempotent `CREATE TABLE IF NOT EXISTS` DDL run on
every unlock, guarded by `PRAGMA user_version`. This lets a packaged app initialize any
datasource on first open without shipping migration files. Bump `SCHEMA_VERSION` and add an
incremental block when the schema evolves.

## 5. Encryption

- Library: **better-sqlite3-multiple-ciphers** (SQLCipher cipher).
- On open: `PRAGMA cipher='sqlcipher'` then `PRAGMA key='<password>'` (single quotes in the
  passphrase are escaped). A wrong key makes the file read as "not a database" — a probe
  `SELECT count(*) FROM sqlite_master` is the password test; failure → `INVALID_PASSWORD`.
- The password is **never persisted**. Only the open DB handle lives in the main process for
  the session. Locking closes the handle.
- **Auto-lock on inactivity**: an idle timer (default **15 min**, configurable in Settings)
  locks the datasource. The renderer reports user activity to the main process; on timeout
  the main process closes the DB handle and pushes a `session` update so the app returns to
  the LockGate. The timeout preference is stored in the plaintext app config (available
  before unlock); `0`/"Never" disables it. Manual **Lock** still works at any time.
- WAL journaling and `foreign_keys = ON` are enabled after keying.
- *Stretch*: optional "remember on this Mac" via the macOS Keychain (`keytar`).

## 6. IPC surface

All channel names are centralized in `src/shared/ipc.ts`. Every handler is wrapped so it
returns `IpcResult<T>` instead of throwing across the boundary.

| Domain | Channel | Payload → Result |
|--------|---------|------------------|
| datasource | `list` | → `DatasourceRef[]` |
| datasource | `pickExisting` | → `string \| null` (native open dialog) |
| datasource | `pickNewLocation` | `defaultName` → `string \| null` (native save dialog) |
| datasource | `create` | `{path,label,password}` → `SessionState` |
| datasource | `unlock` | `{path,password}` → `SessionState` |
| datasource | `lock` | → `SessionState` |
| datasource | `remove` | `path` → `DatasourceRef[]` |
| datasource | `session` | → `SessionState` |
| tasks | `list/create/update/remove/toggleStatus` | → `Task` / `Task[]` |
| notes | `list/create/update/remove/togglePin` | → `Note` / `Note[]` |
| search | `query` | `q` → `SearchResult[]` (bm25-ranked task+note hits w/ snippet) |
| settings | `get` | → `AppSettings` (e.g. `autoLockMinutes`, `theme`) |
| settings | `update` | `Partial<AppSettings>` → `AppSettings` |
| shell | `openExternal` | `url` → `boolean` (only `http(s):` / `slack:`) |

## 7. Startup / unlock flow

```
app start
   │
   ▼
main creates BrowserWindow (hiddenInset title bar) → loads renderer
   │
   ▼
renderer: session() → { unlocked: false }
   │
   ▼
LockGate
   ├─ Recent datasources (from userData/kouign.config.json — paths + labels only)
   ├─ "Open existing…"  → native open dialog
   └─ "Create new…"     → native save dialog (defaults to iCloud Drive if present)
   │
   ▼
User enters password → datasource:unlock { path, password }
   │
   ▼
main: (guard) reject if iCloud placeholder not downloaded
      open file → PRAGMA cipher + key → probe SELECT
   ├─ wrong password → IpcResult error "Incorrect password."
   └─ ok → run migrations → remember in recent list → SessionState { unlocked: true }
   │
   ▼
renderer routes to AppShell (Todos / Notes / Settings)
   │
   ▼
"Lock" → datasource:lock → close handle → back to LockGate
```

### Datasource creation — password policy

Because password loss is unrecoverable by design, the **Create new** form enforces:

- **Minimum length: 8 characters** (rejected below that, with an inline message).
- A **confirm-password** field that must match.
- A prominent, non-dismissible **"there is no recovery / no reset"** warning shown before
  the datasource is created.

Validation runs in the renderer for instant feedback **and** is re-checked in the main
`datasource:create` handler (never trust the renderer). No strength meter in MVP.

## 8. Security posture

- `contextIsolation: true`, `nodeIntegration: false`, preload is the only bridge.
- Strict CSP in `index.html` (`default-src 'self'`, no remote script).
- `setWindowOpenHandler` denies in-app navigation and hands links to the OS browser.
- `shell.openExternal` allowlist: only `http:`, `https:`, `slack:`.
- Recent-datasources config stores **only** file paths + labels — never secrets or content.

## 9. Known risks / trade-offs (MVP)

- **Native module ABI**: `better-sqlite3-multiple-ciphers` must be rebuilt for Electron.
- **iCloud eventual consistency**: files may be evicted to `.<name>.icloud` placeholders;
  detect and prompt to download before opening. Concurrent edits from two Macs are
  last-write-wins.
- **Password recovery**: impossible by design; surfaced as a warning at creation.
- **Markdown rendering**: MVP notes editor is plain-text/markdown-source; live preview is a
  post-MVP enhancement.
