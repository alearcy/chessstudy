# Refactor analisi scacchistica: coach concreto, veloce e non vago

## Contesto tecnico

Applicazione attuale:

- Frontend: React
- Desktop runtime: Tauri
- Backend/comandi: Rust
- Libreria scacchistica: `chess.js`
- Motore: Stockfish 18
- LLM locale: Qwen3-4B-Q4_K_M via `llama.cpp`

Obiettivo del refactor:

1. Ridurre drasticamente il prompt inviato a Qwen.
2. Evitare spiegazioni generiche tipo “hai indebolito la posizione”.
3. Spostare l’intelligenza scacchistica dal prompt al codice.
4. Usare Qwen come narratore/coach, non come motore di analisi.
5. Generare spiegazioni concrete, brevi, adatte a un principiante.
6. Mantenere output JSON compatibile con la struttura attuale: `panoramica`, `giudizio`, `momentiChiave`.

---

## Principio guida

Il flusso corretto non deve essere:

```text
PGN + FEN + commenti Stockfish → LLM → spiegazione
```

Deve diventare:

```text
PGN
  ↓
chess.js estrae feature concrete
  ↓
Stockfish 18 valuta e suggerisce best move / best reply / PV
  ↓
classificatore deterministico genera diagnosis + facts
  ↓
Qwen trasforma facts in spiegazione breve
```

Qwen non deve “capire” la posizione partendo dalla FEN. Qwen deve ricevere una diagnosi già pronta e trasformarla in italiano semplice.

---

## Problema attuale

Il flusso attuale passa al backend tutte le mosse della partita, ma nel prompt finale vengono incluse solo le mosse critiche. Ogni mossa critica contiene:

- index
- moveNumber
- player
- SAN italiana
- classification
- evalBefore
- evalAfter
- bestSan
- mossa precedente
- mossa successiva
- FEN prima
- FEN dopo
- contesto locale
- nota Stockfish

In fondo viene ancora passato anche un PGN compatto dell’intera partita.

Questo è meglio di un dump completo, ma ha ancora problemi:

1. Le FEN sono quasi rumore per un modello piccolo come Qwen3-4B.
2. Il PGN completo distrae e aumenta il contesto.
3. Il modello non riceve il motivo concreto dell’errore.
4. `stockfishComment` spesso non basta a produrre coaching didattico.
5. Qwen è costretto a fare sia analisi scacchistica sia scrittura.

Il risultato è che tende a produrre frasi vaghe.

---

## Obiettivo architetturale

Creare un livello intermedio chiamabile, per esempio:

```text
analysis-diagnostics
```

oppure:

```text
coach-diagnostics
```

che trasformi ogni mossa critica in un oggetto:

```ts
type Diagnosis = {
  type:
    | "missed_mate_in_one"
    | "allowed_mate_in_one"
    | "missed_high_value_capture"
    | "queen_tempo_loss"
    | "development_problem"
    | "king_safety"
    | "generic_eval_loss";

  confidence: number;
  facts: string[];
  principle: string;
  mustMention: string[];
};
```

Il campo più importante è `facts`.

Un fact deve essere concreto e verificabile dal codice.

Buoni facts:

```text
La mossa giocata muove la Donna da d1 a h5.
La Donna è stata mossa 2 volte nelle prime 9 mosse.
Sono ancora non sviluppati: Cavallo b1, Alfiere c1.
Stockfish preferiva Cf3.
La risposta consigliata per l'avversario è Cf6.
La valutazione peggiora di circa 210 centipawn.
```

Facts da evitare:

```text
Hai indebolito la posizione.
Hai perso iniziativa.
La mossa non è precisa.
Il Nero sta meglio.
```

---

## Modifiche richieste al flusso LLM

### 1. Rimuovere il PGN compatto dal prompt principale

Il prompt per Qwen non deve più includere il PGN completo della partita.

Il PGN può rimanere disponibile internamente per debug o per altre funzioni, ma non deve essere passato al modello nella chiamata principale di coaching.

Motivo:

- aumenta il contesto;
- distrae il modello;
- spinge Qwen a tentare un’analisi globale che non è in grado di fare bene e rapidamente.

---

### 2. Rimuovere FEN dal prompt LLM, salvo debug

`fenBefore` e `fenAfter` devono essere usate dal codice, non dall’LLM.

Nel prompt finale non includere:

```json
"fenBefore": "...",
"fenAfter": "..."
```

Eventualmente mantenere un flag interno:

```ts
includeFenInPromptForDebug: boolean
```

