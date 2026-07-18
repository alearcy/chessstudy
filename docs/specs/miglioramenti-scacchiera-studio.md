# FEAT-011: Miglioramenti scacchiera di studio

## Obiettivo

Portare la modalita Studio allo stesso livello di compattezza della modalita
Analisi e rendere le azioni principali disponibili direttamente sulla
scacchiera e sulla notazione, senza modalita di interazione separate.

## Subtask

### 1. Sidebar mosse adattiva

- Studio e Analisi condividono lo stesso wrapper di layout vincolato al
  viewport desktop: `xl:h-[calc(100dvh-13rem)]` con overflow esterno nascosto.
- `MoveNotation` in Studio usa `fullHeight`, così la lista scorre internamente
  senza allungare la pagina.
- Il comportamento mobile resta naturale e non impone un'altezza fissa.

### 2. Menu contestuale delle mosse

- In modalita Studio il tasto destro su una mossa apre un menu contestuale con
  `Commenta` ed `Elimina`.
- `Commenta` seleziona la posizione e porta il focus all'editor della nota
  mossa gia esistente.
- `Elimina` richiede conferma e tronca la linea dalla mossa selezionata in poi:
  le posizioni successive dipendono dalla mossa eliminata e non possono essere
  conservate come linea legale.
- L'operazione aggiorna database e stato in memoria e mostra un errore visibile
  in caso di fallimento.
- Il menu non e disponibile nella modalita Analisi.

### 3. Gesture unificate sulla scacchiera

- Drag and drop e click sinistro continuano a muovere i pezzi.
- Tasto destro trascinato disegna o rimuove una freccia.
- Tasto destro senza trascinamento evidenzia una casa: rosso di default, verde
  con `Shift`, giallo con `Alt`, `Option` o `Command`.
- I pulsanti `Muovi`, `Frecce` ed `Evidenzia` e le istruzioni legate alle
  modalita vengono rimossi.
- Le annotazioni restano persistite per posizione. Il modello delle
  evidenziazioni viene esteso in modo retrocompatibile per conservare il colore
  delle nuove annotazioni e leggere le vecchie case come gialle.

### 4. Dimensione coerente della scacchiera

- Le colonne centrali di Studio e Analisi condividono gli stessi limiti di
  larghezza desktop.
- La barra di valutazione resta esterna alla scacchiera e non ne riduce la
  proporzione.
- Il layout continua a restringersi in modo fluido sotto i breakpoint desktop.

### 5. Esportazione

- La toolbar Studio espone due azioni: esporta PGN ed esporta immagine.
- Il PGN viene generato dalla posizione iniziale e dalla linea persistita,
  includendo i commenti utente disponibili.
- L'immagine cattura la sola scacchiera nella posizione corrente, comprese
  frecce e case evidenziate, con orientamento corrente.
- I download usano nomi file normalizzati derivati da studio e scacchiera.
- Errori di serializzazione o acquisizione sono mostrati nella pagina.

## Strategia TDD

Ogni subtask segue RED, GREEN e REFACTOR separatamente. Dopo ogni subtask si
eseguono i test mirati e la suite pertinente; prima della chiusura si eseguono
test completi, lint e build.

## Fuori ambito

- Varianti ad albero nella stessa scacchiera.
- Esportazione dell'intera pagina o delle note esterne alla scacchiera.
- Modifica dei dati di intestazione PGN non gia disponibili nello studio.

## Definition of done

- I cinque subtask sono verificati da test e confermati nell'app.
- Studio e Analisi mantengono dimensioni e scroll coerenti.
- Le nuove azioni non sono esposte in modalita Analisi.
- Nessuna annotazione o mossa viene persa senza conferma esplicita.
- Test, lint e build passano.
