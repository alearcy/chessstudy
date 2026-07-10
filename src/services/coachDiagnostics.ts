import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

export const MAX_CRITICAL_MOVES_FOR_ANALYSIS = 5;

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

export type CoachMoveInput = {
  moveNumber: number;
  index: number;
  fenBefore: string;
  fenAfter: string;
  san: string;
  player: string;
  evalBefore: string;
  evalAfter: string;
  evalBeforeCp: number | null;
  evalAfterCp: number | null;
  classification: string;
  bestSan: string | null;
  bestMoveLan: string | null;
  stockfishComment: string | null;
};

export type CoachCriticalMove = CoachMoveInput & {
  evalDropCp: number;
  diagnosis: Diagnosis;
};

type VerboseMove = {
  color: Color;
  from: string;
  to: string;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: string;
  flags?: string;
  san: string;
  lan?: string;
};

type DiagnosticInput = {
  fenBefore: string;
  fenAfter: string;
  playedMove: VerboseMove;
  moveNumber: number;
  historyBeforeMove: VerboseMove[];
  evalBeforeCp: number;
  evalAfterCp: number;
  evalDropCp: number;
  bestSan?: string;
  bestMoveLan?: string;
};

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

export function buildCriticalMoveDiagnostics(moves: CoachMoveInput[]): CoachCriticalMove[] {
  return pickCriticalMovesForLlm(diagnoseCriticalMoves(moves));
}

export function diagnoseCriticalMoves(moves: CoachMoveInput[]): CoachCriticalMove[] {
  const replay = new Chess();
  const history: VerboseMove[] = [];
  const enriched: CoachCriticalMove[] = [];

  for (const move of moves) {
    const fenBefore = safeFen(move.fenBefore, replay.fen());
    const playedMove = resolvePlayedMove(fenBefore, move.san);
    const color = playedMove?.color ?? (move.index % 2 === 0 ? "w" : "b");
    const evalDropCp = calculateEvalDrop(move.evalBeforeCp, move.evalAfterCp, color);

    if (playedMove) {
      const diagnosis = buildDiagnosis({
        fenBefore,
        fenAfter: move.fenAfter,
        playedMove,
        moveNumber: move.moveNumber,
        historyBeforeMove: history,
        evalBeforeCp: normalizeEvalForColor(move.evalBeforeCp ?? 0, color),
        evalAfterCp: normalizeEvalForColor(move.evalAfterCp ?? 0, color),
        evalDropCp,
        bestSan: move.bestSan ?? undefined,
        bestMoveLan: move.bestMoveLan ?? undefined,
      });

      if (isEducationalClassification(move.classification)) {
        enriched.push({
          ...move,
          fenBefore,
          evalDropCp,
          diagnosis,
        });
      }

      history.push(playedMove);
      try {
        replay.load(move.fenAfter);
      } catch {
        replay.load(fenBefore);
        replay.move({ from: playedMove.from, to: playedMove.to, promotion: playedMove.promotion });
      }
    }
  }

  return enriched.sort((a, b) => a.index - b.index);
}

function pickCriticalMovesForLlm(moves: CoachCriticalMove[]): CoachCriticalMove[] {
  const sorted = [...moves].sort((a, b) => b.evalDropCp - a.evalDropCp);
  const selected: CoachCriticalMove[] = [];
  const usedTypes = new Set<DiagnosisType>();

  for (const move of sorted) {
    if (usedTypes.has(move.diagnosis.type)) continue;
    selected.push(move);
    usedTypes.add(move.diagnosis.type);
    if (selected.length >= MAX_CRITICAL_MOVES_FOR_ANALYSIS) return selected.sort((a, b) => a.index - b.index);
  }

  for (const move of sorted) {
    if (selected.some((item) => item.index === move.index)) continue;
    selected.push(move);
    if (selected.length >= MAX_CRITICAL_MOVES_FOR_ANALYSIS) break;
  }

  return selected.sort((a, b) => a.index - b.index);
}

