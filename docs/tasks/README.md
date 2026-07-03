# Task specs — Bassistant

Detailed, coder-ready specifications for each build phase. Each file is **self-contained**: a
coder (the Sonnet `coder` sub-agent) can implement it reading only that spec plus the doc sections
it references. They elaborate the checklist in [`../../tasks.md`](../../tasks.md) with concrete
contracts (TypeScript types, SQL DDL, IPC signatures) and acceptance criteria.

> **Process:** the orchestrator hands one phase spec to the coder at a time, then verifies the
> report before dispatching the next. Specs must not contradict
> [ARCHITECTURE.md](../../ARCHITECTURE.md) or [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md) — those
> remain the source of truth for architecture and design.

## Phases

| Spec | Phase | Summary |
|------|-------|---------|
| [phase-0-scaffold.md](./phase-0-scaffold.md) | 0 | Electron + electron-vite + React 19 + TS, Tailwind v4, shadcn/ui, aliases, lint, security-hardened window |
| [phase-1-datasource-core.md](./phase-1-datasource-core.md) | 1 | Encrypted DB core: connection/keying, Drizzle schema, migrations, repos, config, iCloud resolver (main-only) |
| [phase-2-shell-unlock.md](./phase-2-shell-unlock.md) | 2 | Shared contract, IPC handlers, preload bridge, LockGate + password policy, AppShell, session store, Settings + auto-lock, tokens |
| [phase-3-todos.md](./phase-3-todos.md) | 3 | Tasks IPC + store, TodosPage, TaskDialog, Jira/Slack chips, status advance |
| [phase-4-notes.md](./phase-4-notes.md) | 4 | Notes IPC + store, master–detail page, editor w/ autosave, daily notes, bookmarks |
| [phase-4.5-search.md](./phase-4.5-search.md) | 4.5 | FTS5 tables + triggers, searchRepo, search IPC, global search UI |
| [phase-5-polish-package.md](./phase-5-polish-package.md) | 5 | Empty/loading/toast states, shortcuts, dark mode, icon + `.dmg`, README |

## Build order & dependency chain

```
0 (scaffold)
└─ 1 (datasource core, main-only)
   └─ 2 (shell + unlock + IPC contract)     ← establishes shared/types|ipc|api
      ├─ 3 (todos)        ┐ parallelizable
      └─ 4 (notes)        ┘ (independent feature slices over the same contract)
         └─ 4.5 (search)   ← needs tasks + notes tables, repos, and UI to jump into
            └─ 5 (polish & package)
```

- **0 → 1 → 2** are strictly sequential (each builds on the prior layer).
- **3 and 4** can be built in parallel after 2 — they touch disjoint feature folders over the
  shared contract fixed in Phase 2.
- **4.5** depends on both 3 and 4 (search spans tasks + notes and jumps into their views).
- **5** is last (polish, dark-mode toggle, packaging).

## Locked decisions honored across specs

- **Search:** SQLite FTS5 full-text across tasks + notes (Phase 4.5).
- **Auto-lock:** on inactivity, default 15 min, configurable, `0` = never (Phase 2).
- **Password:** min 8 + confirm + non-dismissible "no recovery" warning, re-validated in main (Phase 2).
- **Name:** Bassistant, appId `com.bassistant.app` (Phase 0 identity, Phase 5 packaging).

## Out of MVP scope (post-MVP backlog — see [`../../tasks.md`](../../tasks.md))

Tags, live Jira/Slack integration (OAuth), markdown live preview, keychain "remember on this Mac",
change-password / re-key, export/import, iCloud placeholder auto-download, due-date notifications.
These appear in specs only as "future hook" notes where a seam should be left.
