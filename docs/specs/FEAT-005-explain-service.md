# FEAT-005: Servizio spiegazione mosse in linguaggio naturale (locale)

**Data:** 2026-06-22
**Stato:** In progress

## Obiettivo

Generare spiegazioni in **italiano**, offline e senza LLM, che descrivano
perché una mossa è buona o cattiva, cosa Stockfish avrebbe giocato, e quali
pattern tattici sono rilevanti nella posizione. Il servizio si basa su:

- **chess.js**: detection tattica sulla posizione (fork, pin, skewer, hanging
  pieces, mate threats, etc.)
- **eval Stockfish** già persistito: `evalCp`, `evalMate`, `bestMoveUci`
- **Template system**: mappa pattern + severità → frasi italiane pre-costruite

## API pubblica

### `explainMove(input: MoveExplanationInput): MoveExplanation`

```typescript
interface MoveExplanationInput {
  /** FEN della posizione prima della mossa (dove Stockfish valuta). */
  beforeFen: string;
  /** Mossa giocata in notazione SAN (es. "Nf6"). */
  playedMoveSan: string;
  /** Chi ha giocato la mossa. */
  playedBy: 'w' | 'b';
  /** Eval della posizione PRIMA della mossa (POV Bianco).
   *  `bestMoveUci` è la miglior mossa da questa posizione. */
  beforeEval: { cp: number | null; mate: number | null; depth: number; bestMoveUci: string | null };
  /** Eval della posizione DOPO la mossa (POV Bianco). */
  afterEval: { cp: number | null; mate: number | null; depth: number };
}

interface MoveExplanation {
  /** Frase riassuntiva (1-2 righe). */
  summary: string;
  /** Dettagli a punti elenco. */
  details: string[];
  /** Severità: 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'. */
  severity: Severity;
  /** Pattern tattici rilevati nella posizione DOPO la mossa. */
  tactics: TacticalPattern[];
  /** Perché Stockfish preferisce la best move (null se è la stessa). */
  stockfishExplains: string | null;
}

type Severity = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
```

Severity deriva dal `cpLoss` (POV del giocatore che ha mosso):
- `cpLoss <= 10`: `'best'`
- `cpLoss <= 50`: `'good'`
- `cpLoss <= 100`: `'inaccuracy'`
- `cpLoss <= 200`: `'mistake'`
- `cpLoss > 200`: `'blunder'`

### `detectTactics(fen: string): TacticalPattern[]`

Utilità pubblica riutilizzabile per detection tattica generica su una
posizione FEN, senza bisogno di eval Stockfish.

## Detection tattica

Tutte le funzioni operano su un'istanza `chess.js` caricata con il FEN dato.
Nessuna dipendenza esterna oltre a `chess.js`.

| Funzione | Pattern | Algoritmo |
|---|---|---|
| `detectHangingPieces()` | Pezzo indifeso | Per ogni pezzo del giocatore che NON ha appena mosso: se è attaccato e non ha difensori → hanging. Ordina per valore decrescente. |
| `detectForks()` | Forchetta | Per ogni pezzo di chi ha mosso: calcola `attackedPieces`. Se ≥2 pezzi avversari attaccati, di cui almeno 1 di valore ≥ al pezzo attaccante → fork. |
| `detectAbsolutePins()` | Inchiodatura assoluta | Per ogni pezzo avversario su linea di alfiere/torre/donna vs Re: se rimuovendo il pezzo il Re sarebbe sotto scacco → pin assoluto. |
| `detectRelativePins()` | Inchiodatura relativa | Come sopra ma il pezzo dietro NON è il Re. |
| `detectSkewers()` | Infilata | Per ogni pezzo avversario su linea vs pezzo di valore MINORE dietro → skewer. |
| `detectDiscoveredAttack()` | Attacco di scoperta | Simula la mossa: se rimuovendo il pezzo mosso si sblocca un attacco di un altro pezzo (alfiere/torre/donna) su un pezzo avversario. |
| `detectMateThreats()` | Minaccia matto | Controlla se esiste una mossa dell'avversario che dà scacco matto. |
| `detectTrappedPiece()` | Pezzo intrappolato | Per ogni pezzo: tutte le case di fuga sono attaccate o occupate da pezzi amici. |
| `detectDoubleCheck()` | Scacco doppio | Semplicemente `chess.isCheck()` && due pezzi danno scacco. |

### Struttura `TacticalPattern`

