---
name: release
description: >
  Cut a new version of Kouign Assistant: bump the version in package.json (either an
  explicit version passed as an argument, or an automatic patch bump), commit the
  change, and create a matching annotated git tag. Use when the user says "cut a
  release", "bump the version", or invokes /release [version].
trigger: /release
---

# /release — bump version, commit, tag

You are performing a simple, mechanical release-prep flow. Do **not** improvise beyond
these steps (no changelog generation, no pushing, no building the app) unless the user
asks for it separately.

## 0. Parse the invocation

- `/release` (no argument) → **auto patch bump**: take the current `version` in
  `package.json` and increment the patch number (`1.1.0` → `1.1.1`).
- `/release v1.1.1` or `/release 1.1.1` → **explicit version**: strip a leading `v` if
  present, use `1.1.1` as the target version.
- Validate the target version is well-formed semver (`X.Y.Z`, digits only per segment).
  If not, stop and report the problem instead of guessing.

## 1. Preconditions (stop and ask if any fail)

1. `git status --short` — tracked files must be clean (no staged or unstaged
   modifications to files already tracked by git). Untracked files/directories that are
   unrelated to the release (e.g. new scratch files, the skill's own directory) do
   **not** block the flow — just leave them alone and don't stage them. If there are
   uncommitted **modifications to tracked files** unrelated to this release, stop and
   ask the user how to proceed (do not stash or discard anything yourself).
2. Confirm the target version is different from the current `package.json` version and
   is not already an existing tag (`git tag -l vX.Y.Z`). If it already exists, stop and
   report — do not overwrite or force-move a tag.
3. You do not need to be on `main`, but if the current branch isn't `main`, mention it in
   your final report so the user knows where the release commit landed.

## 2. Update package.json

- Edit only the `"version"` field in `package.json` to the target version (no leading
  `v` in the file itself — matches existing convention, e.g. `"version": "1.0.4"`).
- Leave every other field untouched.

## 3. Commit

- Stage only `package.json`.
- Commit message: `Bump version to X.Y.Z` (matches this repo's existing history, e.g.
  "bump version to 1.0.4"). End the message with:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```
- Create a **new** commit — never amend.

## 4. Tag

- Create an **annotated** tag on the commit you just made:
  `git tag -a vX.Y.Z -m "vX.Y.Z"` (matches the most recent tag's style, e.g. `v1.0.4`).

## 5. Report back

- Confirm: old version → new version, the commit hash + message, and the tag created.
- Remind the user that nothing was pushed — `git push && git push origin vX.Y.Z` (or
  their usual flow) is theirs to run explicitly.
- If they later want `pnpm build:mac` / a GitHub release from this tag, that's a
  separate, explicit ask — don't do it proactively.

## Guardrails

- Never push, never force-push, never delete/move an existing tag.
- Never touch files other than `package.json` for this flow.
- Never skip the clean-working-tree check.
- If the user's explicit version looks like a downgrade (e.g. current is `1.1.0` and
  they ask for `1.0.9`), flag it and ask for confirmation before proceeding.
