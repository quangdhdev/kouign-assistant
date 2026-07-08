---
name: new-task
description: >
  Turn a short description into a well-formed, coder-ready task for Kouign Assistant.
  Reads the current project state (CLAUDE.md, ARCHITECTURE.md, DESIGN_SYSTEM.md,
  tasks.md, docs/tasks/), drafts a task spec grounded in that state, shows it to the
  user for review (plan-mode style), and iterates on feedback. Only on explicit
  approval does it add the task to tasks.md and, when warranted, write a spec doc under
  docs/tasks/. Use when the user says "new task", "draft a task", or invokes
  /new-task <description>.
trigger: /new-task
---

# /new-task — draft a task from a description, confirm, then file it

You turn a one-line description into a **coder-ready task** for Kouign Assistant. You work
like plan mode: **draft → show → get approval/feedback → iterate → only then write files.**
Never modify `tasks.md` or create a spec doc until the user explicitly approves.

The argument after `/new-task` is the raw description (may be terse, e.g.
`/new-task tags for tasks and notes`). If no description is given, ask the user for one and stop.

## 1. Understand the project state (read before drafting)

Ground the task in what already exists — do not invent architecture. Read:

- `CLAUDE.md` — locked-in product rules and decisions (encryption, local-first, untrusted
  renderer, IPC contract). A task must never violate these.
- `ARCHITECTURE.md` — data model, IPC surface, layer boundaries (main / preload / renderer /
  shared). Reference the exact sections the task touches.
- `DESIGN_SYSTEM.md` — tokens, components, view patterns, for any UI-facing task.
- `tasks.md` — the current backlog. Check whether this already exists under **Tasks** or
  **Backlog / ideas** (if it's a backlog item, you're promoting it, not inventing it).
- `docs/tasks/` — existing specs. Reuse their shape, and reuse the repos / stores / IPC
  namespaces they established (`taskRepo`, `noteRepo`, `searchRepo`, `window.api.*`, etc.).
  The shipped MVP already has the DB, IPC wrapper, session/auto-lock, todos, notes, search.

From this, form a concrete understanding: which layers change, which existing pieces are
reused, what the data-model/IPC delta is, and what "done" looks like. If the description is
genuinely ambiguous on something that changes the design (not a cosmetic detail), ask **one**
focused clarifying question via AskUserQuestion before drafting — otherwise pick sensible
defaults consistent with the repo and note them in the draft.

## 2. Draft the task

Judge the size first:

- **Small task** (a bugfix, a single UI tweak, a one-file change): a one-liner for `tasks.md`
  plus a short rationale is enough — no separate spec doc.
- **Substantial task** (new feature slice, new data-model/IPC surface, multi-file): draft a
  full **single-task spec** using the template below. This is the coder-ready artifact.

Draft the spec **in the conversation** (do not write a file yet). Use this skeleton — it is the
single-task analogue of the phase specs in `docs/tasks/`:

```markdown
# Task: <Title>

> **Owner:** coder sub-agent (model: sonnet) · **Status:** ready
> **Depends on:** <existing pieces / other pending tasks, or "nothing — builds on shipped MVP">
> **Read first:** [ARCHITECTURE.md](../../ARCHITECTURE.md) §<n> (<topic>);
> [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md) §<n> (<topic>).   <!-- omit design ref if non-UI -->

## Goal
One paragraph: what the user can do when this ships, and over which existing layer it's built.

## Dependencies & setup
- What already exists that this reuses (name the repo / handler / store / api namespace).
- Any migration or new shared type this introduces.

## Scope (sub-tasks)
### 1. Contract — DTOs / api (`src/shared/types.ts`, `src/shared/api.ts`)
​```ts
// exact interfaces + api namespace methods, with defaults noted
​```
### 2. Main — `src/main/ipc/<feature>.ts` (+ repo / migration if needed)
Register via the `handle()` wrapper; delegate to the repo; reject when locked. Reuse Phase-1
DB patterns (idempotent DDL, `user_version` guard) — don't reimplement.
### 3. Renderer — store + feature UI
State/actions calling `window.api.<feature>.*` through `unwrap`; UI per DESIGN_SYSTEM.

## Out of scope (do NOT do)
- Name the tempting-but-deferred things so the coder doesn't gold-plate.

## Acceptance criteria
- [ ] <observable behavior — round-trips against the encrypted DB>
- [ ] <observable behavior>
- [ ] `npm run lint` / `npm run build` exit 0.

## Verification
​```bash
npm run lint && npm run build
npm run dev   # <exact manual walkthrough>
​```
```

Requirements for a good draft (same bar as `docs/tasks/`):
- **Self-contained** — a coder implements it from the spec plus the referenced doc sections only.
- **Contracts inline** — real TS/SQL/IPC signatures, not prose descriptions.
- **Acceptance criteria are observable** — verifiable by using the app, not by reading the diff.
- **Explicit out-of-scope** — must not violate `CLAUDE.md` rules; call out deferred pieces.

## 3. Show it and get approval (plan-mode style)

Present the draft in the conversation, then **stop and ask** the user to either approve or give
feedback. Make the choice explicit — e.g. via AskUserQuestion with options like:

- **Approve & file it** — write it to `tasks.md` (+ spec doc if substantial).
- **Revise** — the user gives feedback; you redraft and show again.
- **Cancel** — drop it, write nothing.

Loop on **Revise** until the user approves. Do **not** write any file before approval.

## 4. File it (only on explicit approval)

1. **`tasks.md`** — add a `- [ ] <one-line summary>` under the **## Tasks** section, newest
   first. If the section still says `_(none yet)_`, replace that line. If the task came from
   **Backlog / ideas**, remove it there (it's now promoted). If a spec doc exists, link it:
   `- [ ] <summary> — [spec](./docs/tasks/task-<slug>.md)`.
2. **Spec doc (substantial tasks only)** — write the drafted spec to
   `docs/tasks/task-<slug>.md` (kebab-case slug from the title). Do not renumber or touch the
   existing `phase-*.md` files.
3. Report what you wrote (files + the one-line backlog entry) and name how to start it — e.g.
   "`/work-todo` will pick it up," or offer to branch and implement now if the user wants.

Do not commit, branch, or write code as part of `/new-task` — filing the task is where this
skill ends, unless the user explicitly asks you to start building.

## Guardrails

- Never write to `tasks.md` or `docs/tasks/` before the user approves the draft.
- Never let a task contradict the locked rules in `CLAUDE.md` — if the request would, say so
  and propose a compliant alternative instead of drafting the violating version.
- Keep drafts grounded in real repo pieces (existing repos, stores, IPC namespaces); don't
  invent files or contracts that clash with `ARCHITECTURE.md`.
- One task per invocation. If the description is really several tasks, say so and offer to
  split it into separate `/new-task` drafts.
