# Task: Phase 0 — Project scaffold

> **Owner:** coder sub-agent (model: sonnet) · **Phase:** 0 · **Status:** ready
> **Read first:** [CLAUDE.md](../../CLAUDE.md), [ARCHITECTURE.md](../../ARCHITECTURE.md) §2–§3,
> [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md) §1–§2. This spec is the source of scope.

## Goal

Stand up the Electron + electron-vite + React 19 + TypeScript project skeleton with
Tailwind v4, shadcn/ui, ESLint/Prettier, and the path aliases the rest of the codebase
assumes. The app must launch to a placeholder screen and typecheck/build cleanly.

**This is scaffolding only.** No database, no IPC domains, no features. Those are Phases 1+.

## Scope (what to build)

1. **Electron app via electron-vite**, TypeScript, three layers matching ARCHITECTURE §3:
   `src/main/`, `src/preload/`, `src/renderer/`, plus `src/shared/` for cross-layer types.
   - Recommended base: electron-vite `react-ts` template (`npm create @quick-start/electron@latest`
     into this dir, template `react-ts`), then adjust. If you scaffold manually instead, the
     end structure must still match ARCHITECTURE §3.
2. **`electron.vite.config.ts`** with main / preload / renderer sections and path aliases:
   - `@` → `src/renderer/src`
   - `@shared` → `src/shared`
   Aliases must resolve in **both** Vite and TypeScript.
3. **tsconfig split**: `tsconfig.json` (references), `tsconfig.node.json` (main/preload),
   `tsconfig.web.json` (renderer). `strict: true` everywhere. Alias `paths` mirror the Vite aliases.
4. **Tailwind CSS v4** via `@tailwindcss/vite` plugin, wired into the renderer. A single
   `src/renderer/src/styles/globals.css` with `@import "tailwindcss";`. Include shadcn's default
   token block as a **placeholder** — the full Atlassian token set is a Phase 2 task, do **not**
   hand-author all tokens now.
5. **shadcn/ui** initialized for Tailwind v4 + React 19:
   - `components.json` with **new-york** style, base color neutral, CSS variables on.
   - Component dir `src/renderer/src/components/ui/`.
   - Add ONE primitive as a smoke test: **Button**. Import path alias `@/components/ui/button`.
6. **ESLint + Prettier** configured for TS + React; `npm run lint` passes on the scaffold.
7. **`.gitignore`** covering: `node_modules/`, `out/`, `dist/`, `*.db`, `*.kouigndb`,
   `.DS_Store`, `*.local`.
8. **App identity**: `package.json` `name` `kouign-assistant`; window title **Kouign Assistant**. (Full
   electron-builder `.dmg` config with `appId com.kouign.app` is Phase 5 — a stub is fine,
   don't build a dmg now.)
9. **Placeholder renderer**: `App.tsx` renders a centered card with the app name and a shadcn
   `Button`, using at least one Tailwind token class (e.g. `bg-background text-foreground`) to
   prove Tailwind + tokens work. No routing yet (React Router is Phase 2).

## Security defaults (set now, even on the placeholder window)

Per ARCHITECTURE §8 — bake these into `BrowserWindow` creation from the start:
- `webPreferences.contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- `preload` points at the built preload script (a minimal/no-op preload is fine this phase).
- macOS window: `titleBarStyle: 'hiddenInset'` (matches DESIGN_SYSTEM §6).
- Add a **strict CSP** `<meta>` in `index.html`: `default-src 'self'`; allow `'unsafe-inline'`
  for styles only (Tailwind/dev). No remote script origins.
- `setWindowOpenHandler` returning `{ action: 'deny' }` as a placeholder (OS-routing comes with
  the shell IPC in a later phase).

## Out of scope (do NOT do)

- No `better-sqlite3-multiple-ciphers`, Drizzle, or any DB code (Phase 1).
- No IPC channels, preload API surface, or Zustand stores beyond an empty placeholder (Phase 2).
- No Todos/Notes/Search/Settings features.
- No full Atlassian design tokens (Phase 2), no dark-mode wiring (Phase 5), no `.dmg` packaging.
- Do not add more shadcn primitives than Button.

## Acceptance criteria

- [ ] `npm install` completes clean (no unmet peer-dep errors that break the build).
- [ ] `npm run dev` launches an Electron window showing the placeholder screen (app name + Button),
      no console errors in main or renderer.
- [ ] `npm run build` (typecheck + build) exits 0.
- [ ] `npm run lint` exits 0.
- [ ] Path aliases work: an import using `@/...` in the renderer and `@shared/...` (add a tiny
      `src/shared/types.ts` with a placeholder `export type Placeholder = never;` to prove it)
      both resolve at typecheck and build.
- [ ] Tailwind is active: a token utility class (`bg-background` / `text-foreground`) visibly applies.
- [ ] shadcn Button renders and is styled.
- [ ] `src/` matches ARCHITECTURE §3 layout (`main` / `preload` / `renderer` / `shared`).
- [ ] `.gitignore` present with the entries above; no `node_modules`/`out`/`dist` committed.
- [ ] `webPreferences` shows `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.

## Verification steps to run and report

```bash
npm install
npm run lint
npm run build
npm run dev   # confirm the window renders; then stop it
```

Report the exact output/exit status of `lint` and `build`, and confirm the dev window rendered.

## Notes / decisions already made (don't re-litigate)

- Product name is **Kouign Assistant** (repo folder `kouign-assistant`). appId `com.kouign.app`.
- electron-vite is the chosen build tool (CLAUDE.md). Use its config conventions.
- If the electron-vite template ships an example preload IPC (`ping` etc.), keeping it as the
  no-op placeholder is fine; just don't expand it.

## Report back (to orchestrator)

Files created/edited, how each acceptance criterion is met, verification output, and any
blockers (e.g. shadcn/Tailwind-v4 init quirks) — so the next phase can be spec'd.
