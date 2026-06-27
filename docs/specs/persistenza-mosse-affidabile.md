# Persistenza mosse affidabile

## Problema

La UI crea mosse in memoria in modo ottimistico e persiste su IndexedDB in
background. Se l'utente gioca piu mosse rapidamente, una mossa successiva puo
essere creata prima che la precedente abbia ottenuto un `id`; in quel caso
`parentId` diventa `null` e stato UI/DB possono divergere in caso di errore.

## Obiettivo

- Serializzare le scritture manuali delle mosse per singola pagina/board.
- Calcolare `parentId` dopo la persistenza della mossa precedente.
- Evitare nuove mosse mentre una scrittura e in corso, se serve a mantenere il
  modello lineare coerente.
- Esporre un errore utente quando la persistenza fallisce.

## Strategia

- Mantenere una mappa in memoria `order -> moveId`, inizializzata quando si
  caricano le mosse della board.
- Accodare ogni operazione di persistenza in una promise chain.
- Per una nuova mossa:
  - troncare dal DB le mosse future (`order >= newMoveIndex`);
  - rimuovere dalla mappa gli id troncati;
  - leggere il `parentId` dalla mappa aggiornata (`newMoveIndex - 1`);
  - creare la mossa;
  - aggiornare placeholder UI con l'id persistito.
- Bloccare ulteriori drop finche la coda non torna vuota.
- In caso di errore, mostrare messaggio in pagina e ricaricare la board dal DB.

## Verifica

- `npm run build`
- Controllo manuale: mosse rapide non producono `parentId` mancanti per il path
  lineare persistito.
