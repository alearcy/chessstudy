# Rimozione analisi partita dalla toolbar

## Obiettivo

- Rendere piu leggibile la barra verticale di valutazione.
- Rimuovere il separatore refuso sopra la scacchiera.
- Eliminare il comando manuale `Analisi partita` e il relativo flusso frontend non piu raggiungibile.

## Modifiche

- La barra di valutazione passa da 20 px a 28 px; la colonna dedicata passa da 32 px a 40 px.
- Il pulsante `Lezioni` mantiene la larghezza del contenuto e resta allineato a sinistra anche nel layout flex della modalita analisi.
- Dalla toolbar in modalita analisi vengono rimossi pulsante e separatore.
- Da `LessonDetailPage` vengono rimossi stato, handler, errori e rendering del riepilogo associati al comando.
- Vengono eliminati anche servizio, helper e componente markdown rimasti senza chiamanti.
- Il campo persistito `Board.gameAnalysis` resta nello schema per compatibilita con i database esistenti.