function buildDiagnosis(input: DiagnosticInput): Diagnosis {
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
    if (diagnosis) return clampFacts(diagnosis);
  }

  return clampFacts(genericEvalLoss(input));
}

function detectMissedMateInOne(input: DiagnosticInput): Diagnosis | null {
  const mates = mateInOneMoves(input.fenBefore);
  if (mates.length === 0) return null;
  const playedWasMate = mates.some((m) => m.from === input.playedMove.from && m.to === input.playedMove.to);
  if (playedWasMate) return null;

  return {
    type: "missed_mate_in_one",
    confidence: 1,
    facts: [
      "Prima della mossa esisteva un matto immediato.",
      `La mossa vincente era ${mates.map((m) => m.san).join(", ")}.`,
      `La mossa giocata e' stata ${input.playedMove.san}, quindi il matto non e' stato sfruttato.`,
    ],
    principle: "Quando puoi dare matto, il matto ha priorita' su qualsiasi altro guadagno.",
    mustMention: [mates[0].san, "matto"],
  };
}

function detectAllowedMateInOne(input: DiagnosticInput): Diagnosis | null {
  const opponentMates = mateInOneMoves(input.fenAfter);
  if (opponentMates.length === 0) return null;

  return {
    type: "allowed_mate_in_one",
    confidence: 1,
    facts: [
      "Dopo la mossa giocata, l'avversario ha un matto immediato.",
      `La mossa di matto disponibile e' ${opponentMates.map((m) => m.san).join(", ")}.`,
    ],
    principle: "Prima di muovere, controlla sempre se il Re puo' subire scacchi forzanti o matto.",
    mustMention: [opponentMates[0].san, "matto"],
  };
}

function detectMissedHighValueCapture(input: DiagnosticInput): Diagnosis | null {
  if (!input.bestMoveLan || input.evalDropCp < 100) return null;
  const bestCapture = legalCaptures(input.fenBefore).find(
    (move) => moveToUci(move) === input.bestMoveLan
  );
  if (!bestCapture || !bestCapture.captured) return null;
  if (PIECE_VALUE[bestCapture.captured] < 300) return null;

  const capturedName = PIECE_IT[bestCapture.captured] ?? bestCapture.captured;

  return {
    type: "missed_high_value_capture",
    confidence: 0.75,
    facts: [
      `Prima della mossa era disponibile la cattura ${bestCapture.san}.`,
      `Questa cattura prendeva un ${capturedName} in ${bestCapture.to}.`,
      `La continuazione piu forte era ${bestCapture.san}.`,
      `La mossa giocata invece e' stata ${input.playedMove.san}.`,
      evalDropFact(input.evalDropCp),
    ],
    principle: "Prima di fare una mossa tranquilla, controlla sempre catture, scacchi e minacce.",
    mustMention: [bestCapture.san, capturedName],
  };
}

function detectQueenTempoLoss(input: DiagnosticInput): Diagnosis | null {
  const move = input.playedMove;
  if (move.piece !== "q") return null;
  if (input.moveNumber > 12 || input.evalDropCp < 80) return null;

  const previousQueenMoves = input.historyBeforeMove.filter((m) => m.color === move.color && m.piece === "q").length;
  const undeveloped = undevelopedMinorPieces(input.fenBefore, move.color);
  const bestMove = resolveLanMove(input.fenBefore, input.bestMoveLan);
  if (previousQueenMoves < 1 || undeveloped.length < 1) return null;
  if (!bestMove || (!isDevelopingMinorPieceMove(bestMove) && !isCastling(bestMove))) return null;

  const facts = [
    `La mossa giocata muove la Donna da ${move.from} a ${move.to}.`,
    `La Donna e' stata mossa ${previousQueenMoves + 1} volte nelle prime ${input.moveNumber} mosse.`,
  ];
  if (undeveloped.length > 0) {
    facts.push(`Sono ancora non sviluppati: ${undeveloped.map((p) => p.name).join(", ")}.`);
  }
  if (input.bestSan) facts.push(`La continuazione piu precisa era ${input.bestSan}.`);
  facts.push(evalDropFact(input.evalDropCp));

  return {
    type: "queen_tempo_loss",
    confidence: 0.8,
    facts,
    principle: "In apertura evita di muovere piu' volte la Donna se non vinci materiale o dai matto.",
    mustMention: ["Donna", "sviluppo", input.bestSan ?? "mossa migliore"],
  };
}

