# FEAT-012: Duplicazione scacchiere nello Studio

## Obiettivo

Permettere di riutilizzare una linea di mosse già preparata senza doverla
ripetere manualmente quando una nuova scacchiera parte dalla stessa sequenza.

## Esperienza utente

- Ogni elemento della sidebar `Scacchiere` in modalità Studio espone un'azione
  `Duplica scacchiera` accanto a rinomina ed elimina.
- L'azione usa un'icona esplicita perché sia visibile, raggiungibile da tastiera
  e utilizzabile anche su touch. Il solo menu contestuale non è sufficiente.
- Durante la duplicazione l'azione della scacchiera interessata è disabilitata
  e mostra uno stato in corso.
- La copia viene aggiunta in fondo alla lista, usa il titolo
  `<titolo originale> (copia)` e viene selezionata al termine.
- Gli errori restano visibili nella pagina tramite il feedback già usato dalle
  altre azioni sulle scacchiere.

## Dati copiati

La copia mantiene il contenuto completo della scacchiera:

- posizione iniziale, note, frecce ed evidenziazioni;
- metadati PGN, apertura ed eventuali valutazioni già persistite;
- tutte le mosse in ordine, inclusi commenti, annotazioni, tattiche e
  valutazioni;
- relazioni `parentId` rimappate sui nuovi ID delle mosse.

Non vengono riutilizzati ID, UID o timestamp della sorgente.

## Persistenza

- Una funzione Supabase `duplicate_study_board(p_source_board_id)` esegue la
  copia in una singola transazione e restituisce l'ID della nuova scacchiera.
- La funzione è `security invoker`, verifica utente proprietario e modalità
  `study`, genera nuovi UUID e conserva le policy RLS esistenti.
- Il frontend invoca la RPC attraverso `boardService`, poi ricarica la lista e
  seleziona l'ID restituito.

## Strategia di test

- Test del service per nome RPC, argomenti, valore restituito ed errore.
- Test del componente sidebar per accessibilità, propagazione del click e stato
  occupato.
- Test statico della migrazione per sicurezza e copertura dei campi copiati.
- Verifica finale con test, lint e build.

## Fuori ambito

- Menu contestuale con tasto destro sulla scacchiera.
- Duplicazione tra studi diversi.
- Riordinamento manuale delle scacchiere.
