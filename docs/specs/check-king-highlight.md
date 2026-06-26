# Evidenziazione re sotto scacco e matto

## Task
Quando la posizione corrente è in scacco, evidenziare in rosso la casa del re
del lato al tratto. Quando la posizione corrente è in scacco matto, mantenere
l'evidenziazione rossa e mostrare un badge con teschio sulla casa del re.

## Approccio tecnico

- Derivare lo stato dalla `fen` corrente, senza persistere nuovi campi.
- Usare `chess.js`:
  - `new Chess(fen).isCheck()` per scacco.
  - `new Chess(fen).isCheckmate()` per matto.
  - `game.turn()` per il colore del re sotto attacco.
  - `game.board()` per trovare la casa del re del lato al tratto.
- Passare a `ChessBoardView` una prop:

```ts
kingStatus?: {
  square: Square;
  checkmate: boolean;
} | null;
```

## UI

- Aggiungere rosso semi-trasparente alla casa del re.
- In caso di matto, renderizzare un badge `☠️` sulla stessa casa tramite
  `squareRenderer`.
- Lo stile di scacco deve prevalere su evidenziazioni utente e highlight ultima
  mossa, perché è informazione tattica critica.

## File modificati

- `src/pages/LessonDetailPage.tsx` — calcolo `kingStatus` da FEN corrente e
  passaggio prop a entrambe le istanze `ChessBoardView`.
- `src/components/board/ChessBoard.tsx` — prop `kingStatus`, stile rosso e
  badge matto.

## Verifica

Non c'è test framework configurato. La verifica richiesta è `npm run build`
(`tsc -b && vite build`).
