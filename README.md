# Kouign Assistant

> Your private, encrypted personal assistant for macOS — todos & notes in one place.

Kouign Assistant is an **offline-first Electron app** that keeps your daily tasks and notes in a
single **encrypted SQLite datasource**. Choose (or create) your datasource when the app
starts, protect it with a password, and optionally keep the file in **iCloud Drive** so it
syncs across your Macs — always encrypted at rest.

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
npm install

# 2. Launch the app with hot reload for development
npm run dev

# 3. Typecheck + production build
npm run build

# 4. Package a macOS .dmg (unsigned — for local use)
npm run build:mac
```

> **Native module note:** `better-sqlite3-multiple-ciphers` must be rebuilt against
> Electron's ABI. The `postinstall` hook (`electron-builder install-app-deps`) handles this
> automatically after `npm install`.

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

`npm run build:mac` produces an **unsigned** `.dmg` at `dist/Kouign Assistant.dmg`.

- Code signing and notarization are release follow-ups (require an Apple Developer account).
- The `.dmg` can be opened locally without signing on your own Mac after allowing it in
  System Settings > Privacy & Security.

## App icon

`build/icon.icns` is a placeholder (solid Kouign blue #0052CC). A proper icon design is
a follow-up task.