```typescript
interface TacticalPattern {
  type: 'fork' | 'pin_absolute' | 'pin_relative' | 'skewer' |
        'discovered_attack' | 'double_check' | 'mate_threat' |
        'hanging_piece' | 'trapped_piece';
  /** Pezzo che esegue il pattern (es. "♞") */
  actor: string;
  /** Pezzo(i) che subiscono il pattern */
  victims: string[];
  /** Case coinvolte */
  squares: string[];
  /** Descrizione breve in italiano */
  description: string;
}
```

## Analisi del blunder

### `analyzeWhyBad()`

Confronta la mossa giocata con la best move Stockfish:

1. Simula la mossa giocata su `beforeFen` → `afterPlayedFen`
2. Simula la best move UCI su `beforeFen` → `afterBestFen`
3. Confronta materiale tra le due posizioni
4. Se differenza materiale > 0, spiega cosa si perde
5. Rileva tattiche nella posizione dopo la best move (cosa avresti ottenuto)
6. Rileva tattiche nella posizione dopo la mossa giocata (cosa subisci)

### `analyzeWhyGood()`

Se la mossa giocata è la best move o molto vicina:

1. Rileva tattiche create dalla mossa
2. Descrivi il miglioramento posizionale (controllo centro, sviluppo, etc.)
3. Se la mossa è esattamente la best move: lodala

## Template system

I template sono funzioni pure che generano stringhe italiane. **Niente
concatenazione brutta**: ogni template è una funzione che prende parametri
contestuali e restituisce una frase completa in italiano corretto.

### Template per severità

```
blunder:  "Grave errore. {spiegazione_materiale} {tattica_subita}."
mistake:  "Errore tattico. {cosa_si_perde} Stockfish suggeriva {best}."
inaccuracy: "Imprecisione. {posizionale} La mossa migliore era {best}."
good:     "Buona mossa. {cosa_si_ottiene}"
best:     "Mossa eccellente! {perché_è_la_migliore}"
```

### Template per pattern tattici

```
fork:        "{attore} fa una forchetta: minaccia simultaneamente {vittime}."
pin_absolute:"{attore} inchioda {vittima} contro il Re — non può muoversi."
pin_relative:"{attore} inchioda {vittima} contro {pezzo_dietro}."
skewer:      "Infilata: {attore} attacca {pezzo1} che, muovendosi, lascia {pezzo2}."
hanging:     "{pezzo} è indifeso e può essere catturato."
mate_threat: "Minaccia di matto in 1."
trapped:     "{pezzo} è intrappolato: nessuna casa sicura."
discovered:  "Attacco di scoperta: muovendo {attore}, {pezzo_dietro} attacca {vittima}."
```

## Integrazione UI

### Dove

Nella `LessonDetailPage`, dopo l'analisi Stockfish (`handleAnalyze`), per ogni
mossa analizzata si chiama `explainMove()` e il risultato viene salvato nel
campo `comment` del Move (o in un campo separato `explanation`?).

**Decisione**: usiamo il campo `comment` esistente per evitare schema migration.
La spiegazione generata viene proposta come testo pre-compilato nell'editor del
commento, che l'utente può modificare liberamente.

### Flusso

```
handleAnalyze()
  → analyzePositions(fens)  // già esistente
  → persiste eval su Board + Move  // già esistente
  → per ogni mossa i:
      explainMove({
        beforeFen: i==0 ? startFen : moves[i-1].fen,
        playedMoveSan: moves[i].moveNotation,
        playedBy: i%2===0 ? 'w' : 'b',
        beforeEval: { ... } da Board/Move[i-1],
        afterEval: { ... } da Move[i]
      })
      → updateMove(id, { comment: explanation.summary + "\n\n" + details })
```

### UI opzionale (per futuro FEAT)

Un toggle "Genera spiegazione automatica" che, quando attivo, pre-compila
il commento di ogni mossa analizzata con la spiegazione generata.

## Non-goal

- **NON** usiamo LLM (locale o cloud) — solo template rule-based
- **NON** generiamo spiegazioni per mosse non analizzate da Stockfish
- **NON** modifichiamo lo schema DB (nessuna nuova colonna)
- **NON** facciamo analisi posizionale profonda (strutture pedonali, piani a
  lungo termine, ecc.) — solo tattica concreta

## File

| File | Azione |
|---|---|
| `src/services/explainService.ts` | **Nuovo** — tutto il motore |
| `src/pages/LessonDetailPage.tsx` | Modifica: chiama `explainMove` dopo `handleAnalyze` |
