# TASKS

## In Progress

## Completed

- Scomporre LessonDetailPage

- Configurare ESLint flat config

- Error handling visibile per operazioni critiche

- Coda Stockfish e concorrenza analisi

- Migrazioni DB conservative

- Persistenza mosse affidabile

- Evidenziazione re sotto scacco e matto

- [x] Navigazione mosse con frecce tastiera
  - Spec: `docs/specs/keyboard-move-navigation.md`

- AI analysis comment refactor (→ `docs/specs/ai-comment-refactor.md`):
  - keep only panoramica and giudizio in AI summary
  - move "momento chiave" comments to related move in moves sidebar (below stockfish comment); suggested moves stay on main move
  - remove move links from AI summary and move comments (LLM no longer emits markdown links)
- Evidenziazione casa di partenza dell'ultima mossa
  Spec: `docs/specs/last-move-origin-highlight.md`

- [x] Badge notazione estesa: classificazione stile chess.com per ogni mossa
  - Spec: `docs/specs/move-badges-extended.md`
- [x] OpenRouter LLM (sostituzione llama.cpp/Gemma)
  - Spec: `docs/specs/openrouter-llm.md`
  - ADR: `docs/adr/0003-openrouter-llm.md`

- [x] Import PGN: ogni PGN diventa lezione analysis autonoma (non più contenitore cumulativo)
  - Spec: `docs/specs/pgn-import-per-lesson.md`

- [x] FEAT-006 Refactor home page + modalità Analisi vs Studio
  - Spec: `docs/specs/refactor-home-analysis.md`
- [x] FEAT-001 Scacchiera interattiva nella lezione
  - Spec: `docs/specs/FEAT-001-chessboard-lesson.md`
- [x] FEAT-002 Layout scacchiera sinistra + pannello notazione mosse destra
  - Spec: `docs/specs/move-notation-panel.md`
- [x] FEAT-003 Layout lezione 3 colonne (scacchiere | scacchiera+note | mosse)
  - Spec: `docs/specs/lesson-3col-layout.md`
- [x] FEAT-004 Import PGN in una lezione + analisi mosse con Stockfish 18
  - Subtask A: Import PGN → board popolata
  - Subtask B: Analisi mosse con Stockfish 18 (NNUE)
  - Spec: `docs/specs/FEAT-004-pgn-import-stockfish.md`
- [x] FEAT-005 Servizio spiegazione mosse in linguaggio naturale (locale, no LLM)
  - Subtask A: `explainService.ts` — detection pattern tattici (fork, pin, skewer, hanging, mate threat)
  - Subtask B: Template generator italiano — spiega blunder, missed tactics, eval
  - Subtask C: Integrazione UI — mostra spiegazione salvata come commento mossa
  - Spec: `docs/specs/FEAT-005-explain-service.md`
- [x] TAURI-001 Conversione Tauri del frontend esistente
  - Installed Rust 1.96 + Tauri CLI 2.11.3 + `@tauri-apps/api` 2.x
  - Created `src-tauri/` with Rust backend scaffold
  - Replaced `BrowserRouter` → `HashRouter` per compatibilità Tauri production
  - Build frontend (Vite) + backend (Cargo) entrambi passano
  - ADR: `docs/adr/0002-tauri-native-sf-llm.md`
- [x] TAURI-002 Sostituire Stockfish WASM con Stockfish 18 nativo via UCI
  - Spec: `docs/specs/TAURI-002-native-stockfish.md`
- [x] TAURI-003 Integrare LLM locale per commenti didattici
  - Spec: `docs/specs/TAURI-003-local-llm.md`
- [x] color the previous home in the chessboard, then remove the color after the next move. It aim to visualize the move and the home from the rhe pawn/piece come from. For example, if I move from e4 to e5, color e4. Then if I move from e5 to e6 uncolor e4 and color e5 and so on. (→ `docs/specs/last-move-origin-highlight.md`)
- [x] Tema dark app-wide (→ `docs/specs/dark-theme.md`)

## Todo

- [ ] Aggiungere test minimi
  - Coprire parsing/eval, hook scacchiera e persistenza core con framework da scegliere.
- [ ] Ridurre bundle iniziale
  - Introdurre lazy loading/code splitting per moduli pesanti: chessboard, markdown, PGN, AI/Stockfish.
