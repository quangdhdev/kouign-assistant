# Design System — Bassistant

Bassistant's UI follows an **Atlassian / Jira-flavored** design language, implemented with
**Tailwind CSS v4** and **shadcn/ui** primitives. This document defines the tokens and
conventions so the app looks consistent and familiar.

## 1. Principles

- **Familiar & calm** — mirror Jira's clean, information-dense but low-chroma look.
- **Content first** — neutral surfaces, one confident brand blue for actions and selection.
- **Consistent tokens** — never hardcode colors/spacing in components; use tokens/utilities.
- **Accessible** — visible focus rings, WCAG-AA text contrast, keyboard-navigable.

## 2. Color tokens

Tokens are defined as CSS variables in `src/renderer/src/styles/globals.css` and mapped to
Tailwind utilities via `@theme inline` (so `bg-background`, `text-muted-foreground`,
`border-border`, etc. work). shadcn/ui consumes the same variables.

### Light theme

| Token | Hex | Atlassian ref | Usage |
|-------|-----|---------------|-------|
| `--background` | `#F4F5F7` | N20 | App canvas |
| `--foreground` | `#172B4D` | N800 | Primary text |
| `--card` / `--popover` | `#FFFFFF` | N0 | Surfaces, panels |
| `--primary` | `#0052CC` | Blue B400 | Primary buttons, links, focus |
| `--primary-foreground` | `#FFFFFF` | | Text on primary |
| `--secondary` | `#EBECF0` | N30 | Subtle button / chip bg |
| `--muted` | `#EBECF0` | N30 | Muted surfaces |
| `--muted-foreground` | `#6B778C` | N200 | Secondary text |
| `--accent` | `#DEEBFF` | B50 | Selected nav / active filter bg |
| `--accent-foreground` | `#0747A6` | B500 | Text on accent |
| `--destructive` | `#DE350B` | R400 | Danger actions |
| `--success` | `#36B37E` | G400 | Done / success |
| `--warning` | `#FFAB00` | Y400 | Warnings, medium priority |
| `--border` / `--input` | `#DFE1E6` | N40 | Borders, inputs |
| `--ring` | `#4C9AFF` | B300 | Focus ring |
| `--sidebar` | `#FFFFFF` | | Sidebar surface |
| `--sidebar-accent` | `#DEEBFF` | B50 | Active nav item |

### Dark theme (`.dark`)

Uses Atlassian's dark neutrals (DN scale): canvas `#1D2125`, surface `#22272B`, text
`#C7D1DB`, primary `#579DFF`, borders `#38414A`. Full mapping lives in `globals.css`.

### Status & priority colors (badges)

| Meaning | Background | Text |
|---------|-----------|------|
| Success / Done | `#E3FCEF` | `#006644` |
| Warning / Medium | `#FFFAE6` | `#974F0C` |
| Danger / High | `#FFEBE6` | `#BF2600` |
| Info / In progress | `#DEEBFF` (accent) | `#0747A6` |
| Neutral / To Do | `#EBECF0` (secondary) | `#172B4D` |

## 3. Typography

- **Font stack** (`--font-sans`): `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
  "Helvetica Neue", Arial, sans-serif` — matches Atlassian's system UI approach.
- **Base size**: 14px. **Scale**: 11 / 12 / 14 / 16 / 20 / 24 px.

| Role | Size | Weight |
|------|------|--------|
| Page title | 20px | 600 |
| Section / card title | 16px | 600 |
| Body | 14px | 400–500 |
| Secondary / meta | 12–13px | 400 |
| Labels (uppercase) | 11–12px | 600–700, tracked, muted |
| Badges | 11px | 700 uppercase |

## 4. Spacing, radius, elevation

- **Spacing** — 4px base grid: `4 / 8 / 12 / 16 / 24 / 32`.
- **Radius** — controls `3px` (`--radius`, Jira-like), cards `8px` (`--radius-card`).
- **Elevation** — subtle shadows: `shadow-sm` on cards/inputs, `shadow-lg`/`shadow-xl` on
  popovers and dialogs. Dialog overlay uses a translucent navy scrim (`#091E4229`).
- **Density** — compact: default control height `32px` (`h-8`), small `28px` (`h-7`).

## 5. Components (shadcn/ui, restyled)

Primitives live in `src/renderer/src/components/ui/`. Restyle via tokens; don't fork logic.

| Component | Notes |
|-----------|-------|
| **Button** | Variants: `default` (blue), `subtle`, `outline`, `ghost`, `destructive`, `link`. Sizes: `sm`, `default`, `lg`, `icon`. |
| **Input / Textarea** | 32px height, 3px radius, blue focus ring + border. |
| **Label** | Uppercase, tracked, muted — Atlassian field-label style. |
| **Badge** | Status/priority pills; variants `default/primary/success/warning/danger/outline`. |
| **Card** | White surface, 8px radius, `shadow-sm`. |
| **Dialog** | Centered, navy scrim, close affordance top-right. Used for task create/edit. |
| **Select / Checkbox / Dropdown** | Radix-based, tokenized. Checkbox turns blue when checked. |
| **Toast** | Lightweight app-wide provider (no external dep); success/error/info. |

## 6. Layout & shell

- **Frameless macOS window** with `hiddenInset` traffic lights; top bar is `-webkit-app-region: drag`
  (interactive controls opt out with `.app-no-drag`).
- **Top bar** (48px): datasource name on the left, **Lock** button on the right.
- **Left sidebar** (208px): nav for **Todos**, **Notes**, **Settings**; active item uses the
  accent (subtle blue) background — same pattern as Jira's project sidebar.
- **Content area**: scrollable, max-width containers for readability.

### View patterns

- **Todos** — a single-column task list with pill filters (category + status) above it, a
  checkbox to advance status, inline Jira/Slack link chips, and a row overflow menu.
- **Notes** — master–detail: a left list with type tabs (All / Notes / Daily / Bookmarks)
  and a right editor pane (title + markdown body; URL field for bookmarks).

## 7. Iconography & motion

- **Icons**: [lucide-react](https://lucide.dev), 16px (`size-4`) inside controls.
- **Motion**: short, subtle. Dialogs/popovers use fade + slight zoom; toasts slide up.
  Keep durations ≤150ms; avoid decorative animation.

## 8. Accessibility checklist

- All interactive elements reachable by keyboard; visible `--ring` focus state.
- Text meets WCAG-AA contrast on its surface (light & dark).
- Icon-only buttons include `title` / `sr-only` labels.
- Respect reduced-motion preferences for non-essential animation.
