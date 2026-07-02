import { Chess, Square, PieceSymbol, Color } from "chess.js";
import type { Diagnosis } from "@/services/coachDiagnostics";
import type { MoveExplanationInput, MoveExplanation, TacticalPattern, Severity } from "@/types";
// ============================================================================
// Costanti
// ============================================================================

const PIECE_VALUES: Record<string, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
};

const PIECE_SYMBOLS: Record<string, string> = {
  wp: "♟", wn: "♞", wb: "♝", wr: "♜", wq: "♛", wk: "♔",
  bp: "♟", bn: "♞", bb: "♝", br: "♜", bq: "♛", bk: "♚",
};

function expandChessSymbols(text: string | null): string | null {
  if (!text) return text;
  return text
    .replaceAll("♔", "re")
    .replaceAll("♚", "re")
    .replaceAll("♕", "regina")
    .replaceAll("♛", "regina")
    .replaceAll("♖", "torre")
    .replaceAll("♜", "torre")
    .replaceAll("♗", "alfiere")
    .replaceAll("♝", "alfiere")
    .replaceAll("♘", "cavallo")
    .replaceAll("♞", "cavallo")
    .replaceAll("♙", "pedone")
    .replaceAll("♟", "pedone");
}

/** Simbolo pezzo + casa per display. */
function pieceLabel(square: Square, game: Chess): string {
  const p = game.get(square);
  if (!p) return square;
  const key = `${p.color}${p.type}`;
  return PIECE_SYMBOLS[key] ?? p.type.toUpperCase();
}

/** Verifica se la casa `sq` è attaccata da almeno un pezzo del colore dato. */
function isSquareAttackedBy(game: Chess, square: Square, byColor: Color): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = (String.fromCharCode(97 + c) + (8 - r)) as Square;
      const p = game.get(sq);
      if (!p || p.color !== byColor) continue;
      const moves = game.moves({ square: sq, verbose: true });
      if (moves.some((m) => m.to === square)) return true;
    }
  }
  return false;
}

// ============================================================================
// Severità
// ============================================================================

function calcCpLoss(
  playedBy: "w" | "b",
  cpBefore: number | null,
  mateBefore: number | null,
  cpAfter: number | null,
  mateAfter: number | null
): number | null {
  if ((cpBefore == null && mateBefore == null) || (cpAfter == null && mateAfter == null)) {
    return null;
  }
  const sBefore = evalToScore(cpBefore, mateBefore);
  const sAfter = evalToScore(cpAfter, mateAfter);
  return playedBy === "w" ? sBefore - sAfter : sAfter - sBefore;
}

function evalToScore(cp: number | null, mate: number | null): number {
  if (mate != null) return mate > 0 ? 100_000 - mate : -100_000 - mate;
  if (cp != null) return cp;
  return 0;
}

function classifySeverity(cpLoss: number | null, isBestMove?: boolean): Severity {
  if (cpLoss == null) return "good";
  if (isBestMove) return "best";
  if (cpLoss < 50) return "good";
  if (cpLoss < 100) return "inaccuracy";
  if (cpLoss < 300) return "mistake";
  return "blunder";
}

// ============================================================================
// Detection tattica
// ============================================================================

function detectHangingPieces(game: Chess, attacker: Color): TacticalPattern[] {
  const defender: Color = attacker === "w" ? "b" : "w";
  const patterns: TacticalPattern[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = (String.fromCharCode(97 + c) + (8 - r)) as Square;
      const piece = game.get(sq);
      if (!piece || piece.color !== defender) continue;

      const isAttacked = isSquareAttackedBy(game, sq, attacker);
      if (!isAttacked) continue;

      const isDefended = isSquareAttackedBy(game, sq, defender);
      if (!isDefended) {
        patterns.push({
          type: "hanging_piece",
          actor: "",
          victims: [pieceLabel(sq, game)],
          squares: [sq],
          description: `${pieceLabel(sq, game)} in ${sq} è indifeso e attaccabile.`,
        });
      }
    }
  }

  patterns.sort((a, b) => {
    const pA = game.get(a.squares[0] as Square);
    const pB = game.get(b.squares[0] as Square);
    return (PIECE_VALUES[pB?.type ?? "p"] ?? 0) - (PIECE_VALUES[pA?.type ?? "p"] ?? 0);
  });

  return patterns.slice(0, 3);
}

