# TASKS

## In Progress

Board flip: inverti posizione bianchi/neri su ogni scacchiera

## Completed

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
- [ ] Permetti a qualsiasi scacchiera, sia di analisi che di studio, di poter invertire la posizione dei bianchi e dei neri.
- [ ] Ora ci sono solo badge per alcune classificazioni di stockfish. Vorrei che ci fossero sempre usando la notazione che si usa anche su chess.com Geniale (!!), Grande (!), Migliore (stella), Ottima (pollice in su), Buona (spunta di check), Mossa interessante/rischiosa (!?). Vanno aggiunte a quelle già esistenti.
- [ ] Se l'AI è stata configurata nei settings, scrivi nella descrizione sotto il titolo nella scacchiera di analisi un breve riassunto di 50 parole o meno che descriva la partita.

