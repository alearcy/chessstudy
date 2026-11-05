# Aggiornamento a Stockfish 19

Data: 2026-11-05

## Obiettivo e perimetro

Aggiornare il motore browser da Stockfish.js 18.0.8 a 19.0.1, mantenendo
le build Lite multi-thread e single-thread, la selezione per capacità del
browser, il fallback in caso di errore e l'analisi automatica a profondità 15
con due thread quando supportati. Nessuna modifica ai dati persistiti:
le valutazioni esistenti restano salvate; le nuove analisi usano il nuovo motore.

## Implementazione

- Versione npm esatta e lockfile aggiornati a `stockfish@19.0.1`.
- Worker in `analysisService.ts` e script `sync:stockfish-assets` puntano ai
  file `stockfish-19-lite` e `stockfish-19-lite-single`.
- Quattro asset JS/WASM copiati dal pacchetto npm; rimossi i quattro asset 18.
- Test runtime e distribuzione, PRODUCT.md, AGENTS.md e notice aggiornati.
- Sorgente corrispondente: commit
  `0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6` di
  https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1.

## Verifiche

- RED: due test dei percorsi worker fallivano prima della modifica del servizio.
- `npm run sync:stockfish-assets`: completato; confronto byte per byte dei
  quattro asset pubblici con il pacchetto npm superato.
- Prova UCI via Node delle due build WASM: identificazione Stockfish 19,
  `uciok`, `readyok`, valutazione a profondità 5 e `bestmove`; due thread
  per Lite, uno per Lite single-thread.
- `npm test`: 57 file e 235 test superati.
- `npm run lint`: nessun errore; sei warning in file non modificati.
- `npm run build`: typecheck e build superati; warning sulla dimensione del bundle.
- Interazione nel browser e distribuzione online non eseguite.