function detectForks(game: Chess, attacker: Color): TacticalPattern[] {
  const defender: Color = attacker === "w" ? "b" : "w";
  const patterns: TacticalPattern[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = (String.fromCharCode(97 + c) + (8 - r)) as Square;
      const piece = game.get(sq);
      if (!piece || piece.color !== attacker) continue;

      const attacked: { sq: Square; piece: ReturnType<Chess["get"]> }[] = [];
      const moves = game.moves({ square: sq, verbose: true });

      for (const m of moves) {
        if (!m.captured) continue; // solo catture contano come minaccia
        const target = game.get(m.to);
        if (!target || target.color !== defender) continue;
        if (!attacked.some((a) => a.sq === m.to)) {
          attacked.push({ sq: m.to, piece: target });
        }
      }

      if (attacked.length >= 2) {
        const attackerValue = PIECE_VALUES[piece.type] ?? 0;
        const hasValuableVictim = attacked.some(
          (a) => (PIECE_VALUES[a.piece?.type ?? "p"] ?? 0) >= attackerValue
        );
        if (hasValuableVictim) {
          const victims = attacked.map((a) => pieceLabel(a.sq, game));
          patterns.push({
            type: "fork",
            actor: pieceLabel(sq, game),
            victims,
            squares: [sq, ...attacked.map((a) => a.sq)],
            description: `${pieceLabel(sq, game)} fa una forchetta: minaccia ${victims.join(" e ")}.`,
          });
        }
      }
    }
  }

  return patterns.slice(0, 2);
}

function detectPins(game: Chess, attacker: Color): TacticalPattern[] {
  const patterns: TacticalPattern[] = [];
  const dirs: [number, number][] = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = (String.fromCharCode(97 + c) + (8 - r)) as Square;
      const piece = game.get(sq);
      if (!piece || piece.color !== attacker) continue;
      if (piece.type !== "b" && piece.type !== "r" && piece.type !== "q") continue;

      for (const [dr, dc] of dirs) {
        if (piece.type === "r" && dr !== 0 && dc !== 0) continue;
        if (piece.type === "b" && (dr === 0 || dc === 0)) continue;

        let cr = r + dr;
        let cc = c + dc;
        let pinnedPiece: { sq: Square; piece: NonNullable<ReturnType<Chess["get"]>> } | null = null;

        while (cr >= 0 && cr < 8 && cc >= 0 && cc < 8) {
          const csq = (String.fromCharCode(97 + cc) + (8 - cr)) as Square;
          const cp = game.get(csq);
          if (!cp) { cr += dr; cc += dc; continue; }
          if (cp.color === attacker) break;

          if (!pinnedPiece) {
            pinnedPiece = { sq: csq, piece: cp };
            cr += dr;
            cc += dc;
            continue;
          }

          const behindValue = PIECE_VALUES[cp.type] ?? 0;
          const pinnedValue = PIECE_VALUES[pinnedPiece.piece.type] ?? 0;
          if (behindValue > pinnedValue || cp.type === "k") {
            const isAbsolute = cp.type === "k";
            patterns.push({
              type: isAbsolute ? "pin_absolute" : "pin_relative",
              actor: pieceLabel(sq, game),
              victims: [pieceLabel(pinnedPiece.sq, game)],
              squares: [sq, pinnedPiece.sq, csq],
              description: isAbsolute
                ? `${pieceLabel(sq, game)} inchioda ${pieceLabel(pinnedPiece.sq, game)} contro il Re — non può muoversi.`
                : `${pieceLabel(sq, game)} inchioda ${pieceLabel(pinnedPiece.sq, game)} contro ${pieceLabel(csq, game)}.`,
            });
          }
          break;
        }
      }
    }
  }

  return patterns.slice(0, 2);
}

