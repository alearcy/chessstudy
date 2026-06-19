# FEAT-001: Scacchiera interattiva nella lezione

## Obiettivo
All'interno di una lezione, l'utente può vedere una scacchiera interattiva, spostare i pezzi secondo le regole degli scacchi, disegnare frecce ed evidenziare case.

## File creati/modificati

| File | Azione |
|------|--------|
| `src/services/boardService.ts` | Nuovo — CRUD board con cascade delete moves |
| `src/services/lessonService.ts` | Modifica — aggiungere cascade delete moves in `deleteLesson` |
| `src/hooks/useChessBoard.ts` | Nuovo — hook per stato chess.js |
| `src/components/board/ChessBoard.tsx` | Nuovo — wrapper react-chessboard con modalità |
| `src/pages/LessonDetailPage.tsx` | Nuovo — `/lesson/:id` |
| `src/pages/BoardPage.tsx` | Nuovo — `/lesson/:id/board/:boardId` |
| `src/App.tsx` | Modifica — aggiungere rotte |

## Modalità scacchiera

Toolbar con 3 pulsanti mutuamente esclusivi:

1. **Move** (default): `arePiecesDraggable={true}`, `areArrowsAllowed={false}`
   - Drag & drop + click-to-move con validazione `chess.js`
   - Promozione automatica a regina
2. **Arrow**: `arePiecesDraggable={false}`, `areArrowsAllowed={true}`
   - Right-click + drag per disegnare frecce (nativo react-chessboard)
3. **Highlight**: `arePiecesDraggable={false}`, `areArrowsAllowed={false}`
   - Left-click su una casa per toggle evidenziazione verde (`customSquareStyles`)

## Dettagli tecnici

- `useChessBoard` hook: crea istanza `Chess`, espone `{ game, fen, history, pendingPromotion, makeMove, reset, undo, setPosition }`
- `boardService`: `getBoardsByLesson`, `getBoard`, `createBoard` (con FEN di default "start"), `updateBoard`, `deleteBoard` (cascade moves)
- Le frecce sono gestite come `Arrow[]` nello stato del componente ChessBoard
- Gli highlight sono gestiti come `Square[]` nello stato del componente ChessBoard