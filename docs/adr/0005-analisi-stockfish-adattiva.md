# ADR-0005: Analisi Stockfish adattiva

- **Data:** 2026-07-12
- **Stato:** Accepted

## Contesto

L'analisi di una partita completa applicava lo stesso livello di ricerca a
tutte le posizioni. Una profondita elevata migliora l'affidabilita nelle
posizioni tattiche, ma aumenta sensibilmente durata, utilizzo della CPU,
consumi e temperatura anche nelle posizioni semplici.

L'app deve offrire analisi soddisfacenti su dispositivi desktop diversi senza
usare automaticamente tutte le risorse disponibili. Deve inoltre preservare:

- la coda sequenziale di `analysisService`;
- il backend Stockfish nativo e il fallback WASM single-threaded;
- le preferenze Stockfish gia salvate;
- il flusso di classificazione, commento e persistenza delle mosse.

Il profilo iniziale per una nuova installazione deve essere conservativo:
profondita 15, 2 thread e una sola variante principale. Le risorse aggiuntive
devono essere dedicate alle posizioni che possono cambiare il giudizio sulla
partita.

## Considered options

| Opzione | Tradeoff principale |
|---|---|
| Analisi fissa a profondita 15 | Impatto moderato e durata prevedibile, ma valutazioni meno stabili nelle posizioni critiche. |
| Analisi fissa a profondita 20 | Maggiore affidabilita generale, ma costo elevato anche nelle posizioni semplici. |
| Analisi adattiva in due passate | Concentra il costo sulle mosse critiche, introducendo un secondo batch e un progresso dinamico. |
| Analisi adattiva aumentando anche thread o MultiPV | Puo ridurre il tempo o mostrare alternative, ma aumenta il carico senza essere necessario per classificare la mossa. |

## Decision

Adottare un'analisi Stockfish adattiva in due passate.

La prima passata analizza tutte le posizioni usando il profilo configurato
dall'utente. Per una nuova installazione i valori predefiniti sono:

- profondita 15;
- 2 thread;
- `MultiPV 1`.

Le preferenze gia salvate non vengono sovrascritte. Il selettore CPU rende
sempre disponibile il profilo `2 thread (consigliato)`.

Dopo la prima passata, l'app calcola la perdita di ogni mossa dal punto di vista
del giocatore che l'ha eseguita. Una mossa e critica quando la perdita e di
almeno 50 centipawn equivalenti, compresi i cambi di valutazione che coinvolgono
un matto.

Per ogni mossa critica vengono rianalizzate la posizione precedente e quella
successiva. Le posizioni condivise vengono deduplicate. La seconda passata usa
la profondita base configurata piu 5, con limite massimo 30.

Thread e `MultiPV` non aumentano nella seconda passata: mantenere gli stessi
thread evita picchi di carico, mentre `MultiPV 1` e sufficiente per valutazione,
classificazione e commenti. Le valutazioni profonde sostituiscono quelle della
prima passata prima della persistenza.

Il fallback WASM applica la stessa strategia di profondita e `MultiPV`, ma resta
single-threaded.

## Consequences

### Positive

- La maggior parte delle posizioni mantiene il costo moderato della profondita
  base.
- Le posizioni vicine a imprecisioni, errori ed errori gravi ricevono una
  valutazione piu stabile.
- Il default di 2 thread limita l'impatto su CPU, temperatura e batteria.
- `MultiPV 1` riduce il lavoro rispetto alla ricerca di piu varianti.
- Le impostazioni dell'utente continuano a determinare la profondita base.
- La strategia resta uniforme tra backend nativo e fallback WASM.
- La deduplicazione evita ricerche profonde ripetute per mosse adiacenti.

### Negative

- Le partite con molte mosse critiche richiedono piu tempo e hanno una durata
  meno prevedibile.
- La selezione dipende dalla prima passata: una valutazione superficiale errata
  puo produrre falsi negativi.
- Il totale del progresso e noto soltanto dopo la prima passata.
- `MultiPV 1` non fornisce alternative multiple; un futuro confronto tra linee
  richiedera un flusso separato.
- Il secondo batch aumenta la complessita di cancellazione e merge.

## Related specs / tasks

- FEAT-008 in `TASKS.md`
- `docs/specs/stockfish-adaptive-analysis.md`
- `docs/specs/stockfish-cross-platform-settings.md`
- `docs/specs/stockfish-analysis-queue.md`
- `docs/specs/TAURI-002-native-stockfish.md`
- ADR-0001: Stockfish 18 in browser
- ADR-0002: Conversione a Tauri con Stockfish 18 nativo

## Open questions

Nessuna al momento.
