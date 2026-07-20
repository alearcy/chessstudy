# Cornice coordinate scacchiera ad alta visibilita

## Obiettivo

Rendere piu leggibili le coordinate compatte di Chessground nelle scacchiere
di Studio e Analisi, senza modificare l'ingombro complessivo del componente.
La modalita che mostra le coordinate dentro ogni casa resta invariata.

## Implementazione

- `ChessBoardView` continua a usare `coordinates: true` e lo stato locale
  `coordinatesOnSquares`, impostando esplicitamente `ranksPosition: "right"`.
- Quando `coordinatesOnSquares` e `false`, la superficie giocabile riserva una
  fascia di 18 px a destra e in basso all'interno dello spazio attuale.
- I numeri sono centrati nella fascia destra e le lettere in quella inferiore,
  con testo da 12 px semibold, opacita piena e colori del tema applicativo.
- Chessground e il livello React dei badge condividono la stessa superficie,
  cosi gli indicatori restano allineati alle case.
- Quando `coordinatesOnSquares` e `true`, la cornice scompare e la scacchiera
  recupera tutto lo spazio disponibile.
- L'orientamento di Chessground continua a invertire automaticamente l'ordine
  delle coordinate quando la scacchiera viene ruotata.

## Verifica

- Testare Studio e Analisi con cornice attiva di default e
  `ranksPosition: "right"`.
- Testare che il comando esistente rimuova la cornice e attivi le coordinate
  dentro le case.
- Verificare tema chiaro/scuro, orientamento bianco/nero e layout responsive.
- Eseguire test, lint e build.