Default: `false`.

Motivo:

- Qwen3-4B non “vede” la scacchiera da una FEN in modo affidabile;
- una FEN consuma token;
- la FEN non dice esplicitamente il motivo didattico dell’errore.

---

### 3. Limitare il numero di mosse critiche

Non inviare tutte le mosse classificate come imprecisione/errore/errore grave.

Implementare:

```ts
const MAX_CRITICAL_MOVES_FOR_LLM = 5;
```

Criterio consigliato:

1. ordinare per peggior `evalDropCp`;
2. mantenere massimo 5 mosse;
3. preferibilmente evitare duplicati concettuali se più mosse hanno lo stesso `diagnosis.type`.

Versione MVP:

```ts
criticalMoves
  .sort((a, b) => b.evalDropCp - a.evalDropCp)
  .slice(0, 5)
```

Versione migliore:

- prendere prima la peggiore per ogni `diagnosis.type`;
- poi riempire eventuali slot rimanenti con i peggiori delta.

---

### 4. Aggiungere `diagnosis` a ogni mossa critica

Prima di chiamare Qwen, ogni mossa critica deve essere arricchita con:

```ts
{
  diagnosis: {
    type: "queen_tempo_loss",
    confidence: 0.8,
    facts: [...],
    principle: "...",
    mustMention: [...]
  }
}
```

Il prompt LLM deve usare principalmente `diagnosis.facts` e `diagnosis.principle`.

---

## Dati consigliati per ogni mossa critica

Il payload finale verso Qwen dovrebbe essere simile a questo:

```json
{
  "players": {
    "white": "Giocatore Bianco",
    "black": "Giocatore Nero"
  },
  "result": "0-1",
  "playerLevel": 300,
  "criticalMoves": [
    {
      "index": 17,
      "moveNumber": 9,
      "player": "white",
      "san": "Dh5",
      "classification": "ERRORE",
      "evalBeforeCp": 40,
      "evalAfterCp": -170,
      "evalDropCp": 210,
      "bestSan": "Cf3",
      "diagnosis": {
        "type": "queen_tempo_loss",
        "confidence": 0.8,
        "facts": [
          "La mossa giocata muove la Donna da d1 a h5.",
          "La Donna è stata mossa 2 volte nelle prime 9 mosse.",
          "Sono ancora non sviluppati: Cavallo b1, Alfiere c1.",
          "Stockfish preferiva Cf3.",
          "La valutazione peggiora di circa 210 centipawn."
        ],
        "principle": "In apertura evita di muovere più volte la Donna se non vinci materiale o dai matto.",
        "mustMention": ["Donna", "sviluppo", "Cf3"]
      }
    }
  ]
}
```

Da evitare nel payload finale:

```json
{
  "pgnCompleto": "...",
  "fenBefore": "...",
  "fenAfter": "...",
  "localContextVeryLong": "..."
}
```

---

## Feature da estrarre con chess.js

`chess.js` deve essere usata per descrivere cosa succede sulla scacchiera.

Usare:

```ts
chess.moves({ verbose: true })
```

I campi utili sono:

```ts
{
  color: "w" | "b",
  from: string,
  to: string,
  piece: "p" | "n" | "b" | "r" | "q" | "k",
  captured?: "p" | "n" | "b" | "r" | "q" | "k",
  promotion?: string,
  flags: string,
  san: string,
  lan: string,
  before?: string,
  after?: string
}
```

Feature utili:

- pezzo mosso;
- casa di partenza;
- casa di arrivo;
- cattura;
- pezzo catturato;
- scacco;
- matto in 1 disponibile;
- matto in 1 concesso;
- mosse legali di cattura;
- mosse legali di scacco;
- pezzi minori non sviluppati;
- Re ancora al centro;
- Donna mossa presto;
- numero di mosse precedenti della Donna;
- materiale sulla scacchiera.

---

## Helper consigliati in TypeScript

Creare un file, per esempio:

```text
src/services/coachDiagnostics.ts
```

oppure:

```text
src/chess/diagnostics.ts
```

### Tipi base

```ts
export type PieceColor = "w" | "b";

export type DiagnosisType =
  | "missed_mate_in_one"
  | "allowed_mate_in_one"
  | "missed_high_value_capture"
  | "queen_tempo_loss"
  | "development_problem"
  | "king_safety"
  | "generic_eval_loss";

export type Diagnosis = {
  type: DiagnosisType;
  confidence: number;
  facts: string[];
  principle: string;
  mustMention: string[];
};

export type DiagnosticInput = {
  fenBefore: string;
  fenAfter: string;
  playedMove: any;
  moveNumber: number;
  historyBeforeMove: any[];
  evalBeforeCp: number;
  evalAfterCp: number;
  bestSan?: string;
  bestMoveLan?: string;
  opponentBestReplySan?: string;
};
```

