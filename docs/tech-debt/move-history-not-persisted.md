# TD-001: Storia mosse non persistita lato DB

## Stato
Aperto.

## Origine
Introdotta durante FEAT-003 (layout lezione 3 colonne). Già presente
implicitamente in FEAT-001/FEAT-002.

## Descrizione
Il modello dati prevede una tabella `moves` con struttura ad albero
(`parentId`, `order`, `moveNotation`, `fen`, `comment`) per tracciare mosse,
varianti e commenti di ogni scacchiera. Attualmente:

- L'hook `useChessBoard` mantiene storia mosse SAN e storia FEN **solo in memoria**
  (stato React `history` / `moveHistory`).
- Alla mossa/undo/redo/reset viene persistito **solo il FEN corrente** su `Board`
  (`updateBoard(id, { fen })`).
- La tabella `moves` non è mai scritta né letta.
- Di conseguenza, ricaricando una scacchiera si perde tutta la storia mosse
  (si riparte dal FEN salvato con storia vuota), così come varianti e commenti.

## Workaround corrente
Persistenza del solo FEN su `Board.fen`. Per riprodurre una posizione si può
salvarla come nuova scacchiera, ma non si può navigare la storia.

## Impatto
- Perdita della storia mosse al ricaricamento.
- Le varianti e i commenti (feature core del progetto, vedi `docs/plan.md`)
  non sono ancora implementate.
- Il pannello mosse (`MoveNotation`) mostra solo la sessione corrente.

## Risoluzione proposta
1. Persistire ogni mossa in `moves` con `parentId` dell'ultima mossa e
   `fen` dopo la mossa, `moveNotation` SAN, `order` progressivo.
2. Caricare la storia da `moves` all'inizializzazione dell'hook per una board.
3. Gestire varianti (più figli con stesso `parentId`) e commenti (campo `comment`).
4. Aggiornare undo/redo/reset perché agiscano sui dati persistenti o su un
   albero in memoria sincronizzato.

## File correlati
- `src/hooks/useChessBoard.ts`
- `src/services/boardService.ts` (mancano `getMovesByBoard` / `createMove`...)
- `src/db/database.ts`
- `src/pages/LessonDetailPage.tsx`
