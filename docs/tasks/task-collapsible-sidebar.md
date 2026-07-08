# Task: Collapsible icon-only left navigation

> **Owner:** coder sub-agent (model: sonnet) · **Status:** done
> **Depends on:** nothing — builds on shipped MVP (`AppShell.tsx`, existing sidebar tokens)
> **Read first:** [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md) §6 (Layout & shell), §7 (Iconography)

## Goal
The user can collapse the left sidebar to a slim **icon-only rail** (and expand it back), so
they can reclaim horizontal space for content. In both states the **active route's icon is
highlighted** with the accent background. Collapsed items show a **tooltip / accessible label**
with the route name on hover. The collapse preference **persists across app restarts**.

## Dependencies & setup
- Reuses the existing `AppShell.tsx` sidebar (`<nav className="... w-52 ...">` + `SidebarLink`)
  and the `bg-sidebar` / `sidebar-accent` tokens already in `globals.css`.
- Uses `lucide-react` (already a dep) for the nav icons.
- **Persistence:** store the collapsed boolean in `localStorage` under key
  `kouign.sidebar.collapsed` (renderer-only UI chrome pref — no encrypted-DB or IPC change
  needed). Read synchronously on first render so there's no expand→collapse flash.
  - *Alternative considered:* adding `sidebarCollapsed` to `AppSettings` (same path as `theme`).
    Rejected for this task to keep it a renderer-only change; can revisit if we want the pref
    to follow the datasource.

## Scope (sub-tasks)
### 1. Nav model — icons per route (`AppShell.tsx`)
Give each nav entry an icon:
- Todos → `ListTodo` (or `CheckSquare`), Notes → `StickyNote` (or `FileText`),
  Settings → `Settings` (gear).
- Define a small array `[{ to, label, Icon }]` and map over it, replacing the three hardcoded
  `<SidebarLink>` children.

### 2. Collapse state + toggle
- Local state `collapsed`, initialized from `localStorage`, written back on change (`useEffect`).
- A **collapse/expand toggle** control at the **bottom of the sidebar** (or top): a ghost
  icon-button using `PanelLeftClose` / `PanelLeftOpen` (lucide), with `title` + `aria-label`
  ("Collapse sidebar" / "Expand sidebar").
- Widths: expanded `w-52` (current 208px), collapsed `w-14` (56px). Add `transition-[width]`
  (≤150ms per DESIGN_SYSTEM §7).

### 3. `SidebarLink` — icon + optional label
- Accept `label`, `Icon`, and `collapsed` props.
- Expanded: icon + text label (icon `size-4`, `gap-2`).
- Collapsed: icon centered, text hidden; set `title={label}` and keep an `sr-only` label for
  a11y (DESIGN_SYSTEM §8 — icon-only buttons need labels).
- Active state (both modes): `bg-sidebar-accent text-sidebar-accent-foreground`; inactive
  `hover:bg-secondary`. Keep the visible `--ring` focus state.

## Out of scope (do NOT do)
- No hover-to-flyout submenus, no auto-collapse on window resize, no resizable/drag-to-size
  sidebar.
- No new shared types, IPC handlers, or `AppSettings` fields.
- No changes to the top bar, routes, or page content.
- No new tooltip library — use native `title` (+ `sr-only`); don't pull in a Radix tooltip
  for this.

## Acceptance criteria
- [x] Sidebar shows an icon **and** text label for Todos / Notes / Settings when expanded.
- [x] Clicking the toggle collapses the sidebar to an icon-only rail (~56px) and back; width
      animates smoothly.
- [x] In both states, the icon of the **current route** is highlighted with the accent
      background; navigating updates the highlight.
- [x] When collapsed, hovering an icon shows the route name (native `title`), and each
      icon-only link has an accessible name (`sr-only` / `aria-label`).
- [x] Collapse state **survives an app restart** (persisted to `localStorage`, no flash of the
      wrong state on load).
- [x] Keyboard focus ring is visible on nav items and the toggle in both states.
- [x] `npm run lint` / `npm run build` exit 0.

## Verification
```bash
npm run lint && npm run build
npm run dev
# 1. Unlock a datasource → sidebar shows icons + labels, active route highlighted.
# 2. Click toggle → collapses to icon rail; active icon still highlighted; hover shows tooltips.
# 3. Navigate Todos↔Notes↔Settings → highlight follows the route in both modes.
# 4. Quit & relaunch → sidebar restores the last collapsed/expanded state without flicker.
```
