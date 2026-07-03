# Task: Phase 4 — Notes feature

> **Owner:** coder sub-agent (model: sonnet) · **Phase:** 4 · **Status:** ready
> **Depends on:** Phase 2 (app shell & unlock) complete. Can be built in parallel with Phase 3.
> **Read first:** [ARCHITECTURE.md](../../ARCHITECTURE.md) §4 (notes table), §6 (IPC);
> [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md) §6 (Notes master–detail pattern).

## Goal

Ship the full **Notes** experience over the Phase 1 `noteRepo`: note IPC + Zustand store, a
master–detail page with type tabs (All / Notes / Daily / Bookmarks), an editor pane (title +
markdown source, autosave, pin, delete), daily-note quick create, and the bookmark type with a
URL that opens in the browser.

## Dependencies & setup

- Phase 1 `noteRepo` and Phase 2 IPC/preload/`shell.openExternal` exist.
- Fill the `notes` namespace declared (stubbed) in `shared/api.ts` during Phase 2.

## Scope (sub-tasks)

### 4.1 Contract — note DTOs (add to `src/shared/types.ts`)

```ts
export interface CreateNoteInput {
  title: string
  content?: string           // markdown source, default ''
  type?: NoteType            // default 'note'
  url?: string | null        // bookmarks
  pinned?: boolean           // default false
}
export type UpdateNoteInput = Partial<CreateNoteInput>
export interface NoteFilter { type?: NoteType }
```

Fill the `notes` methods in `shared/api.ts`:

```ts
notes: {
  list(filter?: NoteFilter): Promise<IpcResult<Note[]>>
  create(input: CreateNoteInput): Promise<IpcResult<Note>>
  update(id: number, patch: UpdateNoteInput): Promise<IpcResult<Note>>
  remove(id: number): Promise<IpcResult<number>>       // returns removed id
  togglePin(id: number): Promise<IpcResult<Note>>
}
```

### 4.2 Main — `src/main/ipc/notes.ts`

Register `IPC.notes.*` via the `handle()` wrapper, delegating to `noteRepo(session.db)`; reject
when locked. `togglePin` and CRUD reuse the Phase 1 repo (don't reimplement mapping).

### 4.3 Renderer — `store/notes.ts` (Zustand)

`notes: Note[]`, `filter: NoteFilter`, `selectedId: number | null`, `loading`, actions
`load()`, `setFilter()`, `select()`, `create()`, `update()`, `togglePin()`, `remove()`. Sort:
pinned first, then `updatedAt` desc. Errors → toasts via `unwrap`.

### 4.4 Renderer — `features/notes/`

- `NotesPage.tsx` — master–detail (DESIGN_SYSTEM §6): left list with **type tabs**
  (All / Notes / Daily / Bookmarks) driving `store.setFilter`, a **New** control (with a quick
  **New daily note** action), a pin indicator on rows, and selection; right pane renders
  `NoteEditor` for the selected note or an empty state.
- `NoteEditor.tsx` — title input + markdown **source** textarea body (no live preview — that's
  post-MVP), **autosave** on change (debounced ~500ms → `store.update`), a **pin** toggle, and
  **delete** (with confirm). For `type === 'bookmark'`, show a **URL field** + an open-in-browser
  action via `window.api.shell.openExternal`.
- Daily note quick-create: create a `type: 'daily'` note titled with today's date
  (`yyyy-mm-dd`); if one already exists for today, select it instead of duplicating.

## Out of scope (do NOT do)

- No markdown live preview / rich editor (post-MVP) — plain markdown source only.
- No search integration (Phase 4.5).
- No tags, no attachments, no folders (post-MVP).

## Acceptance criteria

- [ ] `notes` IPC + store CRUD round-trips against the encrypted DB.
- [ ] Type tabs filter the list (All/Notes/Daily/Bookmarks); pinned notes sort to the top.
- [ ] Selecting a note opens it in the editor; empty state shows when nothing is selected.
- [ ] Editor autosaves title + body (debounced), toggles pin, and deletes (with confirm).
- [ ] "New daily note" creates a date-titled `daily` note and reuses an existing one for the same
      day instead of duplicating.
- [ ] Bookmark notes show a URL field and open the URL in the OS browser (allowlist enforced).
- [ ] `npm run lint`/`build` exit 0.

## Verification

```bash
npm run lint && npm run build
npm run dev   # unlock → Notes: create a note/daily/bookmark, edit + confirm autosave, pin/unpin,
              # filter by tab, open a bookmark URL, delete a note
```

Report lint/build results and the manual walkthrough (including autosave and daily de-dup).

## Report back (to orchestrator)

Files created/edited, criterion mapping, verification walkthrough, blockers, and confirmation the
`notes` api namespace matches the contract (needed before Phase 4.5 search wiring).
