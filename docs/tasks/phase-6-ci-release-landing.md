# Task: Phase 6 — Release CI & landing page

> **Owner:** coder sub-agent (model: sonnet) · **Phase:** 6 · **Status:** ready
> **Depends on:** Phase 5 complete (app builds a launchable `.dmg` via `npm run build:mac`).
> **Read first:** [CLAUDE.md](../../CLAUDE.md) commands + packaging note; the existing
> [`electron-builder.yml`](../../electron-builder.yml); [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md)
> §1–§4 (tokens, typography, spacing — the landing page must reuse them).

## Goal

Make Kouign Assistant a downloadable, open-source app. Two outcomes:

1. **Release CI** — pushing a `vX.X.X` git tag builds installers for **macOS (arm64 + Intel
   x64)** and **Windows (NSIS `.exe`)** on GitHub-hosted runners and publishes them as a
   GitHub **Release** anyone can download.
2. **Landing page** — a single static marketing page served from the **`gh-pages`** branch at
   `https://quangdhdev.github.io/kouign-assistant/` that introduces the app, lists features,
   and offers **Download for macOS / Windows** buttons wired to the latest release.

The app stays **unsigned** in this phase (no Apple Developer cert, no Authenticode). End-user
docs must explain the macOS Gatekeeper and Windows SmartScreen bypass so the build isn't
mistaken for malware. Signing/notarization and auto-update are explicitly out of scope.

## Context / current state

- Repo is `quangdhdev/kouign-assistant` (public). No `.github/` exists yet — greenfield CI.
- `electron-builder.yml` is macOS-`dmg`-only, `identity: null` (unsigned), `hardenedRuntime:
  true`; it has **no** `win`, `nsis`, `artifactName`, or `publish` config.
- The native module `better-sqlite3-multiple-ciphers` is rebuilt against Electron's ABI by the
  `postinstall` hook (`electron-builder install-app-deps`), so a plain `npm ci` on each runner
  rebuilds it for that runner's OS/arch — no extra CI step needed.
- `build/icon.png` (512²) and `build/icon.icns` exist. There is **no `icon.ico`**;
  electron-builder converts a ≥256px PNG to Windows `.ico` automatically, so none is committed.
- App version is driven by `package.json` (`0.1.0`); DMG/exe filenames embed it.

## Dependencies & setup

No new npm dependencies. New files only: three GitHub Actions workflows, one landing-page HTML
file, and edits to `electron-builder.yml`. GitHub Actions and Pages are enabled at the repo
level (Actions on by default for public repos; Pages requires the one-time manual step in §6.6).

## Scope (sub-tasks)

### 6.1 `electron-builder.yml` — add Windows + multi-arch mac + stable artifact names

Extend the existing file (do **not** remove `identity: null` or `hardenedRuntime: true`).
**Config contract** (target state):

```yaml
appId: com.kouign.app
productName: Kouign Assistant
directories:
  output: dist
  buildResources: build
files:
  - out/**/*
  - package.json
# Predictable, version- and arch-stamped asset names the release + landing page rely on.
artifactName: ${productName}-${version}-${arch}.${ext}
mac:
  category: public.app-category.productivity
  target:
    - target: dmg
      arch: [default]        # each runner builds its NATIVE arch (arm64 on macos-14, x64 on macos-13)
  icon: build/icon.icns
  hardenedRuntime: true
  identity: null             # unsigned — signing is a later phase
dmg:
  title: Kouign Assistant
win:
  target: nsis
  icon: build/icon.png       # electron-builder converts PNG -> .ico
nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
```

Notes:
- `arch: [default]` (not `[arm64, x64]`) is deliberate — each mac runner compiles only its own
  arch so the native module never needs cross-compilation. The arm64 DMG comes from the Apple
  Silicon runner and the Intel DMG from the Intel runner (§6.2).
- Do **not** add a `publish:` block — the workflow uploads assets itself (§6.2), keeping
  electron-builder decoupled from GitHub auth.
- Resulting asset names: `Kouign Assistant-<version>-arm64.dmg`,
  `Kouign Assistant-<version>-x64.dmg`, `Kouign Assistant-<version>-x64.exe` (+ `.blockmap`).

### 6.2 `.github/workflows/release.yml` — tag-triggered build + publish

Trigger on tags matching `v*.*.*`. `permissions: contents: write`. Three jobs:

1. **`version-check`** (ubuntu) — fail fast if the tag (minus the leading `v`) ≠ `package.json`
   `version`, since `artifactName` embeds the version. Read the version with
   `node -p "require('./package.json').version"` and compare to `${{ github.ref_name }}`.

