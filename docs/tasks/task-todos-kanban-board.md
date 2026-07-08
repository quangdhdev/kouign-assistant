# Task: Kanban board view for Todos

> **Owner:** coder sub-agent (model: sonnet) · **Status:** ready
> **Depends on:** nothing — builds on shipped MVP (Phase 3 Todos: `useTasksStore`, `window.api.tasks.*`, `meta.ts`)
> **Read first:** [ARCHITECTURE.md](../../ARCHITECTURE.md) — Todos data model & `tasks` IPC;
> [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md) §2 (status colors), §4 (spacing/cards), §6 (view patterns)

## Goal
On the Todos page the user can switch between the existing **List** view and a new **Board**
(kanban) view. The board shows three columns — **To Do / In Progress / Done** — with each task
rendered as a card in the column matching its `status`. Dragging a card to another column
changes that task's status (persisted to the encrypted DB via the existing `tasks.update`
IPC). The category filter and "New task" flow keep working; the chosen view persists across
restarts.

## Dependencies & setup
- Reuses `useTasksStore` (`tasks`, `filter`, `load`, `update`, `remove`, `setOpenEditId`) and
  `window.api.tasks.update(id, { status })` — **no new IPC, repo, or migration**.
- Reuses `meta.ts` (`STATUS_LABEL`, `STATUS_BADGE_VARIANT`, `PRIORITY_*`, `CATEGORY_LABEL`) and
  the `LinkChip` pattern from `TodosPage.tsx`.
- **View preference** persists in `localStorage` under `kouign.todos.view`
  (`'list' | 'board'`), read synchronously on first render (no flash). Default `'list'` to
  preserve current behavior.
- **Drag-and-drop:** native HTML5 DnD (`draggable`, `onDragStart/Over/Drop`) — **no new
  dependency**. Accessibility fallback: each card keeps the existing "Set status →" overflow
  menu so status is changeable without dragging.

## Scope (sub-tasks)
### 1. Renderer — view toggle in `TodosPage.tsx`
- Add a **List / Board** segmented toggle in the header (next to "New task"), using `List` and
  `LayoutGrid` (or `Columns3`) lucide icons; active segment uses `bg-accent
  text-accent-foreground` (same as `Pill`).
- Hold `view` in state, initialized from `localStorage`; write back on change.
- In **Board** view: keep the **Category** filter pills, **hide the Status pills** (columns
  represent status). Render `<TodosBoard />`. In **List** view: unchanged.
- Both views share the same `tasks`/`filter` from the store and the same `TaskDialog`
  create/edit flow (incl. `openEditId` jump-to-edit and the ⌘N `newTaskSeq` handler).

### 2. Renderer — new `src/renderer/src/features/todos/TodosBoard.tsx`
- Three columns from a `STATUS_ORDER = ['todo','in_progress','done']` const; each column header
  shows `STATUS_LABEL[status]` + a count badge.
- Group `tasks` by `status`; within a column keep the store's existing order (dueDate/createdAt
  sort already applied — do not re-sort).
- Column is a drop target: `onDragOver` (preventDefault + highlight ring) and `onDrop` → if the
  dragged task's status differs, call `store.update(draggedId, { status: columnStatus }, toast)`.
  No-op when dropped on its own column.
- Empty column shows a subtle "Drop tasks here" placeholder.
- Horizontal layout: three equal flex columns, scrollable, `gap-4`, cards `gap-2`.

### 3. Renderer — `TaskCard` (in `TodosBoard.tsx` or a sibling file)
- Compact card (`bg-card`, `--radius-card`, `shadow-sm`, `border`): title, priority + status-less
  meta (due date, category), priority badge, Jira/Slack chips (reuse `LinkChip`), and the same
  overflow menu as the list row (Edit / Set status → / Delete-with-confirm).
- `draggable`; `onDragStart` sets the dragged task id (via `dataTransfer` and/or a ref); dim the
  card while dragging.
- Clicking the card body (not chips/menu) opens Edit — reuse `openEdit`.

## Out of scope (do NOT do)
- **No manual reordering / drag-to-position within a column, and no persisted card order** —
  there is no `orderIndex` in the schema; adding one (and a reorder IPC/migration) is a separate
  future task.
- No new columns beyond the three existing statuses; no per-column WIP limits; no swimlanes.
- No changes to `src/shared`, `src/main`, the `tasks` repo, or the DB schema.
- No new drag-and-drop library (no `@dnd-kit` / `react-beautiful-dnd`).
- No keyboard drag-and-drop (the "Set status" menu is the a11y path).

## Acceptance criteria
- [ ] The Todos header has a List/Board toggle; switching updates the view and persists across
      an app restart (defaults to List on first run).
- [ ] Board view shows three columns (To Do / In Progress / Done) with each task in the column
      matching its status, plus a per-column count.
- [ ] Dragging a card to a different column changes its status and persists — after quit &
      relaunch the task is still in the new column.
- [ ] The Category filter still applies in Board view; Status pills are hidden there.
- [ ] Creating a task (button or ⌘N) and the search palette's jump-to-edit both work while
      Board view is active.
- [ ] Each card supports Edit / Set status → / Delete-with-confirm and opens Jira/Slack links
      externally — matching the list row.
- [ ] `npm run lint` / `npm run build` exit 0.

## Verification
```bash
npm run lint && npm run build
npm run dev
# 1. Open Todos → toggle to Board → three columns with cards grouped by status.
# 2. Drag a card To Do → In Progress; badge/column updates; quit & relaunch → still In Progress.
# 3. Filter Category = Company → only company cards show across columns.
# 4. ⌘N → create a task → it appears in the To Do column.
# 5. Card overflow menu: Set status → Done moves it without dragging; Delete asks to confirm.
# 6. Toggle back to List → unchanged behavior; view choice persisted after relaunch.
```
