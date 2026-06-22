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
- **Rimozione singola freccia non supportata**: react-chessboard v4 tratta
  le frecce passate via `customArrows` come display read-only. Disegnare una
  freccia già esistente è un no-op (nessun `onArrowsChange`), quindi non è
  possibile fare toggle-off di una singola freccia persistita. Workaround:
  il pulsante "Azzera frecce" (icona X) in toolbar, visibile solo in
  modalità "Frecce", svuota tutte le frecce della posizione corrente,
  dopodiché si ridisegnano quelle volute. Le evidenziazioni (gestite nello
  stato nostro) supportano invece il toggle singolo (click per
  aggiungere/rimuovere) e non hanno bisogno di un pulsante di azzeramento.
- **parentId con mosse veloci**: in `handleMove`, il `parentId` della nuova
  mossa viene letto da `chess.moves[newMoveIndex - 1]?.id`. Se la mossa
  precedente è ancora un placeholder non persistito (id `undefined`, perché
  `createMove` è async e l'utente fa mosse molto veloci), `parentId` risulta
  `null`. Impatto: niente per la UI lineare (usa `order`), niente per le
  varianti (sono scacchiere separate). Mitigare solo se in futuro si volesse
  usare l'albero per altri scopi; altrimenti si può rimuovere il campo.
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