### Nomi italiani dei pezzi

```ts
const PIECE_IT: Record<string, string> = {
  p: "Pedone",
  n: "Cavallo",
  b: "Alfiere",
  r: "Torre",
  q: "Donna",
  k: "Re",
};

const PIECE_VALUE: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};
```

### Fact generico sulla valutazione

```ts
function evalDropCp(input: DiagnosticInput): number {
  return Math.abs(input.evalBeforeCp - input.evalAfterCp);
}

function evalDropFact(dropCp: number): string {
  return `La valutazione peggiora di circa ${dropCp} centipawn.`;
}
```

### Fact sul pezzo mosso

```ts
function movedPieceFact(move: any): string {
  const pieceName = PIECE_IT[move.piece] ?? move.piece;
  return `La mossa giocata muove il ${pieceName} da ${move.from} a ${move.to}.`;
}
```

### Pezzi minori non sviluppati

```ts
import { Chess } from "chess.js";

function undevelopedMinorPieces(fen: string, color: PieceColor) {
  const chess = new Chess(fen);

  const startSquares =
    color === "w"
      ? [
          { square: "b1", name: "Cavallo b1", type: "n" },
          { square: "g1", name: "Cavallo g1", type: "n" },
          { square: "c1", name: "Alfiere c1", type: "b" },
          { square: "f1", name: "Alfiere f1", type: "b" },
        ]
      : [
          { square: "b8", name: "Cavallo b8", type: "n" },
          { square: "g8", name: "Cavallo g8", type: "n" },
          { square: "c8", name: "Alfiere c8", type: "b" },
          { square: "f8", name: "Alfiere f8", type: "b" },
        ];

  return startSquares.filter(({ square, type }) => {
    const piece = chess.get(square);
    return piece && piece.color === color && piece.type === type;
  });
}
```

### Casa del Re

```ts
function kingSquare(fen: string, color: PieceColor): string | null {
  const chess = new Chess(fen);
  const board = chess.board();
  const files = "abcdefgh";

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece && piece.type === "k" && piece.color === color) {
        return `${files[file]}${8 - rank}`;
      }
    }
  }

  return null;
}

function isKingStillCentral(fen: string, color: PieceColor): boolean {
  const sq = kingSquare(fen, color);

  if (color === "w") {
    return sq === "e1" || sq === "d1";
  }

  return sq === "e8" || sq === "d8";
}
```

### Matto in 1

```ts
function mateInOneMoves(fen: string) {
  const chess = new Chess(fen);

  return chess.moves({ verbose: true }).filter((move) => {
    const copy = new Chess(fen);
    copy.move(move);
    return copy.isCheckmate();
  });
}
```

---

## Detector MVP

Implementare i detector in ordine di priorità. Ogni detector restituisce `Diagnosis | null`.

L’ordine è importante: prima i fatti tattici forzanti, poi i concetti generali.

Ordine consigliato:

1. `detectMissedMateInOne`
2. `detectAllowedMateInOne`
3. `detectMissedHighValueCapture`
4. `detectQueenTempoLoss`
5. `detectKingSafety`
6. `detectDevelopmentProblem`
7. fallback `generic_eval_loss`

---

### 1. Matto in 1 mancato

```ts
function detectMissedMateInOne(input: DiagnosticInput): Diagnosis | null {
  const mates = mateInOneMoves(input.fenBefore);
  if (mates.length === 0) return null;

  const playedWasMate = mates.some(
    (m) => m.from === input.playedMove.from && m.to === input.playedMove.to
  );

  if (playedWasMate) return null;

  return {
    type: "missed_mate_in_one",
    confidence: 1,
    facts: [
      "Prima della mossa esisteva un matto immediato.",
      `La mossa vincente era ${mates.map((m) => m.san).join(", ")}.`,
      `La mossa giocata è stata ${input.playedMove.san}, quindi il matto non è stato sfruttato.`,
    ],
    principle: "Quando puoi dare matto, il matto ha priorità su qualsiasi altro guadagno.",
    mustMention: [mates[0].san, "matto"],
  };
}
```

---

### 2. Matto in 1 concesso