function detectSkewers(game: Chess, attacker: Color): TacticalPattern[] {
  const patterns: TacticalPattern[] = [];
  const dirs: [number, number][] = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = (String.fromCharCode(97 + c) + (8 - r)) as Square;
      const piece = game.get(sq);
      if (!piece || piece.color !== attacker) continue;
      if (piece.type !== "b" && piece.type !== "r" && piece.type !== "q") continue;

      for (const [dr, dc] of dirs) {
        if (piece.type === "r" && dr !== 0 && dc !== 0) continue;
        if (piece.type === "b" && (dr === 0 || dc === 0)) continue;

        let cr = r + dr;
        let cc = c + dc;
        let frontPiece: { sq: Square; piece: NonNullable<ReturnType<Chess["get"]>> } | null = null;

        while (cr >= 0 && cr < 8 && cc >= 0 && cc < 8) {
          const csq = (String.fromCharCode(97 + cc) + (8 - cr)) as Square;
          const cp = game.get(csq);
          if (!cp) { cr += dr; cc += dc; continue; }
          if (cp.color === attacker) break;

          if (!frontPiece) {
            frontPiece = { sq: csq, piece: cp };
            cr += dr;
            cc += dc;
            continue;
          }

          const frontValue = PIECE_VALUES[frontPiece.piece.type] ?? 0;
          const backValue = PIECE_VALUES[cp.type] ?? 0;
          if (frontValue > backValue) {
            patterns.push({
              type: "skewer",
              actor: pieceLabel(sq, game),
              victims: [pieceLabel(frontPiece.sq, game), pieceLabel(csq, game)],
              squares: [sq, frontPiece.sq, csq],
              description: `Infilata: ${pieceLabel(sq, game)} attacca ${pieceLabel(frontPiece.sq, game)} che, muovendosi, lascia scoperto ${pieceLabel(csq, game)}.`,
            });
          }
          break;
        }
      }
    }
  }

  return patterns.slice(0, 2);
}

function detectMateThreat(game: Chess): TacticalPattern[] {
  const patterns: TacticalPattern[] = [];
  const moves = game.moves({ verbose: true });

  for (const m of moves) {
    const copy = new Chess(game.fen());
    try {
      copy.move({ from: m.from, to: m.to, promotion: (m.promotion || undefined) as PieceSymbol | undefined });
    } catch {
      continue;
    }
    if (copy.isCheckmate()) {
      const player = game.turn() === "w" ? "Il Bianco" : "Il Nero";
      patterns.push({
        type: "mate_threat",
        actor: "",
        victims: ["Re"],
        squares: [m.to],
        description: `${player} minaccia matto in 1 con ${m.san}.`,
      });
      break;
    }
  }
  return patterns;
}

function detectDoubleCheck(game: Chess): TacticalPattern[] {
  if (!game.isCheck()) return [];

  const turn = game.turn();
  const opponent: Color = turn === "w" ? "b" : "w";
  let checkCount = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = (String.fromCharCode(97 + c) + (8 - r)) as Square;
      const p = game.get(sq);
      if (!p || p.color !== opponent) continue;
      const moves = game.moves({ square: sq, verbose: true });
      for (const m of moves) {
        const target = game.get(m.to);
        if (target && target.type === "k" && target.color === turn) {
          checkCount++;
          break;
        }
      }
    }
  }

  if (checkCount >= 2) {
    return [{
      type: "double_check",
      actor: "",
      victims: ["Re"],
      squares: [],
      description: "Scacco doppio! Il Re è sotto scacco da due pezzi contemporaneamente.",
    }];
  }
  return [];
}

// ============================================================================
// API pubblica: detection
// ============================================================================

export function detectTactics(fen: string): TacticalPattern[] {
  const game = new Chess(fen);
  if (game.isGameOver()) return [];

  const turn = game.turn();
  const attacker: Color = turn === "w" ? "b" : "w";

  const patterns: TacticalPattern[] = [];
  patterns.push(...detectDoubleCheck(game));
  patterns.push(...detectForks(game, attacker));
  patterns.push(...detectPins(game, attacker));
  patterns.push(...detectSkewers(game, attacker));
  patterns.push(...detectHangingPieces(game, attacker));
  patterns.push(...detectMateThreat(game));
  return patterns;
}

// ============================================================================
// Template system
// ============================================================================

