# Layout scacchiera sinistra + notazione mosse destra

## Obiettivo
Nella pagina della scacchiera (`BoardPage`), la scacchiera è posizionata a sinistra e a destra compare un pannello con la sequenza delle mosse in notazione algebrica (SAN).

## File creati/modificati

| File | Azione |
|------|--------|
| `src/hooks/useChessBoard.ts` | Modifica — aggiungere `moveHistory` e `goToMove` |
| `src/components/board/MoveNotation.tsx` | Nuovo — pannello notazione mosse |
| `src/components/board/ChessBoard.tsx` | Modifica — ricevere stato da props invece che hook interno |
| `src/pages/BoardPage.tsx` | Modifica — layout due colonne, sollevare `useChessBoard` |

## Dettagli tecnici

### useChessBoard hook
Aggiunge:
- `moveHistory: string[]` — storia mosse in notazione SAN da `game.history()`
- `currentMoveIndex: number` (sostituisce `historyIndex` nell'esposizione)
- `goToMove(index: number)` — carica la posizione corrispondente alla mossa `index` (0-based sull'array FEN history, dove 0 = posizione iniziale)

### MoveNotation component
Props:
- `moves: string[]` — array di mosse SAN
- `currentMoveIndex: number` — indice mossa corrente (0 = prima della prima mossa)
- `onGoToMove: (index: number) => void` — callback click su mossa

Layout: lista a coppie bianco/nero in stile tabella scacchistica classica:
```
1. e4    e5
2. Nf3   Nc6
3. Bb5   a6
```
La riga della mossa corrente è evidenziata. Click su una mossa specifica chiama `onGoToMove`.

### BoardPage layout
Container flessibile:
- Colonna sinistra (~60%): toolbar + scacchiera (560px)
- Colonna destra (~40%): pannello `MoveNotation` con bordo/background
- Layout responsive: su mobile, il pannello mosse va sotto la scacchiera

### ChessBoardView
Non usa più `useChessBoard` internamente. Riceve tutto come props:
- `fen`, `onPieceDrop`, `onSquareClick`, `customSquareStyles` + props di controllo mosse (`canUndo`, `canRedo`, `undo`, `redo`, `reset`)
- Mantiene solo lo stato interno: `mode` e `highlights`
