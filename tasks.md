# tasks.md — Bassistant build backlog

A living checklist for building the MVP. Phases are ordered; check items off as they land.
See [ARCHITECTURE.md](./ARCHITECTURE.md) and [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for the
"how" and "look".

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Phase 0 — Project scaffold

- [ ] Scaffold Electron + electron-vite + React + TypeScript project
- [ ] Configure `electron.vite.config.ts` (main / preload / renderer, path aliases `@`, `@shared`)
- [ ] Add tsconfig split (`tsconfig.node.json`, `tsconfig.web.json`)
- [ ] Add Tailwind CSS v4 + `@tailwindcss/vite`
- [ ] Init shadcn/ui (`components.json`, `new-york` style) and add base primitives
- [ ] ESLint + Prettier
- [ ] `.gitignore` (ignore `*.bassistantdb`, `*.db`, `out/`, `dist/`, `node_modules/`)

## Phase 1 — Encrypted datasource core

- [ ] Add deps: `better-sqlite3-multiple-ciphers`, `drizzle-orm`, `drizzle-kit`
- [ ] `db/connection.ts` — open/create/close, `PRAGMA cipher='sqlcipher'` + `key`, password probe
- [ ] `db/schema.ts` — Drizzle schema for `tasks` and `notes`
- [ ] `db/migrate.ts` — idempotent DDL + `PRAGMA user_version`
- [ ] `db/repositories.ts` — `taskRepo` / `noteRepo` mapping rows → shared types
- [ ] `datasource/config.ts` — recent datasources (plaintext `userData/bassistant.config.json`)
- [ ] `datasource/icloud.ts` — resolve iCloud Drive dir; detect `.icloud` placeholders
- [ ] Rebuild native module for Electron (`electron-builder install-app-deps`)
- [ ] Wrong-password path returns a friendly error

## Phase 2 — App shell & unlock UI

- [ ] `shared/types.ts`, `shared/ipc.ts`, `shared/api.ts` (single source of truth)
- [ ] Main IPC handlers: `datasource` (list/create/pick/unlock/lock/remove/session)
- [ ] `ipc/result.ts` — `handle()` wrapper → `IpcResult<T>` + error-code → message map
- [ ] Preload `contextBridge` exposing typed `window.api`
- [ ] Renderer: `main.tsx` (HashRouter + ToastProvider), `App.tsx` session gate
- [ ] `LockGate` — recent list, open existing, create new
- [ ] **Password policy** on create: min 8 chars + confirm-match + non-dismissible "no recovery" warning; re-validated in `datasource:create` handler
- [ ] `AppShell` — draggable top bar, sidebar nav, nested routes
- [ ] `store/session.ts` (Zustand) — refresh / unlock / create / lock
- [ ] `settings` IPC + `datasource/config.ts` `AppSettings` (autoLockMinutes default 15, theme); `store/settings.ts`
- [ ] **Auto-lock on inactivity** — renderer activity ping → main idle timer → close handle + push session update; `0`/"Never" disables
- [ ] `SettingsPage` — show datasource, lock & switch, **auto-lock timeout control**, security note
- [ ] Design tokens in `styles/globals.css` (light + dark)

## Phase 3 — Todos feature

- [ ] `store/tasks.ts` — list / create / update / toggleStatus / remove
- [ ] IPC + repo for tasks
- [ ] `TodosPage` — list, category + status filters, empty state
- [ ] `TaskDialog` — create/edit (title, description, status, priority, category, due date)
- [ ] Jira / Slack URL fields + open-in-browser chips (via `shell.openExternal`)
- [ ] Checkbox status advance; row overflow menu (edit, set status, delete)

## Phase 4 — Notes feature

- [ ] `store/notes.ts` — list / create / update / togglePin / remove
- [ ] IPC + repo for notes
- [ ] `NotesPage` — master–detail with type tabs (All / Notes / Daily / Bookmarks)
- [ ] `NoteEditor` — title + markdown body; autosave; pin; delete
- [ ] Daily note quick-create (date-titled)
- [ ] Bookmark type — URL field + open-in-browser

## Phase 4.5 — Search (FTS5)

- [ ] `migrate.ts` — create `tasks_fts` / `notes_fts` FTS5 external-content tables + sync triggers (raw DDL, `user_version`-guarded)
- [ ] `searchRepo` — bm25-ranked query across tasks + notes, returning `SearchResult[]` with `snippet()`
- [ ] `search` IPC channel + `store` wiring
- [ ] Global search UI (top-bar input or command palette) → grouped task/note results → jump to item

## Phase 5 — Polish & package

- [ ] Empty states, loading states, toasts everywhere
- [ ] Keyboard shortcuts (new task/note, search, lock)
- [ ] Dark mode toggle
- [ ] App icon + `electron-builder.yml` for macOS `.dmg`
- [ ] README quick start + first-run screenshots

---

## Backlog / post-MVP ideas

- [ ] Tags for tasks & notes (`tags`, `task_tags`, `note_tags`)
- [ ] Markdown live preview in the notes editor
- [ ] Live Jira/Slack integration (OAuth) to show issue status / message preview
- [ ] "Remember on this Mac" via macOS Keychain (`keytar`)
- [ ] Change-password / re-key datasource
- [ ] Export / import (encrypted backup)
- [ ] iCloud placeholder auto-download + conflict handling
- [ ] Reminders / due-date notifications