function uciToSan(fen: string, uci: string): string {
  try {
    const game = new Chess(fen);
    const move = game.move({
      from: uci.slice(0, 2) as Square,
      to: uci.slice(2, 4) as Square,
      promotion: uci.length > 4 ? (uci[4] as PieceSymbol) : undefined,
    });
    return move?.san ?? uci;
  } catch {
    return uci;
  }
}

function checkIsBestMove(fenBefore: string, bestUci: string | null, playedSan: string): boolean {
  if (!bestUci) return false;
  const bestSan = uciToSan(fenBefore, bestUci);
  const clean = (s: string) => s.replace(/[+#]$/, "");
  return clean(bestSan) === clean(playedSan);
}

function severityLabel(s: Severity): string {
  const map: Record<Severity, string> = {
    best: "Mossa eccellente",
    good: "Buona mossa",
    inaccuracy: "Imprecisione",
    mistake: "Errore",
blunder: "Errore grave!",
  };
  return map[s];
}

function severityBadge(s: Severity): string {
  const map: Record<Severity, string> = {
    best: "!!",
    good: "!",
    inaccuracy: "?!",
    mistake: "?",
    blunder: "??",
  };
  return map[s];
}

/** Etichetta del giocatore che ha mosso: nome PGN se disponibile, altrimenti "il Bianco"/"il Nero". */
function playerLabel(playedBy: "w" | "b", whiteName: string | null | undefined, blackName: string | null | undefined): string {
  if (playedBy === "w") return whiteName || "il Bianco";
  return blackName || "il Nero";
}

// ============================================================================
// Generatore principale
// ============================================================================

export async function explainMove(input: MoveExplanationInput): Promise<MoveExplanation> {
  return explainMoveRuleBased(input);
}

export function explainMoveRuleBased(input: MoveExplanationInput): MoveExplanation {
  const { beforeFen, playedMoveSan, playedBy, beforeEval, afterEval } = input;
  const player = playerLabel(playedBy, input.whiteName, input.blackName);

  const cpLoss = calcCpLoss(playedBy, beforeEval.cp, beforeEval.mate, afterEval.cp, afterEval.mate);
  const isBestMove = checkIsBestMove(beforeFen, beforeEval.bestMoveUci, playedMoveSan);
  const severity = classifySeverity(cpLoss, isBestMove);
  const tactics = detectTactics(input.afterFen);

  let stockfishExplains: string | null = null;
  if (beforeEval.bestMoveUci && severity !== "best") {
    const bestSan = uciToSan(beforeFen, beforeEval.bestMoveUci);
    stockfishExplains = stockfishExplanation(beforeFen, playedMoveSan, bestSan, beforeEval.bestMoveUci, tactics, player);
  }

  const summary = buildSummary(severity, playedMoveSan, cpLoss, tactics);
  const details = buildDetails(severity, playedMoveSan, playedBy, player, beforeFen, beforeEval, afterEval, tactics, stockfishExplains);

  return { summary, details, severity, tactics, stockfishExplains };
}

function buildSummary(severity: Severity, san: string, cpLoss: number | null, tactics: TacticalPattern[]): string {
  const badge = severityBadge(severity);
  const label = severityLabel(severity);
  const impact =
    cpLoss == null || severity === "best"
      ? ""
      : cpLoss >= 250
        ? ": la posizione peggiora molto"
        : cpLoss >= 120
          ? ": la posizione peggiora in modo importante"
          : cpLoss >= 50
            ? ": la posizione peggiora leggermente"
            : "";
  let sentence = `${badge} ${san} — ${label}${impact}.`;
  const fork = tactics.find((t) => t.type === "fork");
  if (fork && severity !== "best") sentence += ` Subisci una forchetta.`;
  const hanging = tactics.find((t) => t.type === "hanging_piece");
  if (hanging && severity === "blunder") sentence += ` ${hanging.description}`;
  return sentence;
}

function buildDetails(
  severity: Severity,
  playedSan: string,
  _playedBy: "w" | "b",
  player: string,
  _beforeFen: string,
  beforeEval: MoveExplanationInput["beforeEval"],
  afterEval: MoveExplanationInput["afterEval"],
  tactics: TacticalPattern[],
  stockfishExplains: string | null
): string[] {
  const details: string[] = [];

  switch (severity) {
    case "blunder":
      details.push(`${player} perde molto vantaggio.`);
      if (tactics.length > 0) {
        details.push("La posizione ora contiene debolezze tattiche:");
        for (const t of tactics.slice(0, 3)) details.push(`• ${t.description}`);
      }
      if (stockfishExplains) details.push(stockfishExplains);
      break;
    case "mistake":
details.push(`${player} concede un vantaggio importante.`);
      if (stockfishExplains) details.push(stockfishExplains);
      for (const t of tactics.slice(0, 2)) details.push(`• ${t.description}`);
      break;
    case "inaccuracy":
details.push(`Piccola imprecisione di ${player}: la posizione peggiora leggermente.`);
      if (stockfishExplains) details.push(stockfishExplains);
      break;
    case "good": {
      const bestSan = beforeEval.bestMoveUci ? uciToSan(_beforeFen, beforeEval.bestMoveUci) : null;
      if (bestSan && bestSan === playedSan) {
        details.push(`${player} ha trovato la continuazione piu precisa.`);
      } else {
        details.push(`Mossa solida di ${player}, vicina alla continuazione piu precisa.`);
      }
      }
      for (const t of tactics.slice(0, 2)) details.push(`• ${t.description}`);
      break;
    case "best":
details.push(`${player} ha giocato la continuazione piu precisa.`);
      for (const t of tactics.slice(0, 3)) details.push(`• ${t.description}`);
      break;
  }

  if (afterEval.mate != null) {
    const who = afterEval.mate > 0 ? "Bianco" : "Nero";
    details.push(`Matto in ${Math.abs(afterEval.mate)} per il ${who} (profondità ${afterEval.depth}).`);
  }
  return details;
}

function stockfishExplanation(
  beforeFen: string,
  playedSan: string,
  bestSan: string,
  bestUci: string,
tactics: TacticalPattern[],
  player: string
): string {
  let materialNote = "";
  try {
    const gamePlayed = new Chess(beforeFen);
    gamePlayed.move(playedSan);
    const matPlayed = countMaterial(gamePlayed);

    const gameBest = new Chess(beforeFen);
    gameBest.move({
      from: bestUci.slice(0, 2) as Square,
      to: bestUci.slice(2, 4) as Square,
      promotion: bestUci.length > 4 ? (bestUci[4] as PieceSymbol) : undefined,
    });
    const matBest = countMaterial(gameBest);

    if (matPlayed < matBest) {
materialNote = ` Con ${bestSan} ${player} avrebbe mantenuto ${matBest} punti materiale anziché ${matPlayed}.`;
    }
  } catch {
    // mossa non legale: ignoriamo
  }

  const reasons: string[] = [];
  reasons.push(`Stockfish suggeriva ${bestSan}.`);
  if (materialNote) reasons.push(materialNote.trim());

  const missed = tactics.filter((t) => t.type === "hanging_piece" || t.type === "fork").slice(0, 1);
  if (missed.length > 0) {
reasons.push(`Con ${bestSan} ${player} avrebbe evitato: ${missed[0].description}`);
  }
  return reasons.join(" ");
}

function countMaterial(game: Chess): number {
  let total = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = (String.fromCharCode(97 + c) + (8 - r)) as Square;
      const p = game.get(sq);
      if (p && p.type !== "k") total += PIECE_VALUES[p.type] ?? 0;
    }
  }
  return total;
}

