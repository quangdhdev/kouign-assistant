---
name: work-todo
description: >
  Work through the Kouign Assistant build backlog one task at a time. Finds every
  phase/task in tasks.md and docs/tasks/ that is NOT marked [x], then for each one
  (in dependency order) creates a branch off main, plans it in plan mode, implements
  it (via the coder sub-agent), pauses for the user to manually test and give
  feedback, and only on user approval marks the doc done, commits, merges to main,
  and moves to the next task. Use when the user says "work the todos", "grind the
  backlog", or invokes /work-todo.
trigger: /work-todo
---

# /work-todo — drive the build backlog task by task

You are the **driver** of the Kouign Assistant backlog. You run an interactive loop in the
main conversation because it needs plan-mode approval and the user's manual-test feedback —
things a headless sub-agent cannot do. You delegate the heavy code writing to the **`coder`**
sub-agent, but you own the git flow, planning, doc updates, and the user hand-offs.

Read `CLAUDE.md`, `ARCHITECTURE.md`, and `DESIGN_SYSTEM.md` conventions before starting — the
coder must follow them and so must any plan you approve.

## 0. Build the work-list (once, up front)

1. Read `tasks.md` and every file under `docs/tasks/`.
2. Collect all checklist items that are **not** `[x]`:
   - `[ ]` (todo) and `[~]` (in progress) both count as unfinished; resume `[~]` first.
3. Order them by the dependency chain in `docs/tasks/README.md` (phases ascending; within a
   phase, top-to-bottom). Never start a task whose prerequisite phase is unfinished.
4. Show the user the ordered list and the first task you'll pick up, then begin the loop.

If everything is already `[x]`, say so and stop.

## The per-task loop

Repeat for each unfinished task, **one at a time, sequentially**. Do not batch.

### 1. Branch off main
- Ensure the working tree is clean (if not, stop and ask the user how to proceed).
- `git checkout main` and make sure it's current.
- Create and switch to a new branch. Name it `<type>/<unit>-<id>`:
  - `<type>`: `feat` for a feature/phase task, `bug` for a bugfix.
  - `<unit>-<id>`: `phase-<n>` for a whole phase, or `task-<n.n>` for a single item
    (e.g. `feat/phase-3`, `feat/task-3.2`, `bug/phase-1.2`).
  - Ask the user only if feat-vs-bug is genuinely ambiguous; otherwise default to `feat`.

### 2. Plan (plan mode ON)
- Enter **plan mode**.
- Read the full task detail from its `docs/tasks/phase-*.md` spec (and the doc sections it
  references). The spec is the source of truth for scope + acceptance criteria.
- Produce a concrete implementation plan: files to touch (main / preload / renderer / shared),
  data-model or IPC changes, new shared types, and how each acceptance criterion is met.
- Present the plan for approval (ExitPlanMode). Do **not** write code until the user approves.

### 3. Implement the approved plan
- Dispatch the **`coder`** sub-agent (Agent tool, `subagent_type: coder`) with: the task spec,
  the approved plan, and the acceptance criteria. Let it write the code and run any
  typecheck/build it can.
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
- Mark it **done** in the docs: flip the item to `[x]` in `tasks.md`, and update the matching
  `docs/tasks/phase-*.md` (and `docs/tasks/README.md` status if it tracks completion).
- Commit on the feature branch using conventional-commit style matching the repo history,
  e.g. `feat(phase-3): todos feature (IPC + store + list/dialog/chips)`. Include the doc
  updates in the commit. Do **not** push unless the user asks.

### 6. Merge back to main
- `git checkout main`.
- Merge the feature branch into main (`git merge --no-ff <branch>`), keeping a clean message.
- If a conflict occurs, stop and ask the user — do not force-resolve.
- Optionally delete the merged branch if the user wants a tidy tree.

### 7. Reset and continue
- Clear the current plan / plan-mode state so the next task starts fresh.
- Recompute the next unfinished task from the work-list and repeat from step 1.

## Stopping & guardrails

- Stop when there are no unfinished tasks left, or the user says stop.
- **Never** mark a task `[x]`, commit, or merge without the user's explicit approval for that
  task (step 4 → step 5 gate).
- Honor the locked-in rules in `CLAUDE.md` (encryption, local-first, untrusted renderer). If a
  task would violate them, raise it instead of building it.
- One task in flight at a time; the working tree should be clean between tasks.
- Keep the user oriented: after each merge, say what was completed and name the next task.
