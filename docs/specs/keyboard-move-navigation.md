# Navigazione mosse con tastiera

## Task
Nelle modalita `analysis` e `study`, le frecce destra e sinistra della tastiera
spostano la posizione rispettivamente avanti e indietro nella linea mosse della
scacchiera selezionata.

## Comportamento
- `ArrowRight` avanza di una mossa, come il comando redo della toolbar.
- `ArrowLeft` arretra di una mossa, come il comando undo della toolbar.
- I limiti sono quelli gia esposti da `useChessBoard`: nessuna azione prima
  della posizione iniziale o dopo l'ultima mossa.
- Le shortcut sono attive sia nel layout analysis sia nel layout study.
- Le shortcut non intercettano input testuali, textarea, select o elementi
  `contentEditable`, cosi le note restano editabili senza navigazione
  accidentale.
- Le shortcut ignorano eventi con `Alt`, `Ctrl`, `Meta` o `Shift`, lasciando
  libere combinazioni di sistema/browser.

## Approccio tecnico
`LessonDetailPage` registra un listener `keydown` su `window` e richiama
`chess.undo()` / `chess.redo()`. La navigazione usa quindi lo stesso stato e gli
stessi side effect gia esistenti per toolbar e pannello notazione:

- `historyIndex` cambia tramite `goToMove`.
- `fen`, commento corrente, badge, frecce analisi e highlight ultima mossa si
  aggiornano per derivazione dallo stato esistente.
- Non vengono aggiunti campi al modello dati e non servono migrazioni Dexie.

## File modificati
- `src/pages/LessonDetailPage.tsx`
- `TASKS.md`
