# Sostituire react-chessboard con chessground

## Obiettivo
Sostituire `react-chessboard` con `@lichess-org/chessground` mantenendo
invariata l'API del componente `ChessBoardView` verso `LessonDetailPage`.

## Comportamento
- Modalita "Muovi": drag & drop e click-to-move restano validati da `chess.js`
  tramite `onMove(from, to)`.
- Modalita "Frecce": right-click + drag usa il layer `drawable` di
  `chessground`; le frecce persistite restano `BoardArrow[]`.
- Modalita "Evidenzia": click su casa fa toggle delle evidenziazioni
  persistite.
- Le frecce di analisi Stockfish restano read-only tramite `autoShapes`.
- Ultima casa di partenza, highlight utente e re sotto scacco sono classi CSS
  su `highlight.custom`, con prevalenza visiva dello scacco.
- Badge classificazione mossa e badge matto sono overlay React sopra la board.
- Orientamento bianco/nero resta pilotato da prop `boardOrientation`.

## Dettagli tecnici
- `ChessBoardView` istanzia `Chessground` da `@lichess-org/chessground` su un
  `div` con `useEffect`.
- Gli aggiornamenti successivi chiamano `api.set(...)`, `api.setShapes(...)` e
  `api.setAutoShapes(...)`, evitando remount della board.
- `BoardArrow` viene convertita in `DrawShape`; il colore custom usa brush
  generati.
- La rimozione singola freccia diventa supportata dal comportamento nativo:
  ridisegnare una freccia con stesso `orig`/`dest` la rimuove.
- `LessonDetailPage.handleArrowsChange` accetta la lista completa di frecce
  restituita da `chessground`, inclusa lista vuota.

## File modificati
- `src/components/board/ChessBoard.tsx`
- `src/pages/LessonDetailPage.tsx`
- `src/main.tsx`
- `package.json`
- `package-lock.json`
- `docs/tech-debt/move-history-not-persisted.md`

## Verifica
- Nessun test framework e' configurato; verifica minima: `npm run build`.
