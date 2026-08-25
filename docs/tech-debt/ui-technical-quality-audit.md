# TD-003: Qualità tecnica dell'interfaccia

**Status:** Open
**Priority:** High
**Area:** Frontend / Accessibility / Performance
**Created:** 2026-08-25
**Source:** `$impeccable audit` (14/20)

## Problema

L'interfaccia è coerente con `PRODUCT.md` e `DESIGN.md`, ma l'audit tecnico ha
individuato lacune di accessibilità, adattamento touch, gestione del movimento
e caricamento iniziale. Il problema più grave riguarda la scacchiera, che non
espone un flusso equivalente per tastiera o screen reader e impedisce quindi a
questi utenti di completare il compito principale.

L'audit è stato eseguito sul worktree del 2026-08-25. Il detector Impeccable non
ha rilevato anti-pattern deterministici e l'integrità del sistema visivo è
risultata coerente e specifica per Chessstudy.

## Rilievi aperti

| Priorità | Rilievo | Evidenza | Standard / soglia |
| --- | --- | --- | --- |
| P0 | Scacchiera non operabile da tastiera o screen reader | `src/components/board/ChessBoard.tsx` configura selezione, drag e pointer senza semantica o input da tastiera equivalenti | WCAG 2.1.1, 4.1.2 |
| P1 | Controlli senza nome accessibile | Input file e textarea PGN in `ImportPgnDialog`; textarea note scacchiera e nota mossa in `LessonDetailPage` | WCAG 1.3.1, 3.3.2, 4.1.2 |
| P1 | Errori asincroni non annunciati | `ErrorNotice` non usa `role="alert"` o una live region, pur essendo condiviso da 19 superfici | WCAG 4.1.3 |
| P1 | Contrasto insufficiente dei messaggi di successo | `text-emerald-700` sul tema scuro in `FirstPasswordPage` e `ChangePasswordDialog`; rapporto calcolato 2,17:1 | WCAG 1.4.3, minimo 4,5:1 |
| P2 | Target touch troppo piccoli | La variante `icon-xs` misura 24x24 px ed è usata almeno 17 volte, anche su tablet | Obiettivo 44x44 px su `pointer: coarse` |
| P2 | Copertura incompleta di `prefers-reduced-motion` | Solo il guard di orientamento disabilita esplicitamente l'animazione; spinner, dialoghi, menu e transizioni restano attivi | Alternativa intenzionale per movimento ridotto |
| P2 | Bundle iniziale oltre la soglia Vite | Bundle principale 835,78 kB minificati, 255,16 kB gzip; route e dialoghi sono importati eager da `App.tsx` | Warning Vite oltre 500 kB |

## Workaround corrente

- La scacchiera resta utilizzabile tramite mouse o touch; le frecce sinistra e
  destra permettono soltanto di navigare la cronologia.
- Placeholder e contesto visivo rendono comprensibili i campi senza etichetta
  agli utenti vedenti, ma non forniscono un nome accessibile affidabile.
- Errori e conferme sono visibili, ma la loro comunicazione dipende dalla vista
  e dal contrasto disponibile.
- I controlli compatti rispettano la densità desktop del design system, ma non
  aumentano l'area interattiva sui dispositivi touch.
- Stockfish è già distribuito come asset separato; il debito sul bundle riguarda
  il codice applicativo caricato prima che le relative route o finestre siano
  richieste.

## Impatto

- Gli utenti che usano tastiera o screen reader non possono creare e modificare
  una sequenza di mosse in modo equivalente.
- Errori, conferme e campi possono non essere identificati o annunciati dalle
  tecnologie assistive.
- Su tablet aumenta il rischio di attivare azioni adiacenti per errore.
- Il movimento non essenziale può restare attivo nonostante la preferenza di
  sistema.
- Il caricamento iniziale trasferisce e interpreta codice non necessario alla
  prima schermata.

## Piano di risoluzione

1. Definire un'interazione accessibile della scacchiera: selezione da tastiera
   di origine e destinazione con annunci di coordinata, pezzo, colore e stato,
   oppure un input SAN equivalente pienamente accessibile.
2. Associare etichette e descrizioni programmatiche ai quattro controlli senza
   nome accessibile.
3. Rendere `ErrorNotice` una live region appropriata e gestire il focus per gli
   errori che bloccano il flusso.
4. Portare i messaggi di successo a contrasto AA usando i token semantici del
   tema scuro; `DatabaseBackupDialog` è il riferimento già corretto.
5. Mantenere la densità desktop e aumentare a circa 44 px l'area interattiva dei
   controlli compatti quando `pointer: coarse`.
6. Aggiungere alternative `motion-reduce` a spinner e transizioni, preservando
   testo di stato e `aria-busy`.
7. Introdurre lazy loading per route private e dialoghi non necessari alla prima
   schermata, misurando nuovamente il bundle.
8. Eseguire `$impeccable polish` e ripetere `$impeccable audit` dopo le
   correzioni.

## Criteri di risoluzione

- Le mosse possono essere inserite e navigate senza dispositivo di puntamento;
  posizione e selezione della scacchiera sono comprensibili con screen reader.
- Tutti i controlli di form hanno un nome accessibile verificabile.
- Errori e conferme dinamiche sono annunciati una sola volta e non producono
  spostamenti di focus inattesi.
- Il contrasto del testo normale è almeno 4,5:1 nel tema scuro.
- I target principali raggiungono circa 44x44 px sui dispositivi touch senza
  perdere la densità prevista su desktop.
- Con `prefers-reduced-motion: reduce` non restano animazioni non essenziali.
- Il bundle iniziale non genera il warning Vite da 500 kB, oppure l'eventuale
  eccezione è misurata e documentata.
- Detector Impeccable, test, lint e build passano.
- Una verifica renderizzata copre almeno login, archivio, studio e analisi alle
  viewport desktop e tablet landscape.

## Verifica di partenza

- `npm run build`: passato; warning bundle principale da 835,78 kB.
- `npm test`: 57 file e 235 test passati.
- `npm run lint`: nessun errore e 6 warning React Hooks, non classificati come
  difetti utente senza una riproduzione concreta.
- Detector Impeccable statico: nessun rilievo deterministico.
- Verifica renderizzata: aperta; nessun browser connesso e scansione URL non
  disponibile senza Puppeteer.

## File correlati

- `src/components/board/ChessBoard.tsx`
- `src/components/board/ImportPgnDialog.tsx`
- `src/components/ErrorNotice.tsx`
- `src/components/ui/button.tsx`
- `src/pages/LessonDetailPage.tsx`
- `src/pages/FirstPasswordPage.tsx`
- `src/components/ChangePasswordDialog.tsx`
- `src/App.tsx`
- `src/index.css`
- `DESIGN.md`
- `PRODUCT.md`