// ============================================================================
// Batch
// ============================================================================

export interface BatchExplainInput {
  startFen: string;
  moves: Array<{
    san: string;
    fen: string;
    evalCp: number | null;
    evalMate: number | null;
  }>;
  boardEval: {
    cp: number | null;
    mate: number | null;
    depth: number;
    bestMoveUci: string | null;
  };
/** Nome del giocatore Bianco (da PGN), o null se sconosciuto. */
  whiteName?: string | null;
  /** Nome del giocatore Nero (da PGN), o null se sconosciuto. */
  blackName?: string | null;
}

export async function batchExplain(input: BatchExplainInput): Promise<MoveExplanation[]> {
  return batchExplainRuleBased(input);
}

function batchExplainRuleBased(input: BatchExplainInput): MoveExplanation[] {
  const { startFen, moves, boardEval } = input;
  const explanations: MoveExplanation[] = [];

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const playedBy: "w" | "b" = i % 2 === 0 ? "w" : "b";
    const beforeFen = i === 0 ? startFen : moves[i - 1].fen;

    const beforeEval = i === 0
      ? boardEval
      : { cp: moves[i - 1].evalCp, mate: moves[i - 1].evalMate, depth: boardEval.depth, bestMoveUci: null as string | null };

    const afterEval = { cp: move.evalCp, mate: move.evalMate, depth: boardEval.depth };

    explanations.push(
      explainMoveRuleBased({
        beforeFen,
        afterFen: move.fen,
        playedMoveSan: move.san,
        playedBy,
        whiteName: input.whiteName ?? null,
        blackName: input.blackName ?? null,
        beforeEval: { cp: beforeEval.cp, mate: beforeEval.mate, depth: beforeEval.depth, bestMoveUci: beforeEval.bestMoveUci },
        afterEval,
      })
    );
  }

  return explanations;
}

