# Task: Phase 3 — Todos feature

> **Owner:** coder sub-agent (model: sonnet) · **Phase:** 3 · **Status:** ready
> **Depends on:** Phase 2 (app shell & unlock) complete. Can be built in parallel with Phase 4.
> **Read first:** [ARCHITECTURE.md](../../ARCHITECTURE.md) §4 (tasks table), §6 (IPC);
> [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md) §2 (status/priority colors), §6 (Todos view pattern).

## Goal

Ship the full **Todos** experience over the Phase 1 `taskRepo`: task IPC + Zustand store, the
Todos list page with category/status filters and empty state, a create/edit dialog, Jira/Slack
link chips that open in the browser, checkbox status advance, and a row overflow menu.

## Dependencies & setup

- Phase 1 `taskRepo` and Phase 2 IPC wrapper / preload / shell / `shell.openExternal` exist.
- Fill the `tasks` namespace declared (stubbed) in `shared/api.ts` during Phase 2.

## Scope (sub-tasks)

### 3.1 Contract — task DTOs (add to `src/shared/types.ts`)

```ts
export interface CreateTaskInput {
  title: string
  description?: string | null
  status?: TaskStatus        // default 'todo'
  priority?: TaskPriority     // default 'medium'
  category?: TaskCategory     // default 'personal'
  dueDate?: string | null
  jiraUrl?: string | null
  slackUrl?: string | null
}
export type UpdateTaskInput = Partial<CreateTaskInput>
export interface TaskFilter { category?: TaskCategory; status?: TaskStatus }
```

Fill the `tasks` methods in `shared/api.ts`:

```ts
tasks: {
  list(filter?: TaskFilter): Promise<IpcResult<Task[]>>
  create(input: CreateTaskInput): Promise<IpcResult<Task>>
  update(id: number, patch: UpdateTaskInput): Promise<IpcResult<Task>>
  remove(id: number): Promise<IpcResult<number>>          // returns removed id
  toggleStatus(id: number): Promise<IpcResult<Task>>      // advance todo→in_progress→done→todo
}
```

### 3.2 Main — `src/main/ipc/tasks.ts`

Register `IPC.tasks.*` via the `handle()` wrapper, delegating to `taskRepo(session.db)`.
Reject when locked (no open handle) with a typed error. `toggleStatus` advances the status cycle
and sets/clears `completedAt` (already in `taskRepo` from Phase 1 — reuse, don't reimplement).

### 3.3 Renderer — `store/tasks.ts` (Zustand)

`tasks: Task[]`, `filter: TaskFilter`, `loading`, and actions `load()`, `setFilter()`,
`create()`, `update()`, `toggleStatus()`, `remove()`. Actions call `window.api.tasks.*` through the
`unwrap` helper and surface errors as toasts. Keep list sorted (e.g. incomplete first, then by
due date / created).

### 3.4 Renderer — `features/todos/`

- `TodosPage.tsx` — single-column list (DESIGN_SYSTEM §6): pill filters above (category:
  All/Personal/Company; status: All/To Do/In progress/Done) driving `store.setFilter`, a **New
  task** button, and an **empty state** when the filtered list is empty.
- `TaskDialog.tsx` — shadcn Dialog for create/edit: title (required), description, status,
  priority, category (selects), due date (date input), and **Jira URL** + **Slack URL** fields.
  Validate title non-empty; reuse the dialog for both create and edit.
- Task row: checkbox that advances status (`toggleStatus`), title + meta (due date, category),
  **status & priority badges** (map to DESIGN_SYSTEM §2 badge colors — see `meta.ts`), inline
  **Jira/Slack chips** (shown when the URL is set) that call `window.api.shell.openExternal`, and a
  row **overflow menu** (Edit, Set status →, Delete with confirm).
- `features/todos/meta.ts` — label + badge-variant maps for status/priority/category, so colors
  come from tokens, not hardcoded values.

## Out of scope (do NOT do)

- No tags, no bulk actions, no drag-reorder (post-MVP).
- No live Jira/Slack fetching — links only (open in browser).
- No search integration (Phase 4.5 adds cross-entity search; Todos filters are local only).

## Acceptance criteria

- [ ] `tasks` IPC + store CRUD round-trips against the encrypted DB; list reflects create/update/
      delete without reload glitches.
- [ ] Category + status pill filters correctly narrow the list; empty state shows when appropriate.
- [ ] TaskDialog creates and edits all fields (title/description/status/priority/category/due/
      jira/slack); title required.
- [ ] Checkbox advances status todo→in_progress→done→todo and `completedAt` is set on done/cleared
      otherwise.
- [ ] Jira/Slack chips appear only when set and open in the OS browser via `shell.openExternal`
      (allowlist enforced).
- [ ] Row overflow menu edits, changes status, and deletes (with confirm).
- [ ] Status/priority badges use design tokens (no hardcoded hex). `npm run lint`/`build` exit 0.

## Verification

```bash
npm run lint && npm run build
npm run dev   # unlock → Todos: create tasks in both categories, filter, edit, toggle status,
              # add a Jira and Slack URL and open them, delete a task
```

Report lint/build results and the manual CRUD/filter/link walkthrough.

## Report back (to orchestrator)

Files created/edited, criterion-by-criterion mapping, verification walkthrough, blockers, and
confirmation the `tasks` api namespace now matches the contract for downstream phases.
