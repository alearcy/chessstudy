# Migrazioni DB conservative

## Problema

La migrazione Dexie `v6` eliminava le lezioni `analysis` esistenti insieme a
board e mosse correlate. Era una scelta accettata in fase demo, ma ora i dati
utente devono essere trattati come persistenti: le migrazioni non devono
cancellare contenuti senza una conversione lossless o una procedura esplicita
di export/backup.

## Obiettivo

- Rimuovere la cancellazione distruttiva dalla migrazione `v6`.
- Preservare lezioni, board, mosse, commenti, analisi, header PGN e metadati.
- Portare i vecchi contenitori `analysis` cumulativi al modello corrente:
  una lezione `analysis` contiene una sola board.
- Aggiungere una migrazione corrente che normalizzi anche DB gia aggiornati.

## Strategia

La migrazione conservativa divide le lezioni `analysis` multi-board in lezioni
`analysis` separate:

- la prima board resta nella lezione originale;
- ogni board successiva viene spostata in una nuova lezione `analysis`;
- le mosse non vengono copiate o eliminate, perche restano collegate alla
  stessa board tramite `boardId`;
- ogni board spostata riceve `order: 0`, coerente con l'invariante corrente
  delle lezioni analysis a board singola;
- titolo e descrizione della nuova lezione derivano dalla lezione sorgente e
  dalla board spostata.

La stessa normalizzazione viene applicata in:

- `v6`, per utenti che aggiornano da DB pre-esistenti alla vecchia semantica;
- `v10`, per DB gia arrivati a versioni successive o creati durante la fase in
  cui la migrazione distruttiva era presente.

## Fuori scope

- Recupero di dati gia cancellati da una precedente esecuzione della vecchia
  migrazione `v6`: IndexedDB non conserva una copia recuperabile.
- Sistema generale di export/backup UI: questo task rende conservativa la
  migrazione esistente; un export manuale puo essere aggiunto in un task
  dedicato.
- Introduzione di un test runner: il progetto non ne ha ancora uno configurato
  e il task "Aggiungere test minimi" resta separato.

## Definition of done

- `src/db/database.ts` non contiene piu migrazioni distruttive per `analysis`.
- `v6` e `v10` preservano board e mosse spostando solo `lessonId`.
- `TASKS.md` sposta il task in corso secondo il formato del progetto.
- `npm run build` passa.
