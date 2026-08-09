# FEAT-015 Ricerca homepage per prefisso

## Obiettivo

Permettere di trovare studi e analisi anche digitando soltanto l'inizio di una
parola, per esempio `ippo` per un contenuto che include `ippopotamo`, senza
scaricare l'archivio nel browser.

## Comportamento

- Ogni parola digitata viene normalizzata come nella ricerca attuale.
- Ogni termine normalizzato viene cercato come prefisso di un lessema
  PostgreSQL (`termine:*`).
- Con più termini, tutti i prefissi devono essere presenti, anche in campi
  diversi del testo indicizzato.
- Ricerca vuota, filtri, ordinamento, conteggio e paginazione mantengono il
  comportamento esistente.

## Implementazione

Il repository continua a interrogare `lessons.search_text` tramite Supabase e
l'indice GIN già presente su `to_tsvector('simple', search_text)`. La query
passa dalla modalità `websearch`, che accetta soltanto parole complete, alla
sintassi nativa di `to_tsquery`, componendo esclusivamente termini già
normalizzati in forma `termine:*` e collegandoli con `&`.

Non sono richieste migrazioni, RPC o modifiche RLS.

## Verifica

- Test repository per un prefisso singolo (`ippo`).
- Test repository per più termini normalizzati e collegati con AND.
- Suite Vitest, lint e build.

## Criteri di accettazione

- Cercando `ippo` compare un contenuto indicizzato con la parola
  `ippopotamo`.
- La parola completa continua a produrre risultati.
- Più parole restringono i risultati come prima.
- I caratteri non alfanumerici non possono alterare la sintassi della query.
