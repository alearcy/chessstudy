# Coordinate scacchiera esterne di default

## Obiettivo

Mostrare le coordinate fuori dalla scacchiera all'apertura, sia nelle lezioni
di studio sia nelle analisi. Il comando coordinate nella toolbar continua a
commutare la visualizzazione e, al primo clic, porta le coordinate dentro le
case.

## Implementazione

- Il componente condiviso `ChessBoardView` inizializza
  `coordinatesOnSquares` a `false`.
- Chessground mantiene `coordinates: true`, quindi le coordinate restano
  visibili sul bordo esterno.
- Il pulsante esistente inverte lo stato; da `false` passa a `true` e mostra le
  coordinate dentro le case.
- Il comportamento è verificato per entrambi i valori di `lessonMode`.

## Verifica

- Test del valore passato a Chessground al rendering iniziale e dopo il clic.
- `npm test` e `npm run build`.
