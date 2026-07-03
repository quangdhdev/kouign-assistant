# Bassistant

> Your private, encrypted personal assistant for macOS — todos & notes in one place.

Bassistant is an **offline-first Electron app** that keeps your daily tasks and notes in a
single **encrypted SQLite datasource**. Choose (or create) your datasource when the app
starts, protect it with a password, and optionally keep the file in **iCloud Drive** so it
syncs across your Macs — always encrypted at rest.

## Features (MVP)

- **📋 Todos** — manage personal and company tasks with status, priority, due dates, and
  **Jira / Slack links** you can open in one click.
- **📝 Notes** — freeform notes, a **daily journal**, and **bookmarks**, all searchable in
  one place.
- **🔒 Encrypted datasource** — full-database SQLCipher encryption; the password never
  leaves your machine and is never stored.
- **☁️ iCloud-friendly** — store the datasource file in iCloud Drive to sync across devices.

## Tech stack

Electron · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui (Atlassian-flavored) ·
Drizzle ORM · better-sqlite3-multiple-ciphers (SQLCipher) · Zustand.

## Documentation

| Doc | What's inside |
|-----|---------------|
| [CLAUDE.md](./CLAUDE.md) | Project overview, rules, conventions, commands |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Process model, security boundary, data model, IPC, unlock flow |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Color tokens, typography, spacing, components |
| [tasks.md](./tasks.md) | Phased build backlog / checklist |

## Status

**Documentation phase.** This repository currently contains the design docs and build plan.
Implementation follows the backlog in [tasks.md](./tasks.md).

## Getting started (once implemented)

```bash
npm install     # installs deps and rebuilds the native SQLite module for Electron
npm run dev      # launch the app with hot reload
npm run build:mac # package a macOS .dmg
```

## Security note

The entire database is encrypted with your password. **If you lose the password, the data
cannot be recovered** — there is no backdoor and no reset. Keep it somewhere safe.