```ts
function detectAllowedMateInOne(input: DiagnosticInput): Diagnosis | null {
  const opponentMates = mateInOneMoves(input.fenAfter);
  if (opponentMates.length === 0) return null;

  return {
    type: "allowed_mate_in_one",
    confidence: 1,
    facts: [
      "Dopo la mossa giocata, l'avversario ha un matto immediato.",
      `La mossa di matto disponibile è ${opponentMates.map((m) => m.san).join(", ")}.`,
    ],
    principle: "Prima di muovere, controlla sempre se il tuo Re può subire scacchi forzanti o matto.",
    mustMention: [opponentMates[0].san, "matto"],
  };
}
```

---

### 3. Cattura importante mancata

Questa è una versione MVP. Non pretende di dimostrare che la cattura sia sempre gratis. La considera rilevante se:

- esiste una cattura legale;
- prende almeno un pezzo minore;
- coincide con la best move di Stockfish;
- la mossa giocata causa un calo importante.

```ts
function legalCaptures(fen: string) {
  const chess = new Chess(fen);
  return chess.moves({ verbose: true }).filter((m) => m.captured);
}

function detectMissedHighValueCapture(input: DiagnosticInput): Diagnosis | null {
  const dropCp = evalDropCp(input);
  if (!input.bestMoveLan) return null;
  if (dropCp < 100) return null;

  const captures = legalCaptures(input.fenBefore)
    .filter((m) => m.captured)
    .sort((a, b) => PIECE_VALUE[b.captured!] - PIECE_VALUE[a.captured!]);

  const bestCapture = captures[0];
  if (!bestCapture) return null;

  const capturedValue = PIECE_VALUE[bestCapture.captured!];
  if (capturedValue < 300) return null;

  const isStockfishBest = bestCapture.lan === input.bestMoveLan;
  if (!isStockfishBest) return null;

  const capturedName = PIECE_IT[bestCapture.captured!] ?? bestCapture.captured;

  return {
    type: "missed_high_value_capture",
    confidence: 0.75,
    facts: [
      `Prima della mossa era disponibile la cattura ${bestCapture.san}.`,
      `Questa cattura prendeva un ${capturedName} in ${bestCapture.to}.`,
      `Stockfish indicava ${bestCapture.san} come mossa migliore.`,
      `La mossa giocata invece è stata ${input.playedMove.san}.`,
      evalDropFact(dropCp),
    ],
    principle: "Prima di fare una mossa tranquilla, controlla sempre catture, scacchi e minacce.",
    mustMention: [bestCapture.san, capturedName],
  };
}
```

---

### 4. Donna mossa troppo presto

```ts
function countPreviousPieceMoves(history: any[], color: PieceColor, piece: string): number {
  return history.filter((m) => m.color === color && m.piece === piece).length;
}

function detectQueenTempoLoss(input: DiagnosticInput): Diagnosis | null {
  const dropCp = evalDropCp(input);
  const move = input.playedMove;

  if (move.piece !== "q") return null;
  if (input.moveNumber > 12) return null;
  if (dropCp < 80) return null;

  const previousQueenMoves = countPreviousPieceMoves(
    input.historyBeforeMove,
    move.color,
    "q"
  );

  const undeveloped = undevelopedMinorPieces(input.fenBefore, move.color);

  if (previousQueenMoves < 1 && undeveloped.length < 2) return null;

  const facts = [
    `La mossa giocata muove la Donna da ${move.from} a ${move.to}.`,
    `La Donna è stata mossa ${previousQueenMoves + 1} volte nelle prime ${input.moveNumber} mosse.`,
  ];

  if (undeveloped.length > 0) {
    facts.push(`Sono ancora non sviluppati: ${undeveloped.map((p) => p.name).join(", ")}.`);
  }

  if (input.bestSan) {
    facts.push(`Stockfish preferiva ${input.bestSan}.`);
  }

  if (input.opponentBestReplySan) {
    facts.push(`La risposta consigliata per l'avversario è ${input.opponentBestReplySan}.`);
  }

  facts.push(evalDropFact(dropCp));

  return {
    type: "queen_tempo_loss",
    confidence: 0.8,
    facts,
    principle: "In apertura evita di muovere più volte la Donna se non vinci materiale o dai matto.",
    mustMention: ["Donna", "sviluppo", input.bestSan ?? "mossa migliore"],
  };
}
```

---

### 5. Sicurezza del Re

```ts
function detectKingSafety(input: DiagnosticInput): Diagnosis | null {
  const dropCp = evalDropCp(input);
  const move = input.playedMove;

  if (input.moveNumber < 7 || input.moveNumber > 18) return null;
  if (dropCp < 100) return null;

  const kingCentral = isKingStillCentral(input.fenAfter, move.color);
  if (!kingCentral) return null;

  const kingSq = kingSquare(input.fenAfter, move.color);

  const facts = [
    `Dopo la mossa giocata, il Re è ancora in ${kingSq}.`,
    `La mossa ${move.san} non mette il Re al sicuro.`,
  ];

  if (input.bestSan) {
    facts.push(`Stockfish preferiva ${input.bestSan}.`);
  }

  facts.push(evalDropFact(dropCp));

  return {
    type: "king_safety",
    confidence: 0.72,
    facts,
    principle: "Quando il centro può aprirsi, arroccare e mettere il Re al sicuro è una priorità.",
    mustMention: ["Re", kingSq ?? "centro"],
  };
}
```

---

### 6. Problema di sviluppo

```ts
function isMinorPieceMove(move: any): boolean {
  return move.piece === "n" || move.piece === "b";
}

