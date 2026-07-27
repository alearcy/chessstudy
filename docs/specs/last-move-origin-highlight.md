# Evidenziazione completa dell'ultima mossa

## Task
Evidenziare in azzurro sia la casa di **partenza** (`from`) sia quella di
**arrivo** (`to`) dell'ultima mossa giocata. La colorazione viene rimossa e
sostituita quando viene giocata la mossa successiva.

Esempio: e4→e5 evidenzia e4 ed e5; poi e5→e6 toglie e4 ed evidenzia e5 ed e6.

## Approccio tecnico

Il modello `Move` conserva solo `moveNotation` (SAN) e `fen` (posizione dopo la
mossa), non `from`/`to`. La destinazione è già derivata dalla SAN per il badge
della mossa. Per ottenere la casa di partenza si fa replay del SAN sulla
posizione **precedente** alla mossa corrente tramite chess.js:

```ts
const prevFen = chess.history[chess.historyIndex - 1];
const replay = new Chess(prevFen);
const played = replay.move(move.moveNotation);
played.from; // Square
played.to;   // Square
```

`history[0]` = posizione di partenza, `history[i+1]` = posizione dopo la mossa
`i`. La posizione precedente alla mossa corrente (`moves[historyIndex-1]`) è
`history[historyIndex-1]`.

### UI

- `ChessBoardView` riceve `lastMoveFromSquare` e `lastMoveSquare`.
- `LAST_MOVE_COLOR = "rgba(56, 189, 248, 0.45)"` usa un azzurro leggibile sui
  temi chiaro e scuro.
- La mappa `highlight.custom` di Chessground assegna la stessa classe
  `cs-last-move` a partenza e arrivo.
- La colorazione si aggiorna automaticamente a ogni cambio `historyIndex` /
  `currentMove`: nessuno stato extra da gestire.

### Navigazione

- `goToMove`, `undo`, `redo`, nuova `makeMove`, `reset` ricalcolano entrambe le
  case. A `historyIndex === 0` non viene mostrata alcuna evidenziazione.
- Funziona sia in Studio sia in Analisi: entrambe le istanze di
  `ChessBoardView` ricevono le stesse prop.

## File modificati
- `src/components/board/ChessBoard.tsx` — mappa di classi per entrambe le case
  e stile azzurro condiviso.
- `src/components/board/ChessBoard.test.tsx` — copertura per Studio e Analisi.
- `src/pages/LessonDetailPage.tsx` — derivazione delle case e prop passate a
  entrambe le istanze di `ChessBoardView`.

## Decisioni
- Colore azzurro (`rgba(56, 189, 248, 0.45)`) per rendere la mossa riconoscibile
  senza confonderla con le evidenziazioni manuali.
- Replay chess.js invece di aggiungere campi `from`/`to` al modello `Move`
  (evita migrazione DB; il dato è ricavabile on-demand).
