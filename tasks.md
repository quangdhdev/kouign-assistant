# tasks.md — Kouign Assistant build backlog

A living checklist for building the MVP. Phases are ordered; check items off as they land.
See [ARCHITECTURE.md](./ARCHITECTURE.md) and [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for the
"how" and "look".

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Phase 0 — Project scaffold

- [x] Scaffold Electron + electron-vite + React + TypeScript project
- [x] Configure `electron.vite.config.ts` (main / preload / renderer, path aliases `@`, `@shared`)
- [x] Add tsconfig split (`tsconfig.node.json`, `tsconfig.web.json`)
- [x] Add Tailwind CSS v4 + `@tailwindcss/vite`
- [x] Init shadcn/ui (`components.json`, `new-york` style) and add base primitives
- [x] ESLint + Prettier
- [x] `.gitignore` (ignore `*.kouigndb`, `*.db`, `out/`, `dist/`, `node_modules/`)

## Phase 1 — Encrypted datasource core

- [x] Add deps: `better-sqlite3-multiple-ciphers`, `drizzle-orm`, `drizzle-kit`
- [x] `db/connection.ts` — open/create/close, `PRAGMA cipher='sqlcipher'` + `key`, password probe
- [x] `db/schema.ts` — Drizzle schema for `tasks` and `notes`
- [x] `db/migrate.ts` — idempotent DDL + `PRAGMA user_version`
- [x] `db/repositories.ts` — `taskRepo` / `noteRepo` mapping rows → shared types
- [x] `datasource/config.ts` — recent datasources (plaintext `userData/kouign.config.json`)
- [x] `datasource/icloud.ts` — resolve iCloud Drive dir; detect `.icloud` placeholders
- [x] Rebuild native module for Electron (`electron-builder install-app-deps`)
- [x] Wrong-password path returns a friendly error

## Phase 2 — App shell & unlock UI

- [x] `shared/types.ts`, `shared/ipc.ts`, `shared/api.ts` (single source of truth)
- [x] Main IPC handlers: `datasource` (list/create/pick/unlock/lock/remove/session)
- [x] `ipc/result.ts` — `handle()` wrapper → `IpcResult<T>` + error-code → message map
- [x] Preload `contextBridge` exposing typed `window.api`
- [x] Renderer: `main.tsx` (HashRouter + ToastProvider), `App.tsx` session gate
- [x] `LockGate` — recent list, open existing, create new
- [x] **Password policy** on create: min 8 chars + confirm-match + non-dismissible "no recovery" warning; re-validated in `datasource:create` handler
- [x] `AppShell` — draggable top bar, sidebar nav, nested routes
- [x] `store/session.ts` (Zustand) — refresh / unlock / create / lock
- [x] `settings` IPC + `datasource/config.ts` `AppSettings` (autoLockMinutes default 15, theme); `store/settings.ts`
- [x] **Auto-lock on inactivity** — renderer activity ping → main idle timer → close handle + push session update; `0`/"Never" disables
- [x] `SettingsPage` — show datasource, lock & switch, **auto-lock timeout control**, security note
- [x] Design tokens in `styles/globals.css` (light + dark)

## Phase 3 — Todos feature

- [x] `store/tasks.ts` — list / create / update / toggleStatus / remove
- [x] IPC + repo for tasks
- [x] `TodosPage` — list, category + status filters, empty state
- [x] `TaskDialog` — create/edit (title, description, status, priority, category, due date)
- [x] Jira / Slack URL fields + open-in-browser chips (via `shell.openExternal`)
- [x] Checkbox status advance; row overflow menu (edit, set status, delete)

## Phase 4 — Notes feature

- [x] `store/notes.ts` — list / create / update / togglePin / remove
- [x] IPC + repo for notes
- [x] `NotesPage` — master–detail with type tabs (All / Notes / Daily / Bookmarks)
- [x] `NoteEditor` — title + markdown body; autosave; pin; delete
- [x] Daily note quick-create (date-titled)
- [x] Bookmark type — URL field + open-in-browser

## Phase 4.5 — Search (FTS5)

- [x] `migrate.ts` — create `tasks_fts` / `notes_fts` FTS5 external-content tables + sync triggers (raw DDL, `user_version`-guarded)
- [x] `searchRepo` — bm25-ranked query across tasks + notes, returning `SearchResult[]` with `snippet()`
- [x] `search` IPC channel + `store` wiring
- [x] Global search UI (top-bar input or command palette) → grouped task/note results → jump to item

## Phase 5 — Polish & package

- [x] Empty states, loading states, toasts everywhere
- [x] Keyboard shortcuts (new task/note, search, lock)
- [x] Dark mode toggle
- [x] App icon + `electron-builder.yml` for macOS `.dmg`
- [x] README quick start + first-run screenshots <!-- quick start done; real screenshots pending a GUI session (placeholder icon too) -->


## Phase 6 — Release CI & landing page

<!-- Spec: docs/tasks/phase-6-ci-release-landing.md -->

- [x] `electron-builder.yml` — add Windows NSIS target, per-runner mac `arch: [default]`, `nsis` block, `artifactName` (keep `identity: null` / `hardenedRuntime`)
- [x] `.github/workflows/release.yml` — `v*.*.*` tag → `version-check` → 3-target build matrix (macos-14 arm64, macos-13 x64, windows-latest) → publish GitHub Release
- [x] `.github/workflows/ci.yml` — push/PR guardrail: typecheck + lint + build (no packaging)
- [x] `site/index.html` — single static landing page (Tailwind CDN, app tokens): hero + download buttons, features, security callout, screenshots placeholder, footer; dynamic latest-release fetch with `/releases/latest` fallback
- [x] `.github/workflows/pages.yml` — deploy `site/` to `gh-pages`; document the one-time Settings → Pages step
- [x] Docs — Download / Releasing / Gatekeeper + SmartScreen notes in README


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
