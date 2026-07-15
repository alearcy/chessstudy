# FEAT-005B: Commenti educativi tattici affidabili

## Obiettivo

Affiancare ai dati Stockfish un commento deterministico e didattico che spieghi
imprecisioni, errori ed errori gravi con fatti scacchistici verificabili, senza
sovrascrivere il commento utente o il commento Stockfish.

## Decisioni

- Stockfish resta la fonte della classificazione e della migliore alternativa.
- Il badge e il commento Stockfish condividono la stessa classificazione: se la
  mossa coincide con la scelta principale, il commento la descrive come mossa
  migliore e non riporta contemporaneamente un peggioramento o un errore.
- `explainService.ts` rileva pattern geometrici con le API di attacco di
  `chess.js`, esplicitando sempre quale colore crea o subisce la tattica.
- Le spiegazioni confrontano la posizione dopo la mossa giocata con quella dopo
  la migliore mossa prima di affermare che una tattica sarebbe stata evitata.
- `coachDiagnostics.ts` diagnostica tutte le mosse classificate come
  `IMPRECISIONE`, `ERRORE` o `ERRORE GRAVE`; il limite di cinque mosse resta una
  selezione separata, utilizzabile solo da eventuali dossier riepilogativi.
- Il commento educativo viene persistito in `Move.analysisComment`, già
  presente nel modello e nel database, e mostrato come blocco distinto da
  `Move.stockfishComment` e `Move.comment`.

Questa scelta sostituisce la decisione originaria di FEAT-005 di scrivere la
spiegazione automatica in `Move.comment`: quel campo resta proprietà
dell'utente o del PGN importato.

## Comportamento tattico

- Gli attacchi devono essere calcolati indipendentemente dal lato al tratto.
- Dopo una mossa debole si cercano prima le risorse immediate del giocatore che
  deve muovere: matto in una, forchette e pezzi lasciati in presa.
- Inchiodature e infilate devono riportare autore e vittime senza formule come
  "subisci" quando la prospettiva non è dimostrata.
- Un matto già disponibile viene descritto come "matto in una mossa", non come
  semplice minaccia.
- Le transizioni fra valutazioni di matto sono classificate esplicitamente e
  non come variazioni di pochi centipawn artificiali.
- Le euristiche di apertura (Donna, sviluppo, sicurezza del Re) possono essere
  mostrate solo quando la migliore mossa o un fatto concreto supportano quella
  causa; altrimenti la diagnosi resta generica.

## API

- `diagnoseCriticalMoves(moves)` restituisce tutte le diagnosi pertinenti.
- `buildCriticalMoveDiagnostics(moves)` mantiene la selezione massima di cinque
  mosse per compatibilità con i riepiloghi esistenti.
- `explainMoveRuleBased(input)` resta l'API sincrona principale.

## Test

Fixture FEN per:

- forchetta rilevata anche se l'attaccante non è il lato al tratto;
- pezzo lasciato in presa e prospettiva corretta;
- matto in una concesso e peggioramento della distanza dal matto;
- inclusione delle imprecisioni e assenza del limite di cinque nella nuova API;
- separazione fra commento educativo, Stockfish e nota utente.
- coerenza fra badge di mossa migliore e testo del commento Stockfish anche
  quando la variazione numerica fra due analisi suggerirebbe una perdita.

## Verifica

- `npm test`
- `npm run build`
- `git diff --check`