function isCastling(move: any): boolean {
  return move.flags?.includes("k") || move.flags?.includes("q");
}

function detectDevelopmentProblem(input: DiagnosticInput): Diagnosis | null {
  const dropCp = evalDropCp(input);
  const move = input.playedMove;

  if (input.moveNumber > 14) return null;
  if (dropCp < 80) return null;

  const undeveloped = undevelopedMinorPieces(input.fenBefore, move.color);
  if (undeveloped.length < 2) return null;

  const moveDevelops = isMinorPieceMove(move) || isCastling(move);
  if (moveDevelops) return null;

  const facts = [
    `La mossa giocata è ${move.san}.`,
    `Prima della mossa sono ancora non sviluppati: ${undeveloped.map((p) => p.name).join(", ")}.`,
    "La mossa giocata non sviluppa un Cavallo o un Alfiere e non arrocca.",
  ];

  if (input.bestSan) {
    facts.push(`Stockfish preferiva ${input.bestSan}.`);
  }

  facts.push(evalDropFact(dropCp));

  return {
    type: "development_problem",
    confidence: 0.7,
    facts,
    principle: "In apertura sviluppa Cavalli e Alfieri e metti il Re al sicuro prima di fare mosse laterali.",
    mustMention: ["sviluppo", undeveloped[0].name],
  };
}
```

---

### 7. Fallback generico

Il fallback deve essere generico, ma non vago.

```ts
function genericEvalLoss(input: DiagnosticInput): Diagnosis {
  const dropCp = evalDropCp(input);

  const facts = [
    movedPieceFact(input.playedMove),
    `La mossa giocata è ${input.playedMove.san}.`,
  ];

  if (input.bestSan) {
    facts.push(`Stockfish preferiva ${input.bestSan}.`);
  }

  facts.push(evalDropFact(dropCp));

  return {
    type: "generic_eval_loss",
    confidence: 0.4,
    facts,
    principle: "Quando la valutazione cambia molto, controlla prima catture, scacchi e minacce immediate.",
    mustMention: [input.playedMove.san, input.bestSan ?? "mossa migliore"],
  };
}
```

---

## Funzione principale di diagnosi

```ts
export function buildDiagnosis(input: DiagnosticInput): Diagnosis {
  const detectors: Array<() => Diagnosis | null> = [
    () => detectMissedMateInOne(input),
    () => detectAllowedMateInOne(input),
    () => detectMissedHighValueCapture(input),
    () => detectQueenTempoLoss(input),
    () => detectKingSafety(input),
    () => detectDevelopmentProblem(input),
  ];

  for (const detector of detectors) {
    const diagnosis = detector();
    if (diagnosis) return diagnosis;
  }

  return genericEvalLoss(input);
}
```

---

## Integrazione con Stockfish 18

Per ogni mossa critica servono almeno:

```ts
{
  evalBeforeCp: number;
  evalAfterCp: number;
  bestSan?: string;
  bestMoveLan?: string;
  opponentBestReplySan?: string;
}
```

### `evalBeforeCp` e `evalAfterCp`

Devono essere normalizzati sempre dal punto di vista del giocatore che ha mosso, oppure bisogna essere espliciti sul verso.

Consiglio:

- salvare le eval raw dal punto di vista del Bianco;
- calcolare `evalDropCp` dal punto di vista del giocatore che ha mosso.

Esempio:

```ts
function normalizeEvalForColor(evalCpFromWhitePerspective: number, color: "w" | "b") {
  return color === "w" ? evalCpFromWhitePerspective : -evalCpFromWhitePerspective;
}

