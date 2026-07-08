# tasks.md — Kouign Assistant backlog

The MVP (Phases 0–6) is **shipped**. From here we work as a flat list of **single tasks** —
no more phases. Add a new task under **Tasks**, work it, check it off.
See [ARCHITECTURE.md](./ARCHITECTURE.md) and [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for the
"how" and "look".

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Tasks

<!-- Add new single tasks here, newest first. One line each; link a spec in docs/tasks/ if it needs one. -->

- [ ] User-managed categories, shared by Todos & Notes — [spec](./docs/tasks/task-shared-categories.md)
- [x] Tabbed Notes editor with first-line headers — [spec](./docs/tasks/task-notes-tabbed-editor.md)
- [x] Connect to local Ollama for on-device AI — [spec](./docs/tasks/task-ollama-ai-connection.md)
- [x] Kanban board view for Todos — [spec](./docs/tasks/task-todos-kanban-board.md)
- [x] Collapsible icon-only left navigation — [spec](./docs/tasks/task-collapsible-sidebar.md)

---

## Backlog / ideas

Candidate tasks — promote to **Tasks** when ready to build.

- [ ] Tags for tasks & notes (`tags`, `task_tags`, `note_tags`)
- [ ] Markdown live preview in the notes editor
- [ ] Live Jira/Slack integration (OAuth) to show issue status / message preview
- [ ] "Remember on this Mac" via macOS Keychain (`keytar`)
- [ ] Change-password / re-key datasource
- [ ] Export / import (encrypted backup)
- [ ] iCloud placeholder auto-download + conflict handling
- [ ] Reminders / due-date notifications

---

## Shipped — MVP (Phases 0–6) ✅

The original phased build is complete. Full specs preserved in
[`docs/tasks/`](./docs/tasks/); details in git history.

- [x] **Phase 0** — Project scaffold (Electron + electron-vite + React 19 + TS, Tailwind v4, shadcn/ui, lint)
- [x] **Phase 1** — Encrypted datasource core (SQLCipher connection/keying, Drizzle schema, migrations, repos, iCloud resolver)
- [x] **Phase 2** — App shell & unlock UI (shared contract, IPC handlers, preload bridge, LockGate + password policy, auto-lock, settings)
- [x] **Phase 3** — Todos (tasks IPC + store, TodosPage, TaskDialog, Jira/Slack chips, status advance)
- [x] **Phase 4** — Notes (notes IPC + store, master–detail page, autosave editor, daily notes, bookmarks)
- [x] **Phase 4.5** — Search (FTS5 tables + triggers, bm25 searchRepo, search IPC, global search UI)
- [x] **Phase 5** — Polish & package (empty/loading/toast states, shortcuts, dark mode, icon + `.dmg`, README)
- [x] **Phase 6** — Release CI & landing page (tag-triggered mac/Windows build matrix, GitHub Release, `gh-pages` site)
