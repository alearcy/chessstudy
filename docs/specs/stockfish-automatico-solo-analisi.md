# UI-009: Stockfish automatico e analisi solo in modalita Analisi

## Obiettivo

Semplificare l'esperienza Stockfish eliminando le opzioni tecniche dal profilo
utente e separare nettamente le modalita: una scacchiera di Studio serve a
costruire e annotare contenuti, mentre l'esecuzione del motore e disponibile
soltanto in una lezione di Analisi.

## Comportamento

- Stockfish usa sempre il profilo base automatico `depth 15`, `2 thread` e
  `MultiPV 1`.
- Tutte le posizioni vengono analizzate una sola volta a `depth 15`: non viene
  eseguito un secondo batch a depth 20 sulle posizioni critiche, per mantenere
  tempi prevedibili anche sui computer meno potenti.
- Il rilevamento locale di forchette, inchiodature, infilate e altri pattern
  tattici continua a usare il FEN risultante tramite `chess.js` e non richiede
  una seconda passata Stockfish.
- Il runtime multi-thread limita i thread alle capacita dichiarate dal browser;
  se `SharedArrayBuffer` o l'isolamento cross-origin non sono disponibili, il
  runtime single-thread forza automaticamente un thread.
- Se il worker multi-thread supera l'avvio ma cade durante l'analisi, il batch
  viene ripetuto automaticamente con il worker single-thread e l'istanza
  guasta non viene riutilizzata dai tentativi successivi.
- Le impostazioni mostrano soltanto gli account Lichess e Chess.com; profondita,
  CPU e stato tecnico del runtime non sono configurabili dall'utente.
- Il pulsante Stockfish, il relativo annullamento e gli errori con retry sono
  disponibili soltanto nelle lezioni in modalita `analysis`.
- Le lezioni in modalita `study` non passano handler di analisi alla scacchiera
  e il servizio rifiuta anche eventuali invocazioni UI residue.
- La conversione da Analisi a Studio copia soltanto la struttura minima della
  lezione/scacchiera e la sequenza delle mosse (`move_notation`, FEN e ordine).
  Note, commenti, suggerimenti Stockfish, spunti didattici, annotazioni,
  valutazioni, best move, report apertura e analisi partita ripartono dai
  default vuoti dello Studio.

## Persistenza e compatibilita

Le colonne `user_settings.stockfish_depth` e `stockfish_threads` restano nello
schema con i default esistenti per non richiedere una migrazione distruttiva e
per mantenere compatibili backup e tipi generati. Il frontend non le legge e
non le aggiorna piu; eventuali valori salvati in precedenza vengono ignorati.

## Verifica

- test del componente scacchiera: controllo Stockfish presente in Analisi e
  assente in Studio;
- test impostazioni: nessun controllo Stockfish e salvataggio dei soli account;
- test servizio: singola passata con profilo automatico e fallback
  single-thread;
- test RPC: la conversione non copia alcun campo di analisi o annotazione;
- suite mirate, lint e build.
