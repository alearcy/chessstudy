# Coda Stockfish e concorrenza analisi

## Obiettivo
Rendere sicura la gestione di richieste di analisi Stockfish concorrenti.
Il fallback WASM usa un solo worker e un solo listener UCI mutabile: due
analisi sovrapposte possono sovrascriversi il listener e lasciare promise
appese o risultati associati alla richiesta sbagliata.

## Scope
- Serializzare tutte le chiamate pubbliche a `analyzePositions`.
- Mantenere invariata l'API TypeScript esistente.
- Non modificare UI e persistenza salvo emergano bug direttamente collegati.
- Non introdurre un nuovo test framework in questo task.

## Design

### Coda applicativa
`analysisService.ts` mantiene una coda FIFO module-level. Ogni chiamata a
`analyzePositions(fens, options)` crea un job e lo accoda. Un solo job alla
volta viene eseguito; al completamento, errore o cancellazione cooperativa
parte il job successivo.

La serializzazione vale per entrambi i path:
- Tauri nativo: già protetto dal mutex Rust, ma la coda frontend evita
  progress/cancellazioni sovrapposte e mantiene comportamento uniforme.
- Browser WASM: protegge il worker singleton e il listener UCI condiviso.

### Esecuzione interna
La funzione pubblica `analyzePositions` diventa un wrapper di enqueue.
L'esecuzione reale viene spostata in una funzione interna che seleziona:
- `analyzePositionsNative`
- `analyzePositionsWasm`

### Cancellazione
Il segnale esistente `{ cancelled: boolean }` resta cooperativo:
- se un job e gia in esecuzione, si ferma prima della prossima posizione;
- se un job e ancora in coda, quando arriva il suo turno restituisce una lista
  vuota senza iniziare Stockfish;
- in ogni caso la coda viene sbloccata nel `finally`.

## File
- `src/services/analysisService.ts`
- `docs/specs/stockfish-analysis-queue.md`
- `TASKS.md`

## Definition of done
- Due chiamate contemporanee a `analyzePositions` vengono eseguite in ordine,
  non in parallelo.
- Il listener del worker WASM non puo essere sovrascritto da una seconda
  analisi.
- `npm run build` passa.