const beforeForPlayer = normalizeEvalForColor(evalBeforeCpWhite, move.color);
const afterForPlayer = normalizeEvalForColor(evalAfterCpWhite, move.color);
const evalDropCp = beforeForPlayer - afterForPlayer;
```

Una mossa è peggiorativa se:

```ts
evalDropCp > 0
```

### `bestMoveLan`

Serve per confrontare la mossa migliore Stockfish con le mosse legali di `chess.js`.

Stockfish usa UCI:

```text
e2e4
```

`chess.js` può fornire `lan` o si può costruire:

```ts
const moveLan = `${move.from}${move.to}${move.promotion ?? ""}`;
```

Assicurarsi che `bestMoveLan` e il formato usato per il confronto coincidano.

### `bestSan`

Da ottenere applicando la best move Stockfish sulla posizione `fenBefore` tramite `chess.js`.

Esempio:

```ts
function uciToSan(fen: string, uci: string): string | null {
  const chess = new Chess(fen);
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci.slice(4, 5) : undefined;

  const move = chess.move({ from, to, promotion });
  return move?.san ?? null;
}
```

### `opponentBestReplySan`

Per alcune diagnosi è utile sapere la migliore risposta dell’avversario dopo la mossa sbagliata.

Flusso:

1. prendi `fenAfter`;
2. chiedi a Stockfish 18 la best move dalla posizione dopo la mossa giocata;
3. converti UCI → SAN con `chess.js`;
4. salva in `opponentBestReplySan`.

Non serve farlo per tutte le mosse della partita. Farlo solo per le massimo 5 mosse candidate al prompt LLM.

---

## Classificazione errori

Mantenere la classificazione esistente basata sul delta, ma calcolare il delta dal punto di vista del giocatore.

Esempio indicativo:

```ts
function classifyByDropCp(dropCp: number): "OK" | "IMPRECISIONE" | "ERRORE" | "ERRORE_GRAVE" {
  if (dropCp >= 250) return "ERRORE_GRAVE";
  if (dropCp >= 120) return "ERRORE";
  if (dropCp >= 60) return "IMPRECISIONE";
  return "OK";
}
```

Per il prompt LLM, inviare preferibilmente:

- `ERRORE`
- `ERRORE_GRAVE`

Valutare se includere `IMPRECISIONE` solo quando ci sono poche mosse critiche.

---

## Prompt Qwen consigliato

Sostituire il prompt attuale con uno più rigido.

### System prompt

```text
Sei un coach di scacchi per principianti.

Devi generare un'analisi in italiano semplice usando SOLO i dati forniti.
Non devi analizzare la posizione autonomamente.
Non devi inventare varianti.
Non devi usare frasi generiche come:
- "hai indebolito la posizione"
- "hai perso iniziativa"
- "mossa poco precisa"
- "la posizione peggiora"
- "il tuo avversario ottiene gioco"

Per ogni momento chiave:
- spiega l'errore concreto;
- cita almeno un pezzo, una casa, una minaccia o una mossa concreta;
- usa i facts dentro diagnosis;
- dai una regola pratica per il futuro;
- massimo 80 parole.

Restituisci solo JSON valido.
```

### User prompt

```text
Analizza questa partita per un giocatore principiante.

Dati partita:
{{game_json}}

Formato obbligatorio:
{
  "panoramica": "stringa breve, massimo 80 parole",
  "giudizio": "stringa breve, massimo 50 parole",
  "momentiChiave": [
    {
      "index": number,
      "titolo": "stringa breve",
      "spiegazione": "stringa massimo 80 parole",
      "consiglio": "stringa breve"
    }
  ]
}

