# CLAUDE.md — Kouign Assistant

Guidance for Claude (and any developer) working in this repository.

## What Kouign Assistant is

Kouign Assistant is a **private, offline-first personal assistant** desktop app for macOS.
It keeps two things in one place, protected behind a password:

1. **Todos** — daily tasks for both personal work and company work. Each task can link
   out to a **Jira** issue or a **Slack** message.
2. **Notes** — freeform notes, a **daily** journal, and **bookmarks**.

All data lives in a single **encrypted SQLite file** ("datasource") that the user
selects when the app starts. The file can be stored in **iCloud Drive** so it syncs
across the user's Macs while remaining encrypted at rest.

> Status: **MVP / documentation phase.** This repo currently holds the design docs.
> The implementation is described in [ARCHITECTURE.md](./ARCHITECTURE.md) and the build
> backlog in [tasks.md](./tasks.md).

## Core product rules (do not violate)

- **Encryption is non-negotiable.** The whole database file is encrypted with SQLCipher
  using a key derived from the user's password. Never write user content to disk
  unencrypted, and never persist the password.
- **Password loss = data loss.** This is by design. The UI must warn users at datasource
  creation time.
- **Local-first.** No servers, no telemetry, no network calls for core features. The only
  outbound action is opening Jira/Slack links in the user's browser via the OS.
- **Renderer is untrusted.** The React renderer never touches the filesystem or the DB
  directly. All access goes through a typed IPC bridge exposed by the preload script.

## Decisions locked in

| Area | Choice | Notes |
|------|--------|-------|
| Shell | **Electron** (scaffolded with electron-vite) | macOS first |
| UI | **React 19 + TypeScript** | |
| Styling | **Tailwind CSS v4 + shadcn/ui** | restyled with Atlassian (Jira) tokens — see [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) |
| Database | **better-sqlite3-multiple-ciphers** (SQLCipher) | synchronous, full-DB encryption |
| ORM | **Drizzle ORM** | typed queries; schema bootstrapped with idempotent DDL |
| State | **Zustand** | renderer UI/data stores |
| Routing | **React Router** (hash history) | Todos / Notes / Settings |
| Integrations | **Store links only** | tasks hold a Jira/Slack URL; no OAuth in MVP |
| Search | **SQLite FTS5** | full-text across tasks + notes; external-content tables + triggers |
| Auto-lock | **On inactivity** | idle timer (default 15 min, configurable); closes DB handle |
| Password | **Min 8 + confirm + warning** | no strength meter in MVP; unrecoverable by design |
| Packaging | **electron-builder** | macOS `.dmg`; productName `Kouign Assistant`, appId `com.kouign.app` |

## Repository layout (target)

```
kouign-assistant/
├─ CLAUDE.md              # this file
├─ ARCHITECTURE.md        # architecture, IPC surface, data model, unlock flow
├─ DESIGN_SYSTEM.md       # tokens, typography, spacing, components
├─ tasks.md               # phased build backlog / checklist
├─ README.md              # quick start
└─ src/
   ├─ main/               # Electron main process (Node): DB, IPC, datasource, security
   ├─ preload/            # contextBridge exposing typed window.api
   ├─ renderer/           # React app (routes, features, components, stores)
   └─ shared/             # types + IPC channel names shared across layers
```

## Conventions

- **TypeScript everywhere**, strict mode. Shared domain types live in `src/shared` and are
  the single source of truth across main/preload/renderer.
- **IPC**: channel names are centralized (never raw strings at call sites). Every handler
  returns a discriminated `IpcResult<T>` (`{ ok: true, data }` | `{ ok: false, error }`)
  so the renderer handles failures without unhandled rejections.
- **DB access** is confined to the main process, wrapped in repository modules that map
  rows to shared domain types.
- **Security defaults**: `contextIsolation: true`, `nodeIntegration: false`, a strict CSP,
  and a `setWindowOpenHandler` that routes external links through the OS.
- **Styling**: use design tokens / Tailwind utilities, not hardcoded colors. Follow the
  Atlassian-flavored palette in DESIGN_SYSTEM.md.

## Commands (once implemented)

```bash
pnpm install       # install deps + rebuild native module for Electron (postinstall)
pnpm dev           # launch app with HMR
pnpm build         # typecheck + build
pnpm build:mac     # produce a macOS .dmg
```

> Native module note: `better-sqlite3-multiple-ciphers` must be rebuilt against Electron's
> ABI (`electron-builder install-app-deps`) or it will fail to load at runtime.

## Where to look

- **How it fits together** → [ARCHITECTURE.md](./ARCHITECTURE.md)
- **How it should look** → [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
- **What to build next** → [tasks.md](./tasks.md)
