# TASKS

## In Progress

## Completed

- UI-001 Coordinate scacchiera esterne di default
  - Spec: `docs/specs/coordinate-scacchiera.md`

- FEAT-005B Rendere affidabili e separati i commenti educativi tattici
  - Spec: `docs/specs/commenti-educativi-tattici.md`

- FEAT-008 Analisi Stockfish adattiva
  - Spec: `docs/specs/stockfish-adaptive-analysis.md`
  - ADR: `docs/adr/0005-analisi-stockfish-adattiva.md`

- FEAT-007 Importare le partite di un giocatore da Lichess e Chess.com
  - Spec: `docs/specs/import-lichess-player-games.md`

- Allargare la barra di valutazione e rimuovere il comando Analisi partita
  - Spec: `docs/specs/rimozione-analisi-partita-toolbar.md`

- [x] Aggiungere test minimi
  - Coperti parsing/eval, hook scacchiera e persistenza core con Vitest.

- [x] Rimuovere le etichette testuali "pari", "Bianco" e "Nero" dalle mosse nella sidebar, mantenendo la barra valutazione animata.

- [x] Elimina i simboli dei pezzi nei commenti didattici e sostituisci con i nomi dei pezzi in italiano. Inoltre se individui una forchetta, un'infilata o altre tattiche, colora di giallo le case dei pezzi coinvolti.

- Sostituire OpenRouter con un modello opensource leggero che giri in locale. Gemma potrebbe andar bene per analizzare gli scacchi?

- la libreria stockfish 18 ora viene usata in maniera grezza e solo per Mac. Visto che l'app sarà Mac/Windows, vorrei ci fosserò entrambe le versione compilate. Inoltre vorrei poter avere dei settaggi modificabili a frontend per scegliere la profondità di ragionamento di Stockfish e quanti CPU usare.

- sostituire le emoticons con delle icone, possibilmente prese direttamente dalla libreria shadcn

- Sostituire react-chessboard con [chessground](https://github.com/lichess-org/chessground)

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
- [x] Togliere dai commenti riferimenti a centipawn o ripetizioni tipo "per stockfish la mossa migliore era". Lasciamo solo la classificazione come buona mossa o cattiva mossa, quale sarebbe stata la mossa migliore senza dire "secondo stockfish" e lasciamo l'individuazione dei pattern tattici. Per quanto riguarda i punteggi come +1.5. -1 ecc...creiamo una barra verticale animata che mostra come è messo il bianco e il nero, come fanno gli altri siti di scacchi come chess.com o lichess.org.
- [x] Eliminare qualsiasi traccia di LLM e AI, non ne ho più bisogno. Cancella anche modello locale.

- Mi piacerebbe che quando viene trovato un matto (ad esempio il commento "matto in 5" o "matto in 1"), cliccando sulla frase "matto in 5" o "matto in 1" la scacchiera cambia mostrandomi la sequenza di mosse per quel matto. E posso ovviamente navigare tra quelle mosse. Solo quelle mosse, non quelle di tutta la partita, ma solo quelle relative al matto trovato. Un pulsante poi mi permette di tornare alla sequenza di mosse di tutta la partita. Il colore della scacchiera potrebbe essere più opaco quando si visualizza una sequenza di mosse di un matto specifico rispetto alla sequenza di mosse di tutta la partita. Fammi una proposta di come lo faresti.
## Todo
- [x] Quando viene importata una partita la mossa si posiziona sull'ultima, invece voglio che parta dall'inizio.
- [ ] Ridurre bundle iniziale
  - Introdurre lazy loading/code splitting per moduli pesanti: chessboard, markdown, PGN, AI/Stockfish.