Regole:
- momentiChiave deve contenere una voce per ogni criticalMoves ricevuta;
- ogni voce deve usare lo stesso index della mossa critica;
- non aggiungere mosse non presenti nei dati;
- non nominare FEN o centipawn in modo tecnico se non necessario;
- se usi la valutazione, spiega solo che la mossa peggiora molto o poco;
- non usare Markdown;
- restituisci solo JSON puro.
```

---

## Vincoli per Qwen3-4B-Q4_K_M

Per mantenere risposta veloce:

- massimo 5 mosse critiche;
- massimo 5 facts per mossa;
- non inviare PGN completo;
- non inviare FEN;
- non inviare localContext lungo;
- max output circa 450-700 token;
- temperature bassa.

Parametri suggeriti per `llama.cpp`:

```text
-c 2048
-n 600
--temp 0.2
--top-p 0.9
```

Se possibile, su Mac usare Metal/GPU:

```text
-ngl 99
```

Evitare context window enormi tipo 16k/32k se non servono.

---

## Output JSON: robustezza

Dato che Qwen locale può produrre JSON non perfetto, mantenere o aggiungere:

1. validazione JSON;
2. eventuale riparazione minima;
3. fallback testuale se il JSON è invalido;
4. schema validation.

Esempio schema concettuale:

```ts
type CoachAnalysis = {
  panoramica: string;
  giudizio: string;
  momentiChiave: Array<{
    index: number;
    titolo: string;
    spiegazione: string;
    consiglio: string;
  }>;
};
```

Controlli:

- `momentiChiave.length === criticalMoves.length`
- ogni `index` corrisponde a una mossa critica inviata
- nessuna stringa vuota
- nessuna frase vietata

Frasi vietate da intercettare:

```ts
const BANNED_GENERIC_PHRASES = [
  "hai indebolito la posizione",
  "indebolisce la posizione",
  "perdi iniziativa",
  "perde iniziativa",
  "mossa poco precisa",
  "la posizione peggiora",
];
```

Se una frase vietata appare, si può:

- rigenerare solo quella spiegazione;
- oppure sostituire con fallback basato sui facts.

Fallback semplice:

```ts
function fallbackExplanationFromFacts(diagnosis: Diagnosis): string {
  return `${diagnosis.facts.slice(0, 3).join(" ")} Regola pratica: ${diagnosis.principle}`;
}
```

---

## Performance target

Target desiderato con Qwen3-4B-Q4_K_M:

- generazione per analisi completa: pochi secondi, non minuti;
- prompt sotto ~1500-2000 token;
- output sotto ~700 token;
- massimo 5 momenti chiave.

Se la generazione richiede molti minuti, controllare:

1. `-ngl 99` / Metal attivo;
2. context window troppo alta;
3. prompt troppo lungo;
4. troppe mosse critiche;
5. output JSON troppo grande;
6. generazione non streaming bloccante;
7. eventuale build `llama.cpp` senza accelerazione Metal.

---

## Refactor suggerito per file esistenti

Dai riferimenti attuali:

- `src/pages/LessonDetailPage.tsx`
- `src/services/explainService.ts`
- `src-tauri/src/commands.rs`
- `src-tauri/src/commentary.rs`

### Frontend React

In `LessonDetailPage.tsx`:

- continuare a costruire le mosse con `chess.js`;
- assicurarsi che per ogni mossa siano disponibili:
  - `fenBefore`
  - `fenAfter`
  - `san`
  - `lan` o UCI equivalente
  - `piece`
  - `from`
  - `to`
  - `color`
  - `flags`
  - `captured`
  - `moveNumber`
  - `historyBeforeMove`

Aggiungere una fase:

```ts
const enrichedCriticalMoves = buildCriticalMoveDiagnostics({
  moves,
  stockfishResults,
  maxCriticalMoves: 5,
});
```

Questa fase può stare nel frontend se tutti i dati `chess.js` sono già lì.

### Service TypeScript

In `src/services/explainService.ts`:

- non mandare più PGN compatto completo al backend LLM;
- non mandare più FEN al prompt finale, salvo debug;
- mandare `criticalMoves` già arricchite da `diagnosis`;
- mantenere l’output atteso invariato.

### Rust Tauri

In `src-tauri/src/commands.rs`:

- mantenere `generate_game_analysis`;
- aggiornare la struttura dati ricevuta per includere `diagnosis`;
- evitare di ricostruire un prompt lungo con FEN/PGN completo;
- mantenere conversione notazione italiana se già utile, ma non convertire i facts se sono già generati in italiano.

### Rust commentary

In `src-tauri/src/commentary.rs`:

- ridurre il prompt;
- includere solo payload minimale;
- mantenere JSON puro;
- aumentare robustezza parsing;
- ridurre `max_tokens` se ora è calcolato come `320 + 12 * numero_mosse_critiche`.

Nuovo budget consigliato:

```rust
let max_tokens = 420 + 60 * critical_moves_len;
let max_tokens = max_tokens.min(700);
```

Se le spiegazioni devono essere molto brevi:

```rust
let max_tokens = 350 + 50 * critical_moves_len;
let max_tokens = max_tokens.min(600);
```

---

## Strategia di implementazione incrementale

### Step 1: payload minimale

- rimuovere PGN compatto dal prompt;
- rimuovere FEN dal prompt;
- limitare a 5 mosse critiche.

Questo dovrebbe già migliorare la velocità.

### Step 2: aggiungere diagnosis fallback

Per ogni mossa critica aggiungere almeno:

```ts
{
  type: "generic_eval_loss",
  facts: [
    movedPieceFact(move),
    `Stockfish preferiva ${bestSan}.`,
    evalDropFact(dropCp)
  ],
  principle: "Controlla catture, scacchi e minacce immediate.",
  mustMention: [...]
}
```

Questo riduce subito la vaghezza.

### Step 3: detector tattici semplici

Implementare:

- missed_mate_in_one
- allowed_mate_in_one
- missed_high_value_capture

### Step 4: detector apertura/principianti

Implementare:

- queen_tempo_loss
- development_problem
- king_safety

### Step 5: validazione anti-vaghezza

Dopo risposta LLM:

- controllare JSON;
- controllare frasi vietate;
- se necessario usare fallback da facts.

---

## Esempio di payload finale completo

```json
{
  "players": {
    "white": "Bianco",
    "black": "Nero"
  },
  "result": "0-1",
  "playerLevel": 300,
  "criticalMoves": [
    {
      "index": 5,
      "moveNumber": 3,
      "player": "white",
      "san": "Dh5",
      "classification": "ERRORE",
      "evalBeforeCp": 30,
      "evalAfterCp": -160,
      "evalDropCp": 190,
      "bestSan": "Cf3",
      "diagnosis": {
        "type": "queen_tempo_loss",
        "confidence": 0.8,
        "facts": [
          "La mossa giocata muove la Donna da d1 a h5.",
          "La Donna è stata mossa 1 volte nelle prime 3 mosse.",
          "Sono ancora non sviluppati: Cavallo b1, Cavallo g1, Alfiere c1, Alfiere f1.",
          "Stockfish preferiva Cf3.",
          "La valutazione peggiora di circa 190 centipawn."
        ],
        "principle": "In apertura evita di muovere più volte la Donna se non vinci materiale o dai matto.",
        "mustMention": ["Donna", "sviluppo", "Cf3"]
      }
    }
  ]
}
```

---

## Esempio di output desiderato da Qwen

```json
{
  "panoramica": "La partita è stata decisa soprattutto da errori di apertura: la Donna è uscita presto e lo sviluppo dei pezzi è rimasto indietro. A questo livello conviene concentrarsi su mosse semplici: sviluppare Cavalli e Alfieri, arroccare e controllare le minacce immediate.",
  "giudizio": "Il problema principale non è una singola mossa, ma la mancanza di priorità: prima sviluppo e sicurezza del Re, poi attacchi con la Donna.",
  "momentiChiave": [
    {
      "index": 5,
      "titolo": "Donna uscita troppo presto",
      "spiegazione": "Con Dh5 la Donna va da d1 a h5 mentre Cavalli e Alfieri sono ancora fermi. Stockfish preferiva Cf3, una mossa che sviluppa un pezzo. Il problema è che la Donna può diventare un bersaglio e farti perdere tempi preziosi.",
      "consiglio": "In apertura sviluppa prima Cavalli e Alfieri; muovi la Donna presto solo se vinci materiale o dai matto."
    }
  ]
}
```

---

## Criteri di accettazione

Il refactor è completato quando:

1. Il prompt LLM non contiene più PGN completo.
2. Il prompt LLM non contiene più FEN, salvo debug esplicito.
3. L’LLM riceve massimo 5 mosse critiche.
4. Ogni mossa critica contiene `diagnosis`.
5. Ogni `diagnosis` contiene `facts`, `principle`, `mustMention`.
6. Il prompt vieta esplicitamente frasi generiche.
7. L’output resta JSON puro con `panoramica`, `giudizio`, `momentiChiave`.
8. Le spiegazioni citano pezzi, case, mosse o minacce concrete.
9. Il tempo di generazione con Qwen3-4B-Q4_K_M scende sensibilmente.
10. In caso di JSON invalido o frasi vaghe, esiste fallback basato sui facts.

---

## Nota finale per l’agente

Non cercare di rendere perfetto il classificatore al primo giro.

La priorità è cambiare responsabilità:

```text
Stockfish 18 = valuta la posizione
chess.js = descrive mosse e stato della scacchiera
codice diagnostico = decide il tema dell’errore
Qwen = scrive una spiegazione breve e chiara
```

Il modello locale non deve essere il cervello scacchistico. Deve solo trasformare facts concreti in una risposta leggibile.

