# Task: Tabbed Notes editor with first-line headers

> **Owner:** coder sub-agent (model: sonnet) · **Status:** ready
> **Depends on:** nothing — builds on shipped MVP (Phase 4 Notes: `useNotesStore`, `window.api.notes.*`, `NotesPage`, `NoteEditor`)
> **Read first:** [ARCHITECTURE.md](../../ARCHITECTURE.md) §4 (Notes data model / FTS), §6 (IPC surface);
> [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md) §5 (Input/Textarea/Button), §6 (Notes view pattern)

## Goal
The Notes page becomes a **tabbed editor**. Clicking a note in the left list opens it as a
**tab** in the right area; multiple notes can be open at once, each with its own tab (title +
close ×). For plain **notes**, the **first line of the body is the header/title** — there's no
separate title field; the first line is auto-synced into the DB `title` column so search, the
sidebar list, and tab labels keep working. **Daily** notes and **bookmarks** keep their existing
fields. Open tabs and the active tab **persist across app restarts / re-unlock** (per
datasource). No schema or IPC change — this is a renderer-only refactor over the existing notes
repo.

## Dependencies & setup
- Reuses `useNotesStore`, `window.api.notes.*` (`list/create/update/remove/togglePin`), and the
  existing autosave pattern in `NoteEditor`.
- **No `src/shared`, `src/main`, DB, or IPC changes.** The `title` column stays; it's just
  written from the first body line for plain notes.
- **Tab persistence:** `localStorage` under `kouign.notes.tabs`, a JSON map keyed by datasource
  path → `{ openTabIds: number[]; activeTabId: number | null }`. Datasource path comes from
  `useSessionStore().state.datasource?.path`.
- **Sidebar filtering becomes client-side** so an open tab's note data is always available even
  when the active type filter would hide it (see 2).

## Scope (sub-tasks)
### 1. Store — tab state (`src/renderer/src/store/notes.ts`)
- Replace single-selection with tab state:
  ```ts
  openTabIds: number[]          // order = tab order
  activeTabId: number | null
  select(id): void              // open (if not open) + activate — keep the name so search-palette callers still work
  setActiveTab(id: number): void
  closeTab(id: number): void    // remove from openTabIds; if it was active, activate the neighbor (or null)
  ```
- `create()` → opens the new note as a tab and activates it. `remove()` → also `closeTab(id)`.
- **Persistence:** load/save `{ openTabIds, activeTabId }` for the current datasource path on
  every tab change; on `load()` completion, **restore** from `localStorage` and drop ids not
  present in the loaded notes (deleted since). If `activeTabId` is stale, fall back to the first
  open tab.

### 2. Store — full-list load + client-side filter
- `load()` fetches the **full** list (`notes.list({})`) into `notes`; keep `filter` in the store
  but treat it as a **display filter** for the sidebar only (derive `visibleNotes` in the page).
  `setFilter()` just sets `filter` — no reload, no clearing tabs.
- Rationale: tabs reference `notes.find(id)`; a server-side filter could hide an open tab's data.
  Note volumes are personal-scale, so client-side filtering is fine.

### 3. Renderer — `NotesPage.tsx` tab bar
- Left list unchanged except it renders `visibleNotes` and highlights rows whose id is in
  `openTabIds` (active tab emphasized). Clicking a row → `select(id)`.
- Right area = **tab strip** + active editor:
  - Tab strip: horizontal, scrollable; each tab shows the note title (truncated ~20ch) + a close
    `×`; active tab uses `bg-accent text-accent-foreground`, others `hover:bg-secondary`.
    Clicking a tab → `setActiveTab`; clicking `×` → `closeTab` (stopPropagation).
  - Below the strip: `<NoteEditor note={activeNote} />`, or the existing empty state when no tabs
    are open.

### 4. Renderer — `NoteEditor.tsx` first-line header (plain notes)
- For `note.type === 'note'`: **remove the separate title `Input`.** Split `note.content` at the
  first newline into `header` (first line) and `body` (rest):
  ```ts
  const nl = content.indexOf('\n')
  const header = nl === -1 ? content : content.slice(0, nl)
  const body   = nl === -1 ? ''      : content.slice(nl + 1)
  ```
  - Render `header` as a large title-styled **single-line** input (like the current title
    styling) and `body` as the markdown textarea.
  - On change, recombine `content = body.length ? header + '\n' + body : header` and derive the
    title:
    ```ts
    const deriveTitle = (h: string) => h.replace(/^#{1,6}\s*/, '').trim() || 'Untitled'
    ```
    Autosave `{ title: deriveTitle(header), content }` (same 500ms debounce).
- For `daily` and `bookmark`: **keep the existing title `Input`** (and the bookmark URL field)
  exactly as today.

## Out of scope (do NOT do)
- No changes to `src/shared`, `src/main`, the notes repo, DB schema, or FTS triggers.
- No markdown live preview, no rich-text/WYSIWYG (still markdown source) — that's a separate
  backlog item.
- No drag-to-reorder tabs, no "pin tab", no split view, no tab context menu.
- Don't change daily/bookmark title behavior (they are **not** first-line-derived).
- Don't remove the sidebar list or the type tabs; don't touch the ⌘N new-note flow or the
  search-palette jump-to (it calls `select`).

## Acceptance criteria
- [ ] Clicking notes opens each as a tab; multiple tabs stay open; switching tabs shows the right
      note; `×` closes a tab and activates a neighbor.
- [ ] For a plain note, the first line is the header (no separate title field); editing the first
      line updates the tab label and the sidebar list title.
- [ ] The DB `title` stays in sync (search finds the note by its first-line text; reopening shows
      the same title).
- [ ] Daily notes and bookmarks still show their title field (and bookmarks their URL) —
      unchanged.
- [ ] Open tabs + active tab **persist across quit/relaunch and lock/unlock**, scoped per
      datasource; deleted notes don't reappear as tabs.
- [ ] Type tabs (All/Notes/Daily/Bookmarks) filter the sidebar without closing open tabs.
- [ ] `npm run lint` / `npm run build` exit 0.

## Verification
```bash
npm run lint && npm run build
npm run dev
# 1. Open 3 notes → 3 tabs; switch between them; close the middle one → neighbor activates.
# 2. In a plain note, type "Groceries" on line 1 → tab + list row read "Groceries"; add body lines below.
# 3. ⌘K search "Groceries" → the note is found by its first line.
# 4. Open a daily note and a bookmark → both still show their title field (bookmark shows URL).
# 5. Switch type filter to Bookmarks → sidebar filters; open tabs remain.
# 6. Quit & relaunch, unlock → the same tabs reopen with the same active tab.
```
