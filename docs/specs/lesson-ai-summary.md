# Sommario AI partita (game analysis)

## Obiettivo
Generare un riassunto della partita caricata via PGN usando l'LLM (OpenRouter),
mostrarlo nella vista di analisi e persistirlo sul DB.

## Decisioni
- **Storage**: campo `Board.gameAnalysis?: string` (non `Lesson.description`).
  Rationale: una lezione `study` può avere più board; il sommario è per-partita
  (board), non per-lezione. Le lezioni `analysis` hanno una sola board →
  equivalente pratica.
- **DB migration**: `db.version(8)` aggiunge `gameAnalysis` a `boards`.
- **Trigger**: bottone manuale "Analisi partita" (icona Sparkles) nella toolbar
  della scacchiera in modalità `analysis`. Non auto-trigger post-Stockfish:
  evita spese API inutili e lascia controllo all'utente.
- **Rendering**: blocco ReactMarkdown sopra il commento mossa, con link alle
  mosse (`#move-N` → `chess.goToMove(N+1)`) via `linkifyMoves`.

## Flusso
1. Utente importa PGN → lezione analysis autonoma con una board
2. Auto-analisi Stockfish (eval su ogni posizione)
3. Utente clicca "Analisi partita" (Sparkles)
4. `handleGameAnalysis`:
   - Costruisce array mosse con: numero, SAN, giocatore, evalBefore/After,
     classificazione (PESSATA/ERRORE/IMPRECISIONE/OTTIMA/BUONA), bestSan
   - Calcola `keySwings` (swings di eval significativi)
   - Chiama `analyzeGame()` → `invoke("generate_game_analysis")` → OpenRouter
   - Persiste risultato in `Board.gameAnalysis`
   - Aggiorna stato `gameAnalysisText` + board list
5. Render: ReactMarkdown con link mosse cliccabili

## File
| File | Ruolo |
|------|-------|
| `src-tauri/src/commentary.rs` | `GameAnalysisInput`, `build_game_analysis_prompt`, `generate_game_analysis` |
| `src-tauri/src/commands.rs` | comando `generate_game_analysis` |
| `src-tauri/src/lib.rs` | registrazione handler |
| `src/services/explainService.ts` | `analyzeGame()` wrapper invoke |
| `src/pages/LessonDetailPage.tsx` | `handleGameAnalysis`, stato `gameAnalysisText`, rendering ReactMarkdown, `linkifyMoves`, `computeKeySwings`, `formatEvalForPrompt` |
| `src/components/board/ChessBoard.tsx` | bottone "Analisi partita" (Sparkles), prop `gameAnalysisLoading`/`onGameAnalysis` |
| `src/types/index.ts` | `Board.gameAnalysis?: string` |
| `src/db/database.ts` | `db.version(8)` migrazione campo |

## Prompt LLM
- System: insegnante di scacchi italiano, terza persona, notazione italiana (R/D/T/A/C), max ~250 parole
- User: giocatori, risultato, lista mosse con classificazione + eval, key swings
- Output: markdown con paragrafi + link `[mossa](#move-N)` per navigazione

## Definition of done
- `npm run build` verde
- `cargo check` verde
- Bottone "Analisi partita" visibile solo in modalità analysis
- Risultato persistito: ricaricando la pagina il sommario riappare
- Link mosse navigabili (click → scacchiera salta alla mossa)