function detectKingSafety(input: DiagnosticInput): Diagnosis | null {
  const move = input.playedMove;
  if (input.moveNumber > 16 || input.evalDropCp < 100) return null;
  const kingSq = kingSquare(input.fenBefore, move.color);
  if (!isKingStillCentral(input.fenBefore, move.color)) return null;
  if (isCastling(move)) return null;
  const bestMove = resolveLanMove(input.fenBefore, input.bestMoveLan);
  if (!bestMove || !isCastling(bestMove)) return null;

  const facts = [
    `Prima della mossa, il Re e' ancora in ${kingSq ?? "centro"}.`,
    `La mossa ${move.san} non mette il Re al sicuro.`,
  ];
  if (input.bestSan) facts.push(`La continuazione piu precisa era ${input.bestSan}.`);
  facts.push(evalDropFact(input.evalDropCp));

  return {
    type: "king_safety",
    confidence: 0.72,
    facts,
    principle: "Quando il centro puo' aprirsi, arroccare e mettere il Re al sicuro e' una priorita'.",
    mustMention: ["Re", kingSq ?? "centro"],
  };
}

function detectDevelopmentProblem(input: DiagnosticInput): Diagnosis | null {
  const move = input.playedMove;
  if (input.moveNumber > 14 || input.evalDropCp < 80) return null;
  const undeveloped = undevelopedMinorPieces(input.fenBefore, move.color);
  if (undeveloped.length < 2) return null;
  if (isMinorPieceMove(move) || isCastling(move)) return null;
  const bestMove = resolveLanMove(input.fenBefore, input.bestMoveLan);
  if (!bestMove || (!isDevelopingMinorPieceMove(bestMove) && !isCastling(bestMove))) return null;

  const facts = [
    `La mossa giocata e' ${move.san}.`,
    `Prima della mossa sono ancora non sviluppati: ${undeveloped.map((p) => p.name).join(", ")}.`,
    "La mossa giocata non sviluppa un Cavallo o un Alfiere e non arrocca.",
  ];
  if (input.bestSan) facts.push(`La continuazione piu precisa era ${input.bestSan}.`);
  facts.push(evalDropFact(input.evalDropCp));

  return {
    type: "development_problem",
    confidence: 0.7,
    facts,
    principle: "In apertura sviluppa Cavalli e Alfieri e metti il Re al sicuro prima di fare mosse laterali.",
    mustMention: ["sviluppo", undeveloped[0].name],
  };
}

function genericEvalLoss(input: DiagnosticInput): Diagnosis {
  const facts = [
    movedPieceFact(input.playedMove),
    `La mossa giocata e' ${input.playedMove.san}.`,
  ];
  if (input.bestSan) facts.push(`La continuazione piu precisa era ${input.bestSan}.`);
  facts.push(evalDropFact(input.evalDropCp));

  return {
    type: "generic_eval_loss",
    confidence: 0.4,
    facts,
    principle: "Quando la valutazione cambia molto, controlla prima catture, scacchi e minacce immediate.",
    mustMention: [input.playedMove.san, input.bestSan ?? "mossa migliore"],
  };
}

function resolvePlayedMove(fen: string, san: string): VerboseMove | null {
  try {
    const chess = new Chess(fen);
    const legalMoves = chess.moves({ verbose: true }) as unknown as VerboseMove[];
    const clean = cleanSan(san);
    const matched = legalMoves.find((move) => cleanSan(move.san) === clean);
    if (!matched) return null;
    chess.move({ from: matched.from, to: matched.to, promotion: matched.promotion });
    return matched;
  } catch {
    return null;
  }
}

