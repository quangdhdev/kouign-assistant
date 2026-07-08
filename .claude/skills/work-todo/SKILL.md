---
name: work-todo
description: >
  Work through the Kouign Assistant backlog one task at a time. Finds every unfinished
  item under the ## Tasks section of tasks.md (with its docs/tasks/task-*.md spec, if
  any), then for each one creates a branch off main, plans it in plan mode, implements
  it (via the coder sub-agent), pauses for the user to manually test and give feedback,
  and only on user approval marks the task done, commits, merges to main, and moves to
  the next. Use when the user says "work the todos", "grind the backlog", or invokes
  /work-todo.
trigger: /work-todo
---

# /work-todo — drive the backlog task by task

You are the **driver** of the Kouign Assistant backlog. You run an interactive loop in the
main conversation because it needs plan-mode approval and the user's manual-test feedback —
things a headless sub-agent cannot do. You delegate the heavy code writing to the **`coder`**
sub-agent, but you own the git flow, planning, doc updates, and the user hand-offs.

Read the same sources of truth `/new-task` grounds its specs in — `CLAUDE.md` (locked-in
product rules), `ARCHITECTURE.md` (data model, IPC surface, layer boundaries), and
`DESIGN_SYSTEM.md` (tokens, components) — before starting. The coder must follow them and so
must any plan you approve.

> **Task model:** the MVP phases (0–6) are **shipped** and live collapsed under "Shipped — MVP"
> in `tasks.md`; ignore them. Ongoing work is a flat list of **single tasks** under the
> **## Tasks** section of `tasks.md`. A substantial task has a matching spec at
> `docs/tasks/task-<slug>.md` (usually authored via `/new-task`); a small task is just a
> one-line entry with no spec. The archived `docs/tasks/phase-*.md` files are history — don't
> pick them up.

## 0. Build the work-list (once, up front)

1. Read the **## Tasks** section of `tasks.md`. Collect items that are **not** `[x]`:
   - `[ ]` (todo) and `[~]` (in progress) both count as unfinished; resume `[~]` first.
2. For each unfinished item, find its spec: the `[spec](./docs/tasks/task-<slug>.md)` link on
   the line, or a `docs/tasks/task-*.md` whose title matches. If there's no spec, it's a small
   task defined by its one-liner (you'll plan it from that + the codebase).
3. Order them **top-to-bottom** as they appear under **## Tasks** (newest-first is how
   `/new-task` files them, so the list is already in the user's intended priority). If one task
   clearly depends on another still-unfinished one, do the prerequisite first — otherwise keep
   file order. If the order is genuinely ambiguous, show the list and ask which to start.
4. Show the user the ordered list and the first task you'll pick up, then begin the loop.

If there are no unfinished items under **## Tasks**, say so and stop. (Don't invent work from
the **Backlog / ideas** section — those are promoted via `/new-task` first.)

## The per-task loop

Repeat for each unfinished task, **one at a time, sequentially**. Do not batch.

### 1. Branch off main
- Ensure the working tree is clean (if not, stop and ask the user how to proceed).
- `git checkout main` and make sure it's current.
- Create and switch to a new branch named `<type>/<task-slug>`:
  - `<type>`: `feat` for a feature/enhancement, `bug` for a bugfix.
  - `<task-slug>`: the task's kebab-case slug — the spec's filename without the `task-`
    prefix/`.md` (e.g. spec `task-notes-tabs.md` → `feat/notes-tabs`), or a short slug derived
    from the one-liner for spec-less tasks (e.g. `bug/sidebar-focus`).
  - Ask the user only if feat-vs-bug is genuinely ambiguous; otherwise default to `feat`.

### 2. Plan (plan mode ON)
- Enter **plan mode**.
- Read the full task detail from its `docs/tasks/task-*.md` spec (and the doc sections it
  references). The spec is the source of truth for scope + acceptance criteria. For a spec-less
  small task, treat the `tasks.md` one-liner as the goal and scope it from the codebase.
- Produce a concrete implementation plan: files to touch (main / preload / renderer / shared),
  data-model or IPC changes, new shared types, and how each acceptance criterion is met.
- Present the plan for approval (ExitPlanMode). Do **not** write code until the user approves.

### 3. Implement the approved plan
- Dispatch the **`coder`** sub-agent (Agent tool, `subagent_type: coder`, model: sonnet) with:
  the task spec (or one-liner), the approved plan, and the acceptance criteria. Let it write the
  code and run `npm run lint` and `npm run build` (both must exit 0), matching the verification
  block every `/new-task` spec ends with.
- Relay the coder's report (what changed, how criteria are met, verification) back concisely.
- If the coder reports a blocker or ambiguity, surface it to the user before continuing.

### 4. Manual test + feedback (loop until the user is satisfied)
- Ask the user to **manually test** the change, and tell them exactly what to try (the
  acceptance criteria, key flows). Running the app is theirs to do — offer the `! npm run dev`
  hint if useful.
- Wait for their feedback.
- If they report issues or want changes: dispatch the `coder` again with the feedback, then
  ask them to re-test. Repeat this sub-loop until they approve.

### 5. Finish the task (only on user "ok")
- Mark it **done** in the docs: flip the item to `[x]` under **## Tasks** in `tasks.md`. If the
  task has a spec, update its `docs/tasks/task-*.md` header **Status** to `done` (or append a
  brief done note). Optionally move the checked line to a "Done" area if the user keeps one.
- Commit on the feature branch using conventional-commit style matching the repo history,
  e.g. `feat(notes-tabs): tabbed notes with first-line-as-title`. Include the doc updates in
  the commit. Do **not** push unless the user asks.

### 6. Merge back to main
- `git checkout main`.
- Merge the feature branch into main (`git merge --no-ff <branch>`), keeping a clean message.
- If a conflict occurs, stop and ask the user — do not force-resolve.
- Optionally delete the merged branch if the user wants a tidy tree.

### 7. Reset and continue
- Clear the current plan / plan-mode state so the next task starts fresh.
- Recompute the next unfinished task from the work-list and repeat from step 1.

## Stopping & guardrails

- Stop when there are no unfinished tasks under **## Tasks**, or the user says stop.
- **Never** mark a task `[x]`, commit, or merge without the user's explicit approval for that
  task (step 4 → step 5 gate).
- Honor the locked-in rules in `CLAUDE.md` (encryption, local-first, untrusted renderer). If a
  task would violate them, raise it instead of building it.
- One task in flight at a time; the working tree should be clean between tasks.
- Keep the user oriented: after each merge, say what was completed and name the next task.
