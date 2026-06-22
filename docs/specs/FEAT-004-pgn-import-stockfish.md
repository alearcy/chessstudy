# FEAT-004: Import PGN + Analisi mosse con Stockfish 18

## Obiettivo
Permettere all'utente di importare una partita in formato PGN all'interno di una
lezione (creando una scacchiera con la storia mosse già popolata) e ottenere
un'analisi automatica di ogni posizione con l'ultimo modello Stockfish (SF18,
NNUE) eseguito in browser via WebWorker WASM. Le valutazioni sono persistite su
`Move` e rivedibili alla riapertura.

## Subtask
- **A — Import PGN → board popolata**
- **B — Analisi mosse con Stockfish 18 (NNUE)**

---

## Subtask A — Import PGN

### UI
- Pulsante "Importa PGN" nell'header della sidebar scacchiere (affianco al `+`
  "Nuova scacchiera"), icona `Upload` (lucide).
- Apre un `Dialog` con:
  - `<Textarea>` per incollare il PGN
  - `<Input type="file" accept=".pgn,application/x-chess-pgn">` per upload file
    (il contenuto del file viene letto con `FileReader` e inserito nella textarea)
  - Messaggio di errore (in italiano) se il parse fallisce
  - Pulsante "Importa" (disabilitato se textarea vuota o parse fallito)

### Servizio `src/services/pgnService.ts`
```ts
export interface ParsedPgnMove {
  san: string;
  fenAfter: string;      // posizione dopo la mossa (→ Move.fen)
  comment: string;       // commento mainline {…} associato ("" se assente)
}

export interface ParsedPgn {
  startFen: string;       // startpos di default, o header [SetUp]/[FEN]
  headers: Record<string, string | null>;
  moves: ParsedPgnMove[];
  title: string;          // derivato da Event / White vs Black / fallback
}

/** Parsa un PGN. Lancia Error se invalido. */
export function parsePgn(pgn: string): ParsedPgn;

/**
 * Crea una nuova Board nella lezione + tutte le mosse (bulkAdd).
 * Ritorna il boardId creato.
 */
export async function importPgnToLesson(
  lessonId: number,
  pgn: string
): Promise<number>;
```

#### Dettagli `parsePgn`
- Usa `new Chess()` + `chess.loadPgn(pgn)`. Se lancia → propagare Error.
- `startFen`: se `chess.header().SetUp === "1"` e `header().FEN` presente →
  quello; altrimenti `DEFAULT_POSITION` (startpos).
  - **Attenzione**: `loadPgn` con header `FEN` carica già la posizione custom;
    la storia `history({verbose})` parte da lì. Il `before` del primo ply = startFen.
- `moves`: da `chess.history({verbose:true})` → per ogni ply:
  `san = m.san`, `fenAfter = m.after`.
- `comment`: da `chess.getComments()` → array `{fen, comment}`. Match per
  `fen === m.after` (il commento di una mossa è associato alla posizione dopo).
  Se più commenti matchano lo stesso fen, prende il primo.
- `title`: `header().Event` se presente e non `"?"`; altrimenti
  `"White vs Black"` se presenti; altrimenti `"Partita importata"`. Tronca a 60 char.
- **Limitazione documentata**: le varianti `( )` nel PGN sono **scartate** da
  chess.js v1 (solo mainline). Coerente con TD-001 (variante = scacchiera
  separata). I commenti NAG (`$1`, `$2`…) non sono gestiti.

#### Dettagli `importPgnToLesson`
- Crea Board con `createBoard(lessonId, title)` poi `updateBoard(boardId, { fen: startFen })`.
  - Oppure nuova funzione `createBoardWithFen(lessonId, { title, fen })` in boardService.
