# AGENTS.md

This project is an app for studying chess. Users can create lessons, each containing multiple boards with moves, variations, and comments.

## Work directory
All commands must be run from `chessstudy/`.

## Commands
- `npm run dev` — Vite dev server
- `npm run build` — runs `tsc -b && vite build` (typecheck then build)
- `npm test` — runs the Vitest suite
- `npm run lint` — `eslint .`

## Stack (actual, not plan.md)
React **19** (not 18), React Router **v7** (not v6), Tailwind CSS **v4** via `@tailwindcss/vite` plugin (not v3+PostCSS), chess.js v1, Chessground, Supabase JS v2, Stockfish 19 WASM, Shadcn/ui New York style.

`docs/plan.md` is the design document but its dependency versions are outdated. Trust `package.json`.

## Architecture
- `src/main.tsx` → `<App />` into `index.html`.
- `src/App.tsx` uses `BrowserRouter`, public authentication routes, and protected application routes.
- `src/repositories/` and application services form the Supabase access boundary.
- `src/auth/` handles sessions, protected routes, and password and invitation flows.
- `@/` alias → `src/` (tsconfig paths + vite alias).
- Shadcn/ui: `npx shadcn@latest add <name>` — components to `@/components/ui`. The `cn()` helper is at `@/lib/utils`.
- ESM (`"type": "module"`). Strict TS with `noUnusedLocals`, `noUnusedParameters`.

## Gotchas
- `tsc -b` is the typecheck step (part of build, not a separate script).
- Auto-imports/linting of unused symbols will fail the build — keep imports clean.
- Database and authentication: Supabase; the client uses only the public URL and publishable key.
- Stockfish runs in the browser via a multithreaded WASM Web Worker, with a single-threaded fallback.
- Backups and exports use browser file and download APIs.
- The application locale is Italian (`lang="it"` in index.html).

## Instructions
- Before writing or modifying code, read `PRODUCT.md` and `DESIGN.md` and treat them as binding references throughout implementation: `PRODUCT.md` defines product goals and constraints, while `DESIGN.md` defines the visual system and interface rules.
- Read only the adr directory when you have to make decisions about architecture or design. Open only the doc that has the title that matches the current topic.

## Task workflow and specifications
- When asked to work from `TASKS.md`, select the explicitly requested task or the next eligible task, respecting priorities and dependencies. Work on one task at a time and update its status and verification evidence in `TASKS.md`; mark it complete only when its acceptance criteria are met. Stop after that task unless the user requests another.
- When the user requests work that is not in `TASKS.md`, work on it directly; do not require a task entry first.
- Work spec-first: before implementation, read the relevant existing specifications in `docs/specs/`. For substantial new behavior or changes, create or update a focused specification there before coding, recording the goal, scope, expected behavior, constraints, and acceptance criteria. For small changes, update an existing specification when needed rather than creating unnecessary documents.
- Keep relevant specifications aligned with the implemented behavior and verification results so they provide reliable context for future work. Do not treat historical specifications as proof of current behavior without checking the implementation when needed.

## Language
- Communicate with the user in Italian in chat.
- Write code, documentation, skills, agent instructions, and other project artifacts in English. User-facing application text remains Italian, as required by the product locale.
