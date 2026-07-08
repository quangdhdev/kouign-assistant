# Task: User-managed categories, shared by Todos & Notes

> **Owner:** coder sub-agent (model: sonnet) · **Status:** ready
> **Depends on:** shipped MVP (tasks/notes repos, `settings` IPC). Related but distinct from the
> backlog "Tags for tasks & notes" (tags = multi-select; categories = single-select — they can
> coexist).
> **Read first:** [ARCHITECTURE.md](../../ARCHITECTURE.md) §4 (data model / migrations), §6 (IPC surface);
> [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md) §2 (status/priority colors), §5 (Select/Input/Badge), §6 (Settings)

## Goal
Introduce a single set of **user-managed categories** stored in the encrypted DB and usable by
**both tasks and notes**. Users manage them (create / rename / recolor / delete) from a
**Categories** section in Settings. Each task and note can be assigned **one** category (or
none). The existing fixed `personal` / `company` task categories are migrated into seeded managed
categories so nothing is lost. Filters and pickers in Todos and Notes become dynamic from this
list.

## Dependencies & setup
- Extends the DB (schema + migration bump), `repositories.ts`, adds a **`categories` IPC
  domain**, and changes the `Task`/`Note` shape (`category` enum → `categoryId`).
- Reuses the `handle()` wrapper, `requireDb()` lock guard, `user_version` migration pattern, and
  the Zustand/`unwrap` store pattern.
