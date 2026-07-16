# Conferma conversione da analisi a studio

## Obiettivo

Evitare conversioni accidentali quando l'utente preme il comando della
scacchiera di analisi per creare una lezione di studio.

## Comportamento

- Il click sul comando `Converti in studio` apre un dialog e non avvia subito
  la conversione.
- Il dialog chiarisce che verra creata una nuova lezione di studio e che
  l'analisi originale restera invariata.
- `Annulla` chiude il dialog senza chiamare la conversione.
- `Converti` avvia il flusso esistente `convertAnalysisToStudy`.
- Durante la conversione i comandi del dialog sono disabilitati e il pulsante
  di conferma mostra lo stato in corso.
- Gli errori continuano a essere mostrati dal banner contestuale gia presente
  in `LessonDetailPage`.

## Implementazione

Il controllo di conversione in `ChessBoardView` gestisce lo stato di apertura
del dialog. La callback ricevuta da `LessonDetailPage` viene invocata soltanto
dopo la conferma esplicita.

Non cambiano il servizio, il modello dati o la semantica della conversione.

## Test

- Il primo click apre il dialog senza invocare la callback.
- `Annulla` chiude il dialog senza conversione.
- `Converti` invoca la callback una sola volta.
- Test completi, lint e build passano.
