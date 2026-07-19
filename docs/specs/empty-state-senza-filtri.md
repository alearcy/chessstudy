# Empty state senza filtri

## Obiettivo

Semplificare la homepage quando l'utente non ha ancora creato studi né
importato analisi.

## Comportamento

- se l'archivio non contiene lezioni e non sono attivi filtri, mostrare la
  testata dell'app, i pulsanti di creazione/importazione e il messaggio di
  empty state;
- nello stesso stato non mostrare la barra dei filtri né il bordo separatore
  sotto i pulsanti di creazione;
- mostrare il testo su due righe: "Nessuna lezione o analisi" e
  "Usa i pulsanti di creazione per cominciare!";
- mostrare Nuovo studio, Importa PGN, Chess.com e Lichess con lo stesso stile
  primario chiaro e con descrizioni dal contrasto coerente;
- se esistono lezioni ma una ricerca o un filtro non produce risultati,
  mantenere visibile la barra per consentire all'utente di modificare o
  azzerare i criteri.

## Verifica

- test UI per archivio vuoto senza filtri e separatore;
- regressione del caso filtro senza risultati;
- suite Vitest, lint e build.
