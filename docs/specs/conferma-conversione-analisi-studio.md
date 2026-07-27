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
- Il nuovo Studio contiene soltanto la sequenza delle mosse. Valutazioni,
  commenti e suggerimenti Stockfish, spunti didattici, annotazioni e report di
  analisi non vengono copiati.
- Durante la conversione i comandi del dialog sono disabilitati e il pulsante
  di conferma mostra lo stato in corso.
- Gli errori continuano a essere mostrati dal banner contestuale gia presente
  in `LessonDetailPage`.

## Implementazione

Il controllo di conversione in `ChessBoardView` gestisce lo stato di apertura
del dialog. La callback ricevuta da `LessonDetailPage` viene invocata soltanto
dopo la conferma esplicita.

La RPC `convert_analysis_to_study` mantiene la conversione atomica ma inserisce
board e mosse usando i default puliti dei campi di analisi. Il client passa
soltanto gli ID della lezione e della board sorgenti; non carica preventivamente
le mosse.

## Test

- Il primo click apre il dialog senza invocare la callback.
- `Annulla` chiude il dialog senza conversione.
- `Converti` invoca la callback una sola volta.
- La migrazione della RPC copia soltanto notazione, FEN e ordine delle mosse.
- Test completi, lint e build passano.
