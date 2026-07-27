# FEAT-013: Riordino scacchiere nello Studio

## Obiettivo

Permettere di cambiare l'ordine delle scacchiere nella colonna sinistra di uno
Studio senza modificare il contenuto o la scacchiera selezionata.

## Esperienza utente

- Ogni riga mostra un'icona `GripVertical` a sinistra del titolo.
- Il trascinamento parte soltanto dall'icona, così il titolo continua a
  selezionare la scacchiera e le azioni esistenti restano indipendenti.
- Il riordino usa Pointer Events e funziona con mouse, penna e touch.
- Durante il trascinamento la lista mostra subito l'ordine di destinazione e la
  riga trascinata mantiene uno stato visivo riconoscibile.
- Il touch non avvia lo scroll della pagina quando il gesto parte dall'handle.
- L'handle è raggiungibile da tastiera: `Freccia su` e `Freccia giù` spostano
  la scacchiera di una posizione.
- Durante il salvataggio non può iniziare un secondo riordino.
- In caso di errore la lista torna all'ordine persistito e viene mostrato il
  feedback visibile già usato dalle altre azioni.

## Persistenza

- `boardService.reorderStudyBoards(lessonId, boardIds)` invoca una sola RPC
  Supabase `reorder_study_boards`.
- La funzione è `security invoker`, limitata al ruolo `authenticated`, verifica
  proprietario e modalità `study`.
- L'elenco degli ID deve essere privo di duplicati e coincidere esattamente con
  tutte le scacchiere della lezione.
- Le righe vengono bloccate in ordine stabile e aggiornate nella stessa
  transazione.
- Per rispettare il vincolo univoco `(lesson_id, board_order)`, i valori
  esistenti vengono prima spostati in un intervallo temporaneo e poi assegnati
  alle posizioni finali zero-based.

## Strategia di test

- Test puro del riordino e normalizzazione del campo `order`.
- Test della sidebar per trascinamento mouse, trascinamento touch, handle
  accessibile e spostamento da tastiera.
- Test del service per nome RPC, argomenti ed errore.
- Test statico della migrazione per autorizzazione, validazione completa degli
  ID, locking e aggiornamento in due fasi.
- Verifica finale con suite test, lint, build e controllo del diff.

## Fuori ambito

- Riordino delle lezioni nella homepage.
- Spostamento di una scacchiera tra studi diversi.
- Layout smartphone dedicato della sidebar.
