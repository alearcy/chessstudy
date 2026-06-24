# Board Flip

## Obiettivo
Aggiungere pulsante per invertire orientamento scacchiera (bianco sotto ↔ nero sotto) su ogni scacchiera, sia in modalità Study che Analysis.

## Implementazione

### ChessBoardView (`src/components/board/ChessBoard.tsx`)
- Nuova prop: `boardOrientation?: "white" | "black"` (default "white")
- Passare a `<Chessboard boardOrientation={boardOrientation} />`
- Pulsante flip nella toolbar: icona `ArrowUpDown` di lucide-react
- Il flip è puramente visivo: react-chessboard gestisce tutto internamente (coordinate, drag-and-drop, frecce)

### LessonDetailPage (`src/pages/LessonDetailPage.tsx`)
- Stato locale `flipped` (boolean)
- Funzione `handleFlip` che toggla
- Passare `boardOrientation={flipped ? "black" : "white"}` a ChessBoardView

### Note
- Non serve persistenza: il flip è temporaneo per comodità di studio
- react-chessboard v4 supporta nativamente `boardOrientation` prop
- Nessuna modifica al backend o al database