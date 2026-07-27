# BUG-003: Apertura Studio sull'ultima mossa

## Problema

Quando viene selezionata una scacchiera di Studio con mosse già persistite,
`LessonDetailPage` carica la sequenza con `historyIndex = 0`. Una nuova mossa
giocata da quella posizione viene interpretata come una variante lineare e
tronca tutte le mosse successive.

Il troncamento dopo una navigazione volontaria nel passato resta corretto; il
bug è la posizione iniziale inattesa al momento della selezione.

## Comportamento atteso

- Una scacchiera di Studio viene mostrata sull'ultima mossa persistita.
- Una scacchiera senza mosse resta sulla posizione iniziale.
- Una scacchiera di Analisi continua ad aprirsi dalla posizione iniziale.
- Undo, redo e selezione manuale delle mosse continuano a funzionare.
- Una nuova mossa giocata subito dopo la selezione viene aggiunta in fondo e
  non tronca la linea esistente.

## Approccio tecnico

- Aggiungere una funzione pura che restituisce l'indice iniziale:
  `moveCount` per `study`, `0` per `analysis`.
- Passare l'indice come quinto argomento di `useChessBoard.loadSequence` nel
  caricamento della scacchiera selezionata.
- Usare la stessa regola quando una scacchiera viene ricaricata dal database
  dopo un errore di persistenza.
- Non modificare `makeMove`: il suo troncamento della linea futura rimane
  intenzionale quando l'utente naviga esplicitamente nel passato.

## Strategia di test

- Testare la scelta dell'indice per Studio e Analisi.
- Verificare nell'hook che il caricamento sull'ultima posizione permetta di
  aggiungere una mossa senza restituire ID troncati.
- Eseguire suite completa, lint e build.
