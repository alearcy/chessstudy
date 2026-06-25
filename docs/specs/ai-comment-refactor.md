# Refactor commenti analisi AI

## Obiettivo
Ristrutturare l'analisi AI della partita: separare "panoramica" + "giudizio"
(sommario a livello partita, su `Board.gameAnalysis`) dai commenti dei "momenti
chiave" (spostati sul `Move` correlato come `Move.aiComment`, sotto il commento
Stockfish/manuale).

Sotto-obiettivi (questo task: 1 e 2):
1. Sommario AI mantiene solo **panoramica** + **giudizio**.
2. Commenti dei "momenti chiave" → `Move.aiComment` della mossa correlata
   (la mossa giocata citata). Le mosse suggerite da Stockfish NON sono mosse
   correlate: il loro commento resta sulla mossa principale (la giocata).

Aggiornamento: i link markdown alle mosse sono stati rimossi dal prompt LLM
(e dai renderer TS). Le mosse giocate vengono citate in testo normale,
suggerimenti in *corsivo*. `cleanGameAnalysisText` converte eventuali residui
link (testi salvati in precedenza) → testo mossa.

## Approccio
Una sola chiamata LLM, output **JSON strutturato** invece di blob markdown.

### Contratto JSON LLM
```json
{
  "panoramica": "testo markdown (apertura, struttura pedonale, piani)",
  "giudizio": "testo markdown (valutazione finale, lezioni)",
  "momentiChiave": [
    { "indice": <int 0-based>, "commento": "testo markdown" }
  ]
}
```
- `indice` = indice 0-based della mossa **giocata** a cui si riferisce il
  commento (link `[san](#move-idx)`, suggerimenti in *corsivo*).
- Se il commento cita una mossa suggerita Stockfish, resta sulla mossa giocata
  (è un commento su quella posizione, non sulla mossa suggerita).

## Cambiamenti

### Rust (`src-tauri/`)
- `src/llm.rs`: nuovo metodo `prompt_json(system, user, max_tokens, temp)` →
  `response_format: { type: "json_object" }`. Parse JSON, ritorna
  `serde_json::Value`.
- `src/commentary.rs`:
  - Riscrivi `GAME_ANALYSIS_SYSTEM_PROMPT`: richiede output JSON con chiavi
    esatte `panoramica`/`giudizio`/`momentiChiave`. Mantiene regole notazione
    italiana, terza persona, link mosse, corsivo per suggerimenti.
  - `build_game_analysis_prompt`: istruisce a produrre JSON.
  - Nuovo `GameAnalysisResult { overview, judgment, move_comments:
    Vec<GameAnalysisMoveComment> }` con `GameAnalysisMoveComment { index, comment }`.
  - `analyze_game` ritorna `GameAnalysisResult` (parse JSON via `prompt_json`).
  - Rimuove `CommentaryResult` come tipo di ritorno per game analysis.
- `src/commands.rs`: `generate_game_analysis` ritorna `GameAnalysisResult`.

### TS frontend
- `src/services/explainService.ts`: `analyzeGame` ritorna
  `{ overview: string; judgment: string; moveComments: { index: number; comment: string }[] }`.
- `src/types/index.ts`: `Move.aiComment?: string`.
- `src/db/database.ts`: `db.version(9)` (campo non indicizzato, bump doc).
- `src/services/moveService.ts`: `updateMove` Pick include `aiComment`.
- `src/hooks/useChessBoard.ts`: `setMoveAiComment(index, comment)`.
- `src/pages/LessonDetailPage.tsx`:
  - `handleGameAnalysis`:
    1. Pulisce `aiComment` su tutte le mosse (DB + stato) → evita staleness
       rigenerazione.
    2. Scrive `overview + "\n\n" + judgment` in `Board.gameAnalysis`.
    3. Per ogni `moveComments[i]`: se `index` in range, scrive `aiComment` su
       `Move` corrispondente (DB + `setMoveAiComment`).
  - Render pannello commento mossa: mostra `aiComment` sotto il commento
    Stockfish/manuale, blocco distinto (bg `bg-primary/5`, etichetta "AI"),
    con `ReactMarkdown` + link `#move-idx` navigabili. Si applica in entrambi
    i layout (analysis inline + studio 3-col).

## Regole chiave
- Rigenerazione: clear `aiComment` su tutte le mosse PRIMA di scrivere le nuove.
- Guard: indici fuori range (`index < 0 || index >= moves.length`) ignorati.
- `Board.gameAnalysis` = concatenazione `overview\n\njudgment` (markdown).
- `Move.aiComment` non sovrascrive `Move.comment` (commento manuale/Stockfish):
  campi separati, render separato.

## File modificati
- `src-tauri/src/llm.rs`
- `src-tauri/src/commentary.rs`
- `src-tauri/src/commands.rs`
- `src/services/explainService.ts`
- `src/types/index.ts`
- `src/db/database.ts`
- `src/services/moveService.ts`
- `src/hooks/useChessBoard.ts`
- `src/pages/LessonDetailPage.tsx`

## Definition of done
- `npm run build` verde (tsc + vite)
- `cargo check` verde
- Sommario AI mostra solo panoramica + giudizio
- Commenti momenti chiave appaiono sotto il commento mossa correlata
- Rigenerazione pulisce `aiComment` stale
- Link mosse navigabili sia nel sommario sia nei commenti AI per mossa
