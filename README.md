# Kouign Assistant

> Your private, encrypted personal assistant for macOS — todos & notes in one place.

Kouign Assistant is an **offline-first Electron app** that keeps your daily tasks and notes in a
single **encrypted SQLite datasource**. Choose (or create) your datasource when the app
starts, protect it with a password, and optionally keep the file in **iCloud Drive** so it
syncs across your Macs — always encrypted at rest.

## Download

**[Download the latest release →](https://github.com/quangdhdev/kouign-assistant/releases/latest)**

| Platform | Installer |
|----------|-----------|
| macOS Apple Silicon | `Kouign Assistant-<version>-arm64.dmg` |
| Windows x64 | `Kouign Assistant-<version>-x64.exe` |
| Linux x64 | `Kouign Assistant-<version>-x64.AppImage` |

Landing page: **[quangdhdev.github.io/kouign-assistant](https://quangdhdev.github.io/kouign-assistant/)**

> **Unsigned build:** the installers are not code-signed. See [First launch](#first-launch--unsigned-build) below.

## Features (MVP)

- **Todos** — manage personal and company tasks with status, priority, due dates, and
  **Jira / Slack links** you can open in one click.
- **Notes** — freeform notes, a **daily journal**, and **bookmarks**, all searchable in
  one place.
- **Encrypted datasource** — full-database SQLCipher encryption; the password never
  leaves your machine and is never stored.
- **iCloud-friendly** — store the datasource file in iCloud Drive to sync across devices.
- **Dark mode** — light / dark / system theme, persisted across sessions.
- **Keyboard shortcuts** — ⌘N, ⌘K, ⌘L, ⌘, for power users.

## Tech stack

Electron · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui (Atlassian-flavored) ·
Drizzle ORM · better-sqlite3-multiple-ciphers (SQLCipher) · Zustand.

## Getting started

### Prerequisites

- macOS (Apple Silicon or Intel)
- Node.js 20+

### Install & run

```bash
# 1. Install dependencies (also rebuilds the native SQLite module for Electron)
pnpm install

# 2. Launch the app with hot reload for development
pnpm dev

# 3. Typecheck + production build
pnpm build

# 4. Package a macOS .dmg (unsigned — for local use)
pnpm build:mac
```

> **Native module note:** `better-sqlite3-multiple-ciphers` must be rebuilt against
> Electron's ABI. The `postinstall` hook (`electron-builder install-app-deps`) handles this
> automatically after `pnpm install`.

### First-run walkthrough

1. **Launch the app** — you'll see the LockGate screen (datasource picker).
2. **Create a datasource** — click "Create new…", choose a save location (iCloud Drive
   recommended), give it a label, and set a strong password (min. 8 characters).
   - **Warning:** There is no password recovery. Store it somewhere safe.
3. **Unlock** — enter your password. The app opens to the Todos view.
4. **Add a task** — click "New task" or press ⌘N. Fill in title, priority, due date, and
   optionally a Jira or Slack link.
5. **Add a note** — navigate to Notes (sidebar or ⌘, then Notes), click "New", choose
   "New note", "New daily note", or "New bookmark".
6. **Search** — press ⌘K to open the search palette. Full-text search spans both tasks
   and notes (FTS5 ranking).
7. **Lock** — click the Lock button in the top bar, press ⌘L, or let the auto-lock timer
   fire. The datasource is closed and you return to the LockGate.

### Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘N | New task (on Todos) / new note (on Notes) |
| ⌘K | Open global search palette |
| ⌘L | Lock the datasource |
| ⌘, | Open Settings |
| Esc | Close dialog / search palette |

## First launch — unsigned build

The distributed installers are **unsigned** (no Apple Developer certificate, no Windows
Authenticode). Your OS will warn you on first launch — this is expected.

### macOS — Gatekeeper

1. Open **Finder** and locate `Kouign Assistant.app` (or mount the `.dmg`).
2. **Right-click** (or Control-click) the app → **Open**.
3. Click **Open** in the Gatekeeper dialog that appears.

Alternatively: **System Settings → Privacy & Security** → scroll down →
click **"Open Anyway"** next to the Kouign Assistant entry.

### Windows — SmartScreen

1. Run the `.exe` installer; SmartScreen will show a blue warning.
2. Click **More info**.
3. Click **Run anyway**.

### Linux — AppImage

1. Download the `.AppImage` file.
2. Make it executable: `chmod +x "Kouign Assistant-<version>-x64.AppImage"`.
3. Run it directly — no install step, no root required.

Code signing and notarization are planned for a future release.

## Releasing

To publish a new release, bump the version in `package.json`, commit, and push a version tag:

```bash
# Ensure package.json "version" matches the tag you're about to push
git tag v0.1.0
git push origin v0.1.0
```

The `release.yml` CI workflow will:
1. Verify the tag matches `package.json` version (fails fast if they disagree).
2. Build macOS arm64 (Apple Silicon), Windows NSIS, and Linux AppImage installers in parallel.
3. Publish a GitHub Release with all three installers attached.

## Screenshots

<!-- TODO: Capture real screenshots after first stable build. -->
<!-- Screenshots require a running GUI session and cannot be generated headlessly. -->
<!-- Add light + dark mode screenshots here once the packaged app is running. -->

See `docs/screenshots/` — real screenshots are a follow-up task (requires a running GUI
session with actual datasource data).

## Documentation

| Doc | What's inside |
|-----|---------------|
| [CLAUDE.md](./CLAUDE.md) | Project overview, rules, conventions, commands |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Process model, security boundary, data model, IPC, unlock flow |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Color tokens, typography, spacing, components |
| [tasks.md](./tasks.md) | Phased build backlog / checklist |

## Security note

The entire database is encrypted with your password using SQLCipher.
**If you lose the password, the data cannot be recovered** — there is no backdoor and
no reset. Keep your password somewhere safe.

## Packaging

`pnpm build:mac` produces an **unsigned** `.dmg` at `dist/Kouign Assistant-<version>-arm64.dmg`
(or `-x64.dmg` on Intel). The filename embeds the version and architecture.

- Code signing and notarization are release follow-ups (require an Apple Developer account).
- The `.dmg` can be opened locally without signing on your own Mac — see
  [First launch](#first-launch--unsigned-build) above.
- To enable the GitHub Pages landing page: **Settings → Pages → Source = `gh-pages` branch, `/ (root)`**.

## App icon

`build/icon.icns` is a placeholder (solid Kouign blue #0052CC). A proper icon design is
a follow-up task.