// ============================================================================
// Game analysis (one-shot)
// ============================================================================

export interface GameAnalysisArgs {
  whiteName: string | null;
  blackName: string | null;
  result: string | null;
  moves: Array<{
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
    evalDropCp: number;
    classification: string;
    bestSan: string | null;
    bestMoveLan: string | null;
    stockfishComment: string | null;
    diagnosis: Diagnosis;
  }>;
  keySwings: string[];
}

export interface GameAnalysisMoveComment {
  index: number;
  comment: string;
  source?: "diagnosis_fallback" | "stockfish_fallback" | string;
}

export interface GameAnalysisResult {
  overview: string;
  judgment: string;
  moveComments: GameAnalysisMoveComment[];
  source?: "stockfish" | "fallback" | string;
}

export async function analyzeGame(input: GameAnalysisArgs): Promise<GameAnalysisResult> {
  const comments = input.moves
    .filter((move) => move.classification === "ERRORE" || move.classification === "ERRORE GRAVE")
    .map((move) => ({
      index: move.index,
      comment: buildGameMoveComment(move),
      source: move.stockfishComment ? "stockfish_fallback" : "diagnosis_fallback",
    }));

  return {
    overview: buildGameOverview(input),
    judgment: buildGameJudgment(input),
    moveComments: comments,
    source: "stockfish",
  };
}

function buildGameOverview(input: GameAnalysisArgs): string {
  const white = input.whiteName || "il Bianco";
  const black = input.blackName || "il Nero";
  const result = input.result ? ` Risultato: ${input.result}.` : "";
  const criticalMoves = input.moves.filter(
    (move) => move.classification === "ERRORE" || move.classification === "ERRORE GRAVE",
  );

  if (criticalMoves.length === 0) {
    return `${white} e ${black} hanno giocato senza errori gravi rilevati da Stockfish.${result}`;
  }

  return `${white} e ${black} hanno giocato una partita con ${criticalMoves.length} momenti critici rilevati da Stockfish.${result}`;
}

function buildGameJudgment(input: GameAnalysisArgs): string {
  if (input.keySwings.length > 0) {
    return input.keySwings.slice(0, 3).join(" ");
  }

  const severeCount = input.moves.filter((move) => move.classification === "ERRORE GRAVE").length;
  const errorCount = input.moves.filter((move) => move.classification === "ERRORE").length;

  if (severeCount > 0) {
    return `Il punto principale sono ${severeCount} errori gravi: conviene rivedere quelle posizioni prima di studiare il resto.`;
  }
  if (errorCount > 0) {
    return `La partita contiene ${errorCount} errori: concentrati sulle alternative indicate da Stockfish.`;
  }
  return "La partita non mostra svolte critiche nei dati analizzati.";
}

function buildGameMoveComment(move: GameAnalysisArgs["moves"][number]): string {
  const stockfishText = expandChessSymbols(move.stockfishComment);
  const best = move.bestSan ? ` Una continuazione migliore era ${move.bestSan}.` : "";
  const why = stockfishText ? ` ${stockfishText}` : "";

  return `${move.classification} alla mossa ${move.moveNumber}: ${move.san}.${best}${why}`.trim();
}