- `db.moves.bulkAdd` di tutti i ply con `order` 0..N-1, `moveNotation=san`,
  `fen=fenAfter`, `comment`, `parentId` calcolato dagli id restituiti da `bulkAdd`
  (l'id del ply precedente → parentId del ply corrente; primo ply parentId=null).
  - **Side-effect positivo**: risolve l'item "parentId con mosse veloci" di TD-001
    per il path di import (parentId sempre corretto).
- Ritorna `boardId`.

### Integrazione in `LessonDetailPage`
- Dopo `importPgnToLesson`: `await loadData()` (ricarica boards), seleziona il
  nuovo boardId, l'effect esistente caricherà `loadSequence(startFen, moves)`
  automaticamente via `getMovesByBoard`.

### File Subtask A
| File | Azione |
|------|--------|
| `src/services/pgnService.ts` | Nuovo |
| `src/components/board/ImportPgnDialog.tsx` | Nuovo |
| `src/services/boardService.ts` | Modifica — `createBoardWithFen` |
| `src/pages/LessonDetailPage.tsx` | Modifica — bottone + dialog |
| `docs/tech-debt/move-history-not-persisted.md` | Modifica — annotare parentId risolto via import |

---

## Subtask B — Analisi Stockfish 18 (NNUE)

### Architettura
- WebWorker (`src/workers/stockfish.worker.ts`) che carica `stockfish.js` /
  `stockfish.wasm` e speaks UCI via `postMessage`/`onmessage`.
- Wrapper `src/services/analysisService.ts`:
  ```ts
  export interface PositionEval {
    moveIndex: number;       // 0 = posizione iniziale, i = dopo mossa i-1
    fen: string;
    depth: number;
    scoreCp: number | null;  // centesimi di pedone, da POV bianco
    scoreMate: number | null;// mosse a mate, da POV bianco (±)
    bestMoveUci: string | null;
    pvSan: string[];         // principal variation in SAN
  }
  export async function analyzeGame(
    startFen: string,
    moves: { san: string }[],
    options: { depth: number; onProgress?: (done: number, total: number) => void }
  ): Promise<PositionEval[]>;
  ```

### Engine: Stockfish 18 NNUE
- **ADR-0001** documenta il tradeoff e la scelta (SF18 NNUE → accuratezza max).
- Richiede **SharedArrayBuffer** → dev server e produzione devono servire con
  `Cross-Origin-Opener-Policy: same-origin` e `Cross-Origin-Embedder-Policy: require-corp`.
  - Vite: `server.headers` + `preview.headers` in `vite.config.ts`.
  - L'engine binary + NNUE net sono serviti da `public/stockfish/` (bundle locale)
    o CDN con credenziali; preferenza bundle locale per offline.
- Risoluzione del binario SF18 NNUE per browser: da definire in ADR (pacchetto
  npm `stockfish` / download release `stockfish.wasm` SF18). Il net NNUE è
  embeddato o caricato a runtime.

### Modello dati — schema v3
Aggiunta campi eval a `Move` (tutti opzionali, no migrazione esplicita):
```ts
interface Move {
  // ...esistenti...
  evalCp?: number | null;
  evalMate?: number | null;
  evalDepth?: number;
  evalBestMoveUci?: string | null;
  evalPv?: string[];        // SAN PV (opzionale, per debug/display)
}
```
- `db.version(3)` in `database.ts` (stesso schema stores, campi opzionali).
- `moveService.updateMoveEval(id, { evalCp, evalMate, evalDepth, evalBestMoveUci, evalPv })`.

### UI
- Pulsante "Analizza partita" nella toolbar scacchiera (icona `Brain` o `Zap`).
- Click → batch su ogni posizione (start + dopo ogni mossa) a profondità fissa
  (default 15, configurabile). Progress bar inline.
- Al termine: persistenza eval su ogni `Move` (updateMoveEval).
- Display:
  - `MoveNotation`: badge eval per mossa (cp come `+1.2` / mate come `M3`) +
    classe colore (good 🟢 / inaccuracy 🟡 / blunder 🔴) con soglie classiche.
  - Overlay freccia `bestMoveUci` su scacchiera (parse `e2e4` → `["e2","e4"]`,
    riusa `BoardArrow` con colore distintivo, es. blu).
  - Pannello eval posizione corrente (cp/mate/depth/PV) — inline sotto toolbar
    o nel tab note.

### File Subtask B
| File | Azione |
|------|--------|
| `src/services/analysisService.ts` | Nuovo |
| `src/workers/stockfish.worker.ts` | Nuovo |
| `public/stockfish/...` | Nuovo — binari SF18 NNUE |
| `src/types/index.ts` | Modifica — campi eval su `Move` |
| `src/db/database.ts` | Modifica — `db.version(3)` |
| `src/services/moveService.ts` | Modifica — `updateMoveEval` |
| `src/pages/LessonDetailPage.tsx` | Modifica — bottone analisi + overlay |
| `src/components/board/MoveNotation.tsx` | Modifica — badge eval |
| `src/components/board/AnalysisPanel.tsx` | Nuovo (o inline) |
| `vite.config.ts` | Modifica — COOP/COEP headers |
| `docs/adr/0001-stockfish-in-browser.md` | Nuovo |

---

## Out of scope (tech debt da tracciare se emerge)
- Varianti PGN (mainline only).
- Test automatici (nessun framework configurato — vedi AGENTS.md; decisione
  utente: procedere senza test per ora).
- Configurabilità profondità/threads analisi da UI (default hardcoded 15).

## Definition of done
- `npm run build` (`tsc -b && vite build`) verde.
- Import PGN: parse + board + mosse create e visualizzate correttamente.
- Analisi: eval persistiti, badge + overlay visualizzati, riapertura li rilegge.
- Nessun file non correlato modificato.
- Eventuali workaround tracciati in `docs/tech-debt/`.