- **Migration** (`SCHEMA_VERSION` 2 → 3): new `categories` table + `category_id` FK columns on
  `tasks` and `notes`, seed **Personal**/**Company**, backfill existing tasks. FTS unaffected
  (category isn't indexed) — but search SELECTs must include the new column.

## Scope (sub-tasks)
### 1. Contract — `src/shared/types.ts`, `ipc.ts`, `api.ts`
```ts
export type CategoryColor = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple'
export interface Category { id: number; name: string; color: CategoryColor | null; createdAt: string }
export interface CreateCategoryInput { name: string; color?: CategoryColor | null }
export type UpdateCategoryInput = Partial<CreateCategoryInput>

// Task: REMOVE `TaskCategory` + `category`; ADD:
categoryId: number | null
// CreateTaskInput.category → categoryId?: number | null ; TaskFilter.category → categoryId?: number

// Note: ADD categoryId: number | null ; CreateNoteInput/UpdateNoteInput add categoryId?; NoteFilter adds categoryId?
```
```ts
// ipc.ts
categories: { list: 'categories:list', create: 'categories:create', update: 'categories:update', remove: 'categories:remove' }
// api.ts — KouignApi.categories
categories: {
  list(): Promise<IpcResult<Category[]>>
  create(input: CreateCategoryInput): Promise<IpcResult<Category>>
  update(id: number, patch: UpdateCategoryInput): Promise<IpcResult<Category>>
  remove(id: number): Promise<IpcResult<number>>   // returns removed id; referencing tasks/notes become uncategorized
}
```

### 2. Main — migration + repo + IPC
- **`migrate.ts`** (`SCHEMA_VERSION = 3`, `if (currentVersion < 3)` block):
  ```sql
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, color TEXT, created_at TEXT NOT NULL);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
  ALTER TABLE tasks ADD COLUMN category_id INTEGER;   -- nullable
  ALTER TABLE notes ADD COLUMN category_id INTEGER;   -- nullable
  CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON tasks(category_id);
  CREATE INDEX IF NOT EXISTS idx_notes_category_id ON notes(category_id);
  ```
  Then (guard with "seed only if empty"): insert **Personal** (`blue`) and **Company** (`green`)
  with `now()`; backfill `UPDATE tasks SET category_id = (SELECT id FROM categories WHERE
  name='Personal') WHERE category='personal'` (and Company). Leave the legacy `tasks.category`
  column in place (NOT NULL default) but **stop reading/writing it** — `category_id` is the
  source of truth.
- **`repositories.ts`**: add `categoryRepo(db)` = `list` (by name ASC), `create`, `update`,
  `remove` (**null out references first**: `UPDATE tasks SET category_id=NULL WHERE
  category_id=?`, same for notes, then delete). Enforce unique name — map the SQLite constraint
  error to a friendly "A category named '…' already exists."
  - `mapTask`/`mapNote`: add `categoryId: row.category_id ?? null`. Add `category_id` to
    `RawTaskRow`/`RawNoteRow` and to **every** `SELECT` (incl. the two `searchRepo` queries).
    `taskRepo.list`/`noteRepo.list` accept `categoryId` filter; `create`/`update` persist
    `categoryId`.
- **`src/main/ipc/categories.ts`**: `registerCategoryHandlers()` for the four channels via
  `handle()` + `requireDb()`. Register in main; add channels to the preload whitelist.

### 3. Renderer — store, Settings management, and pickers
- **`store/categories.ts`**: `categories`, `load()`, `create/update/remove` via
  `window.api.categories.*`. Load on unlock (alongside tasks/notes).
- **Settings — Categories section** (the "where to manage"): list each category with a color
  swatch + name, inline **rename**, a **color** picker (the 6 `CategoryColor` swatches, tokenized
  — no hardcoded hex), **Add category** row, and **Delete** with confirm ("Tasks/notes in this
  category will become uncategorized"). Round-trips via the store.
- **Todos**: replace `meta.ts` `CATEGORY_LABEL`/`TaskCategory` usage — category filter pills
  become **dynamic** (`All` + one per category + `Uncategorized`); `TaskDialog` gets a category
  `Select` (incl. "None"); list rows / kanban cards show the category name with its color dot;
  kanban quick-add inherits the active `categoryId` filter.
- **Notes**: add a category `Select` in `NoteEditor` (incl. "None"); show the category on the
  note; add a category filter control to the notes sidebar (dynamic list). Reuse the same
  categories store.

## Out of scope (do NOT do)
- No multi-category / tags (that's the separate "Tags" backlog item) — **one** category per item.
- No per-category icons, ordering/drag-sort, or nested/sub-categories.
- No color values outside the fixed `CategoryColor` set; no hardcoded hex (use tokens).
- Don't drop the legacy `tasks.category` column (leave it; just stop using it) — avoids a risky
  table rebuild.
- No changes to FTS ranking/behavior beyond adding `category_id` to the SELECT projections.

## Acceptance criteria
- [ ] Settings has a **Categories** manager: create, rename, recolor, and delete categories;
      changes persist across relaunch.
- [ ] Existing datasources upgrade cleanly: prior tasks show **Personal**/**Company** as managed
      categories (backfilled), and both appear in the manager.
- [ ] A task can be assigned any category or none; the Todos category filter is dynamic (incl.
      Uncategorized) and drives the list + kanban.
- [ ] A note can be assigned a category (or none) in the editor; the notes sidebar can filter by
      category.
- [ ] Deleting a category leaves its tasks/notes intact but **uncategorized** (no orphaned
      references, no crash).
- [ ] Creating a duplicate-named category shows a friendly error, not an unhandled rejection.
- [ ] Global search still works and returns tasks/notes (SELECTs include `category_id`).
- [ ] `npm run lint` / `npm run build` exit 0.

## Verification
```bash
npm run lint && npm run build
npm run dev
# 1. Open an existing datasource → Settings ▸ Categories shows Personal & Company; old tasks keep their category.
# 2. Add "Finance" (red). Create a task and a note, assign "Finance" to each.
# 3. Todos filter by Finance → the task shows; Notes filter by Finance → the note shows.
# 4. Rename Finance → "Money"; recolor → reflected everywhere.
# 5. Delete "Money" → its task & note remain, now Uncategorized; app stays responsive.
# 6. Try to add a category named "Personal" again → friendly "already exists" error.
# 7. Quit & relaunch → categories + assignments persist; ⌘K search still returns items.
```