2. **`build`** — `needs: version-check`, `strategy.fail-fast: false`, matrix of 3 targets:

   | runner | electron-builder args | produces |
   |--------|----------------------|----------|
   | `macos-14` | `--mac` | arm64 `.dmg` |
   | `macos-13` | `--mac` | Intel x64 `.dmg` |
   | `windows-latest` | `--win` | NSIS `.exe` |

   Steps per matrix entry:
   - `actions/checkout@v4`
   - `actions/setup-node@v4` with `node-version: 22` and `cache: npm`
   - `npm ci` (runs `postinstall` → native rebuild for that runner's arch/Electron)
   - `npm run build` (typecheck + electron-vite build → `out/`)
   - `npx electron-builder ${{ matrix.args }} --publish never` (produces `dist/…`)
   - `softprops/action-gh-release@v2` with:
     - `tag_name: ${{ github.ref_name }}`
     - `files: dist/*.dmg` + `dist/*.exe` + `dist/*.blockmap` (glob)
     - `draft: true`
     - `generate_release_notes: true`

   The three matrix jobs are **idempotent** — they append their artifacts to the same draft
   release for the tag.

3. **`publish`** (ubuntu) — `needs: build`. Flip the draft to a public release once all
   artifacts are uploaded: `gh release edit "${{ github.ref_name }}" --draft=false` with
   `env: GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`.

### 6.3 `.github/workflows/ci.yml` — build guardrail

Prevents broken commits/PRs from reaching a tag. Trigger on `push` and `pull_request` (branches,
**not** tags). One `ubuntu-latest` job: `checkout` → `setup-node@v4` (node 22, `cache: npm`) →
`npm ci` → `npm run typecheck` → `npm run lint` → `npm run build`. No packaging step (packaging
is release-only, and cross-platform installers aren't needed on every push).

### 6.4 `site/index.html` — landing page (single static file)

One self-contained HTML file using **Tailwind via CDN** (`https://cdn.tailwindcss.com`) with an
inline `tailwind.config` that maps the app's Atlassian tokens so the site matches the app.
**Token contract** (from DESIGN_SYSTEM.md):

| Purpose | Value |
|---------|-------|
| Primary / brand | `#0052CC` |
| Canvas bg | `#F4F5F7` |
| Surface / card | `#FFFFFF` |
| Primary text | `#172B4D` |
| Muted text | `#6B778C` |
| Accent (selection) | `#DEEBFF` |
| Border | `#DFE1E6` |
| Success | `#36B37E` · Warning `#FFAB00` · Danger `#DE350B` |
| Radius | controls `3px`, cards `8px` |
| Font | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` |

**Sections (in order):**

1. **Hero** — product name "Kouign Assistant", tagline *"Your private, encrypted personal
   assistant for macOS — todos & notes in one place."*, a version badge, and two primary
   buttons: **Download for macOS** and **Download for Windows**.
2. **Features grid** — one card each: Todos (Jira/Slack links), Notes (journal + bookmarks),
   Encrypted datasource (SQLCipher, password never stored), Local-first (no servers/telemetry),
   iCloud-friendly sync, Full-text search (FTS5, ⌘K), Dark mode, Keyboard shortcuts. Copy must
   match README's feature wording.
3. **Security callout** — the non-negotiable warning: *"Password loss = data loss — there is no
   recovery by design."* Plus a short "unsigned build" note pointing users to the Gatekeeper /
   SmartScreen steps (§6.5 / release notes).
4. **Screenshots placeholder** — styled slots referencing `docs/screenshots/`; real images are a
   later GUI-session task, so ship a labeled placeholder now.
5. **Footer** — link to the GitHub repo, "open source", and the tech-stack line.

**Dynamic downloads (inline `<script>`):** on load, `fetch(
'https://api.github.com/repos/quangdhdev/kouign-assistant/releases/latest')`; on success, set the
version badge and point each button at the matching asset by filename suffix
(`-arm64.dmg` → "Apple Silicon", `-x64.dmg` → "Intel", `-x64.exe` → Windows). Every button has a
**static fallback `href`** of `https://github.com/quangdhdev/kouign-assistant/releases/latest`, so
the page works before any release exists or if the API call fails/rate-limits. Handle the
no-release-yet case gracefully (show "Coming soon" / keep the fallback link).

### 6.5 End-user install docs (unsigned build)

Because the artifacts are unsigned, add short bypass instructions (surface them in the landing
page security callout **and** in the auto-generated release notes body, and/or README):
- **macOS:** right-click the app → **Open** → confirm; or System Settings → Privacy & Security →
  "Open Anyway". (Gatekeeper blocks unsigned/un-notarized apps on first launch.)
- **Windows:** SmartScreen → **More info** → **Run anyway**.

### 6.6 `.github/workflows/pages.yml` — deploy landing page to `gh-pages`

Trigger on `push` to `main` touching `site/**`, plus `workflow_dispatch`. One job:
`checkout` → `peaceiris/actions-gh-pages@v4` with `github_token: ${{ secrets.GITHUB_TOKEN }}`
and `publish_dir: ./site` (publishes to the `gh-pages` branch). `permissions: contents: write`.

**One-time manual step (document, don't automate):** repo **Settings → Pages → Source =**
`gh-pages` branch, `/ (root)`. Note this in the phase report and README so the site goes live.

### 6.7 Doc/index updates

- `tasks.md` — add a `## Phase 6 — Release CI & landing page` checklist block (mirrors §6.1–6.6),
  placed before the Backlog section.
- `docs/tasks/README.md` — add Phase 6 to the phases table and the build-order/dependency chart
  (`5 → 6`, since 6 packages/publishes what 5 built).
- `README.md` — add a **Download** section (link to Releases + the landing page), a short
  **Releasing** note (tag `vX.X.X` → CI builds all three artifacts and publishes the release), and
  the Gatekeeper / SmartScreen bypass steps for end users.

## Out of scope (do NOT do)

- **Code signing / notarization** (macOS) or **Authenticode** (Windows) — the build stays unsigned.
- **Auto-update** (electron-updater) and update feeds.
- **Linux** targets.
- A **multi-page site or framework** (Astro/Vite/React) — a single static `index.html` by decision.
- **Real screenshots** and a **designed logo** — still pending a GUI session; placeholders only.
- Publishing to Homebrew, the Mac App Store, or any package manager.

## Acceptance criteria

- [ ] `electron-builder.yml` has a `win` NSIS target, per-runner `arch: [default]` mac target, an
      `nsis` block, and `artifactName: ${productName}-${version}-${arch}.${ext}`; `identity: null`
      and `hardenedRuntime` are preserved and no `publish:` block was added.
- [ ] `.github/workflows/release.yml` triggers on `v*.*.*` tags, has `version-check` → `build`
      (3-target matrix, `fail-fast: false`) → `publish`, uses Node 22 + `npm ci`, and publishes a
      GitHub Release with all three installers attached (`-arm64.dmg`, `-x64.dmg`, `-x64.exe`).
- [ ] The `version-check` job fails when the tag and `package.json` version disagree.
- [ ] `.github/workflows/ci.yml` runs typecheck + lint + build on push/PR (not on tags).
- [ ] `site/index.html` is a single static file using the design tokens above, with hero +
      download buttons, features grid, security callout, screenshots placeholder, and footer.
- [ ] Landing-page download buttons resolve to the latest release assets via the GitHub API and
      fall back to `…/releases/latest` when there is no release / the API fails.
- [ ] `.github/workflows/pages.yml` deploys `site/` to `gh-pages` on `site/**` changes; the manual
      "Settings → Pages → gh-pages" step is documented.
- [ ] `tasks.md`, `docs/tasks/README.md`, and `README.md` updated (Phase 6 entry + Download/
      Releasing/Gatekeeper notes).
- [ ] Existing app build is unaffected: `npm run lint` and `npm run build` still exit 0.

## Verification

```bash
# 1. Config still parses and the app still builds/packages locally (no tag needed)
npm run lint && npm run build
npx electron-builder --mac --publish never    # confirm dist/Kouign Assistant-<version>-arm64.dmg

# 2. Landing page renders locally
cd site && python3 -m http.server 8080        # open http://localhost:8080 — check tokens/layout
#   with no release yet, buttons must fall back to /releases/latest

# 3. Workflow YAML sanity (if actionlint is available)
actionlint .github/workflows/*.yml            # or rely on GitHub's workflow editor validation

# 4. End-to-end (real, user-driven — pushes to the PUBLIC repo; run when ready to publish)
#    ensure package.json version matches the tag first
git tag v0.1.0 && git push origin v0.1.0      # watch release.yml build 3 artifacts + publish
#    push a change under site/ -> pages.yml deploys; then enable Settings > Pages > gh-pages
```

## Report back (to orchestrator)

Files created/edited, criterion mapping, the local `electron-builder --mac` output (dmg path +
size) confirming the config still packages, the landing page local-render check (incl. the
no-release fallback), and any blockers. Call out the two manual, user-only steps that CI cannot
perform: (a) pushing the first `vX.X.X` tag to trigger a real release, and (b) enabling
**Settings → Pages → `gh-pages`** to make the site live.
