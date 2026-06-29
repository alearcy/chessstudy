# TD-001: Storia mosse e commenti

## Stato
Risolto (persistenza lineare + commenti implementati). Le "varianti" sono
intenzionalmente modellate come scacchiere separate nella lezione, non
come alberatura di mosse sotto una stessa scacchiera (scelta di
progettazione, non debito).

## Origine
Introdotta durante FEAT-003 (layout lezione 3 colonne). Già presente
implicitamente in FEAT-001/FEAT-002.

## Descrizione
Il modello dati prevede una tabella `moves` con struttura ad albero
(`parentId`, `order`, `moveNotation`, `fen`, `comment`) per tracciare mosse
e commenti di ogni scacchiera. Le **varianti** non sono gestite come albero:
una variante è una **scacchiera separata** nella lezione (creata dall'utente
nella sidebar). La storia mosse di ciascuna scacchiera resta **lineare**.

### Cosa è stato implementato
- `src/services/moveService.ts` con `getMovesByBoard`, `createMove`,
  `updateMove`, `deleteMovesByBoard`, `deleteMovesFromOrder`.
- L'hook `useChessBoard` ora gestisce `Move[]` (con id e comment) invece di
  una storia SAN in memoria, ed espone `loadSequence`, `makeMove`,
  `replaceMove`, `setMoveComment`, `goToMove`, ecc.
- `LessonDetailPage` carica le mosse persistite al cambio board, crea una
  `Move` nel DB a ogni mossa, e tronca le mosse future se si fa una nuova
  mossa dopo un undo (`deleteMovesFromOrder`).
- Commenti per mossa: UI a tab sotto la scacchiera ("Note scacchiera" /
  "Nota mossa N. SAN") con salvataggio debounce.
- `Board.fen` è diventato la **posizione di partenza** della scacchiera
  (fissa, non più sovrascritta a ogni mossa). La posizione corrente è
  derivata dalla storia.
- Reset è ora confermato con dialog (cancella mosse + commenti).

### Scelta di progettazione (NON debito)
- **No alberatura mosse**: le varianti sono modellate come scacchiere
  separate nella lezione, non come figli di `parentId`. Il campo `parentId`
  resta nel modello dati ma non è usato a livello UI. Fare undo + nuova
  mossa **tronca e cancella** il ramo futuro: comportamento voluto e
  coerente con il modello lineare. `MoveNotation` mostra solo il path lineare.

### Cosa rimane aperto
- **Rimozione singola freccia**: risolto in
  `docs/specs/chessground-board.md`. `@lichess-org/chessground` gestisce il
  layer draw con toggle sulla stessa freccia e `LessonDetailPage.handleArrowsChange`
  persiste la lista completa delle frecce, inclusa lista vuota.
- **parentId con mosse veloci**: risolto in
  `docs/specs/persistenza-mosse-affidabile.md`. La UI manuale ora blocca nuove
  mosse durante la scrittura pendente, serializza la persistenza e calcola
  `parentId` da una mappa `order -> moveId` aggiornata solo dopo `createMove`.
  In caso di errore, mostra un messaggio e ricarica la board dal DB.
- **Reset alla partenza**: `reset` riporta alla posizione di partenza
  (`Board.fen`). Non c'è ancora modo di impostare una partenza custom
  diversa dal FEN standard (se non modificando il DB).

## File correlati
- `src/hooks/useChessBoard.ts`
- `src/services/moveService.ts`
- `src/services/boardService.ts`
- `src/db/database.ts`
- `src/pages/LessonDetailPage.tsx`
- `src/components/board/MoveNotation.tsx`
