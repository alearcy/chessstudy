# FEAT-008: Analisi Stockfish adattiva

Decisione architetturale: `docs/adr/0005-analisi-stockfish-adattiva.md`.

## Obiettivo

Ottenere analisi affidabili senza applicare il costo della ricerca profonda a
ogni posizione della partita.

## Strategia

1. Analizzare tutte le posizioni con il profilo base configurato. Per una nuova
   installazione il profilo base e `depth 15`, `2 thread`, `MultiPV 1`.
2. Calcolare la perdita della mossa dal punto di vista di chi ha mosso usando
   le due valutazioni adiacenti.
3. Considerare critica una mossa con perdita di almeno 50 centipawn equivalenti
   (imprecisione, errore o errore grave, inclusi i cambi di valutazione a matto).
4. Rianalizzare a profondita `base + 5` (massimo 30) sia la posizione prima sia
   quella dopo ogni mossa critica, deduplicando le posizioni condivise.
5. Sostituire le valutazioni della prima passata con quelle profonde prima di
   classificare, commentare e persistere le mosse.

Il numero di thread resta quello del profilo base: aumentare i thread riduce il
tempo, ma aumenta il carico istantaneo senza migliorare la qualita a profondita
fissa. `MultiPV` resta 1 in entrambe le passate, perche classificazione e
commenti richiedono solo la variante principale.

Se l'utente sceglie un'altra profondita base, il raffinamento usa sempre cinque
ply aggiuntivi, fino al limite backend di 30. Il fallback WASM resta
single-threaded ma applica la stessa strategia di profondita.

## API e integrazione

- `analysisService` espone `analyzePositionsAdaptive`, mantenendo la coda
  esistente per ogni batch e traducendo il progresso in un totale cumulativo.
- Il comando Tauri `analyze_position` accetta `multipv`; il backend lo limita a
  `1..=3` e lo imposta prima di ogni ricerca.
- `LessonDetailPage` usa il risultato adattivo nello stesso flusso di
  persistenza e generazione dei commenti gia esistente.
- Le impostazioni predefinite diventano depth 15 e 2 thread; le preferenze gia
  salvate non vengono sovrascritte. Il selettore CPU include sempre il profilo
  esplicito `2 thread (consigliato)`, oltre a 1 thread, meta CPU e CPU completa.

## Test

- selezione e deduplicazione delle posizioni da approfondire;
- nessun secondo batch se non ci sono mosse critiche;
- merge delle valutazioni profonde negli indici corretti;
- normalizzazione backend di `MultiPV`;
- suite frontend, build e test Rust verdi.
