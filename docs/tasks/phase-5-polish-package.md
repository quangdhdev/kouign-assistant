# Task: Phase 5 — Polish & package

> **Owner:** coder sub-agent (model: sonnet) · **Phase:** 5 · **Status:** ready
> **Depends on:** Phases 1–4.5 complete (features working end-to-end).
> **Read first:** [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md) §7 (icon/motion), §8 (accessibility);
> [CLAUDE.md](../../CLAUDE.md) commands + packaging note; [ARCHITECTURE.md](../../ARCHITECTURE.md) §8.

## Goal

Bring the MVP to a shippable state: consistent empty/loading/toast states, keyboard shortcuts,
a working dark-mode toggle, an app icon, macOS `.dmg` packaging via electron-builder, and a
README quick start with first-run screenshots.

## Scope (sub-tasks)

### 5.1 Empty / loading / toast states pass

Audit every view (Todos, Notes, Search, Settings, LockGate) for: an **empty state** when there's
no data, a **loading** indicator while stores load, and **toasts** on success/error for all
mutations. Use the existing ToastProvider (DESIGN_SYSTEM §5) — no new deps. Respect reduced-motion.

### 5.2 Keyboard shortcuts

Implement a small global shortcut layer (renderer). **Shortcut map (contract):**

| Shortcut | Action |
|----------|--------|
| ⌘N | New task (on Todos) / new note (on Notes) — context-aware |
| ⌘K | Open global search / command palette |
| ⌘L | Lock the datasource |
| ⌘, | Open Settings |
| Esc | Close dialog / palette / editor selection |

Shortcuts must not fire while typing in inputs (except Esc/⌘K). Document them in a Settings "help"
affordance or a small shortcuts hint.

### 5.3 Dark-mode toggle

Wire `AppSettings.theme` (`light | dark | system`) to a toggle in Settings and the top bar: apply
`.dark` on the root, follow the OS when `system` (`matchMedia('(prefers-color-scheme: dark)')`).
Tokens already exist from Phase 2 — this task is the toggle + persistence + system-follow only.

### 5.4 App icon + electron-builder packaging

- Add an app icon (`.icns` + source PNG) under `build/` (a simple placeholder mark is acceptable;
  note it as a design follow-up).
- `electron-builder.yml` (**config skeleton contract**):

```yaml
appId: com.bassistant.app
productName: Bassistant
directories:
  output: dist
  buildResources: build
files:
  - out/**/*
  - package.json
mac:
  category: public.app-category.productivity
  target: dmg
  icon: build/icon.icns
  hardenedRuntime: true
dmg:
  title: Bassistant
```

- Wire `npm run build:mac` (per CLAUDE.md) to produce a `.dmg`. Ensure the native module is
  packaged/rebuilt correctly (`electron-builder install-app-deps` in postinstall).
- Confirm code signing is **not** required to produce a local unsigned `.dmg` (note signing as a
  release follow-up; do not attempt notarization here).

### 5.5 README quick start + screenshots

Update `README.md` "Getting started" to reflect the real scripts and a first-run walkthrough
(create datasource → unlock → todos/notes). Add first-run screenshots (light + dark) under
`docs/` and reference them.

## Out of scope (do NOT do)

- No auto-update, no notarization/signing setup, no Windows/Linux targets (macOS `.dmg` only).
- No new features (tags, live integrations, export/import — all post-MVP).

## Acceptance criteria

- [ ] Every view has empty + loading states; all mutations toast success/error consistently.
- [ ] All shortcuts in the map work, are suppressed while typing (except Esc/⌘K), and are discoverable.
- [ ] Dark-mode toggle switches themes, persists via settings, and `system` follows the OS.
- [ ] `npm run build:mac` produces a launchable `Bassistant.dmg`; the packaged app opens a
      datasource (native module loads — no ABI error).
- [ ] README quick start matches real scripts; light + dark screenshots included.
- [ ] `npm run lint`/`build` exit 0.

## Verification

```bash
npm run lint && npm run build
npm run build:mac    # produces dist/Bassistant.dmg
open dist/Bassistant.dmg   # install + launch the packaged app, create/open a datasource
npm run dev          # exercise shortcuts, dark-mode toggle, empty/loading/toast states
```

Report the packaging output (dmg path + size), that the packaged app opened a datasource, and the
shortcut/dark-mode/state checks.

## Report back (to orchestrator)

Files created/edited, criterion mapping, packaging output and confirmation the signed-vs-unsigned
status, screenshots added, and any blockers (native module packaging, icon/signing follow-ups).
