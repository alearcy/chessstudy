# Evidenziazione casa di partenza dell'ultima mossa

## Task
Evidenziare la casa di **partenza** (`from`) dell'ultima mossa giocata. La
colorazione viene rimossa e sostituita quando viene giocata la mossa successiva
(visualizza la "home" da cui proviene il pezzo/pedone).

Esempio: e4→e5 evidenzia e4; poi e5→e6 toglie e4 ed evidenzia e5.

## Approccio tecnico

Il modello `Move` conserva solo `moveNotation` (SAN) e `fen` (posizione dopo la
mossa), non `from`/`to`. Per ottenere la casa di partenza si fa replay del SAN
sulla posizione **precedente** alla mossa corrente tramite chess.js:

```ts
const prevFen = chess.history[chess.historyIndex - 1];
const replay = new Chess(prevFen);
const played = replay.move(move.moveNotation);
played.from; // Square
```

`history[0]` = posizione di partenza, `history[i+1]` = posizione dopo la mossa
`i`. La posizione precedente alla mossa corrente (`moves[historyIndex-1]`) è
`history[historyIndex-1]`.

### UI

- `ChessBoardView` riceve nuova prop `lastMoveFromSquare?: Square | null`.
- Aggiunta costante `LAST_MOVE_COLOR = "rgba(255, 213, 79, 0.55)"` (giallo,
  distinto dal verde delle evidenziazioni utente `HIGHLIGHT_COLOR`).
- `customSquareStyles` mergia prima l'evidenziazione `lastMoveFromSquare`, poi
  le evidenziazioni utente (verde). Se l'utente evidenzia manualmente la stessa
  casa, prevale il verde (override esplicito voluto).
- La colorazione si aggiorna automaticamente a ogni cambio `historyIndex` /
  `currentMove`: nessuno stato extra da gestire. Alla mossa successiva il
  `lastMoveFromSquare` cambia, quindi la casa precedente viene de-colorata.

### Navigazione

- `goToMove`, `undo`, `redo`, nuova `makeMove`, `reset` → ricalcolano
  `lastMoveFromSquare` (in `LessonDetailPage`). A `historyIndex === 0` nessuna
  evidenziazione.
- Funziona sia nel layout studio sia nel layout analysis (entrambi i
  `<ChessBoardView>` ricevono la prop).

## File modificati
- `src/components/board/ChessBoard.tsx` — prop `lastMoveFromSquare`,
  `LAST_MOVE_COLOR`, merge in `customSquareStyles`.
- `src/pages/LessonDetailPage.tsx` — `lastMoveFromSquare` (useMemo replay
  chess.js), prop passata a entrambe le istanze `ChessBoardView`.

## Decisioni
- Colore giallo (`rgba(255, 213, 79, 0.55)`) per distinguere dal verde delle
  evidenziazioni manuali e non collidere con frecce arancioni.
- Replay chess.js invece di aggiungere campi `from`/`to` al modello `Move`
  (evita migrazione DB; il dato è ricavabile on-demand).
