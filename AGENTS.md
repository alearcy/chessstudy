# AGENTS.md

This project is an app for studying chess. We can create lessons and in each one create multiple boards with move, variants and comments. 

## Work directory
All commands must be run from `chessstudy/`.

## Commands
- `npm run dev` — Vite dev server
- `npm run build` — runs `tsc -b && vite build` (typecheck then build)
- `npm run lint` — `eslint .` (**no eslint config exists yet**; will fail)
- No test framework configured (no vitest/jest).

## Stack (actual, not plan.md)
React **19** (not 18), React Router **v7** (not v6), Tailwind CSS **v4** via `@tailwindcss/vite` plugin (not v3+PostCSS), chess.js v1, react-chessboard v4, Dexie.js v4, Shadcn/ui New York style.

`docs/plan.md` is the design document but its dependency versions are outdated. Trust `package.json`.

## Architecture
- **Scaffold stage** — src/ is mostly empty. Design: `docs/plan.md`.
- `src/main.tsx` → `<App />` into `index.html`.
- `@/` alias → `src/` (tsconfig paths + vite alias).
- Shadcn/ui: `npx shadcn@latest add <name>` — components to `@/components/ui`. The `cn()` helper is at `@/lib/utils`.
- ESM (`"type": "module"`). Strict TS with `noUnusedLocals`, `noUnusedParameters`.

## Gotchas
- `tsc -b` is the typecheck step (part of build, not a separate script).
- Auto-imports/linting of unused symbols will fail the build — keep imports clean.
- Database: Dexie (IndexedDB wrapper). No backend — all data lives in the browser.
- App locale is Italian (`lang="it"` in index.html).

## Instructions
- Read only the adr directory when you have to make decisions about architecture or design. Open only the doc that has the title that matches the current topic.