function mateInOneMoves(fen: string): VerboseMove[] {
  try {
    const chess = new Chess(fen);
    const legalMoves = chess.moves({ verbose: true }) as unknown as VerboseMove[];
    return legalMoves.filter((move) => {
      chess.move({ from: move.from, to: move.to, promotion: move.promotion });
      const isMate = chess.isCheckmate();
      chess.undo();
      return isMate;
    });
  } catch {
    return [];
  }
}

function legalCaptures(fen: string): VerboseMove[] {
  try {
    const chess = new Chess(fen);
    return (chess.moves({ verbose: true }) as unknown as VerboseMove[]).filter((move) => move.captured);
  } catch {
    return [];
  }
}

function resolveLanMove(fen: string, lan?: string): VerboseMove | null {
  if (!lan) return null;
  try {
    const chess = new Chess(fen);
    const legalMoves = chess.moves({ verbose: true }) as unknown as VerboseMove[];
    return legalMoves.find((move) => moveToUci(move) === lan) ?? null;
  } catch {
    return null;
  }
}

function undevelopedMinorPieces(fen: string, color: Color) {
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
    const piece = chess.get(square as Square);
    return piece && piece.color === color && piece.type === type;
  });
}

function kingSquare(fen: string, color: Color): string | null {
  const chess = new Chess(fen);
  const board = chess.board();
  const files = "abcdefgh";

  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank][file];
      if (piece && piece.type === "k" && piece.color === color) {
        return `${files[file]}${8 - rank}`;
      }
    }
  }

  return null;
}

function isKingStillCentral(fen: string, color: Color): boolean {
  const sq = kingSquare(fen, color);
  return color === "w" ? sq === "e1" || sq === "d1" : sq === "e8" || sq === "d8";
}

function calculateEvalDrop(beforeCp: number | null, afterCp: number | null, color: Color): number {
  if (beforeCp == null || afterCp == null) return 0;
  const beforeForPlayer = normalizeEvalForColor(beforeCp, color);
  const afterForPlayer = normalizeEvalForColor(afterCp, color);
  return Math.max(0, beforeForPlayer - afterForPlayer);
}

function normalizeEvalForColor(evalCpFromWhitePerspective: number, color: Color) {
  return color === "w" ? evalCpFromWhitePerspective : -evalCpFromWhitePerspective;
}

function evalDropFact(dropCp: number): string {
  if (dropCp >= 250) return "La mossa peggiora molto la posizione.";
  if (dropCp >= 120) return "La mossa peggiora in modo importante la posizione.";
  return "La mossa peggiora leggermente la posizione.";
}

function movedPieceFact(move: VerboseMove): string {
  const pieceName = PIECE_IT[move.piece] ?? move.piece;
  return `La mossa giocata muove ${pieceName} da ${move.from} a ${move.to}.`;
}

function moveToUci(move: VerboseMove): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function isMinorPieceMove(move: VerboseMove): boolean {
  return move.piece === "n" || move.piece === "b";
}

function isDevelopingMinorPieceMove(move: VerboseMove): boolean {
  const startingSquares = move.color === "w"
    ? new Set(["b1", "g1", "c1", "f1"])
    : new Set(["b8", "g8", "c8", "f8"]);
  return isMinorPieceMove(move) && startingSquares.has(move.from);
}

function isCastling(move: VerboseMove): boolean {
  return move.flags?.includes("k") || move.flags?.includes("q") || move.san === "O-O" || move.san === "O-O-O";
}

function isEducationalClassification(classification: string): boolean {
  const normalized = classification.trim();
  return normalized === "IMPRECISIONE" || normalized === "ERRORE" || normalized === "ERRORE GRAVE";
}

function cleanSan(san: string): string {
  return san.replace(/[+#?!]/g, "").replaceAll("0", "O").trim();
}

function safeFen(fen: string, fallback: string): string {
  if (!fen || fen === "start") return fallback;
  try {
    new Chess(fen);
    return fen;
  } catch {
    return fallback;
  }
}

function clampFacts(diagnosis: Diagnosis): Diagnosis {
  return {
    ...diagnosis,
    facts: diagnosis.facts.filter((fact) => fact.trim().length > 0).slice(0, 5),
  };
}
