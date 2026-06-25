# TASKS

## In Progress

- Evidenziazione casa di partenza dell'ultima mossa

## Completed

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

## Todo
- [ ] color the previous home in the chessboard, then remove the color after the next move. It aim to visualize the move and the home from the rhe pawn/piece come from. For example, if I move from e4 to e5, color e4. Then if I move from e5 to e6 uncolor e4 and color e5 and so on.
- [ ] AI analysis comment refactor:
	- keep only panoramica and giudizio
	- for each "momento chiave" move the comment to related move in the moves sidebar. For example if a comment is about d5, write this comment in the d5 move comment below the stockfish one. The suggested move doesn't be related move because are only a comment and so rely to the main move.
	- convert template to a dark theme
