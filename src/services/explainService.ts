import { Chess, Square, PieceSymbol, Color } from "chess.js";
import type { MoveExplanationInput, MoveExplanation, TacticalPattern, Severity } from "@/types";

/** Verifica se l'LLM nativo è disponibile. */
async function isLlmReady(): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const status = await invoke<{ ready: boolean }>("llm_status");
    console.log("[LLM] isLlmReady: status =", status);
    return status.ready;
  } catch (e) {
    console.log("[LLM] isLlmReady: error =", e);
    return false;
  }
}
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

function formatCpLoss(cpLoss: number | null): string {
  if (cpLoss == null) return "";
  return `${(cpLoss / 100).toFixed(1)} pedoni`;
}

/** Etichetta del giocatore che ha mosso: nome PGN se disponibile, altrimenti "il Bianco"/"il Nero". */
function playerLabel(playedBy: "w" | "b", whiteName: string | null | undefined, blackName: string | null | undefined): string {
  if (playedBy === "w") return whiteName || "il Bianco";
  return blackName || "il Nero";
}

// ============================================================================
// Generatore principale
// ============================================================================

/** Formato restituito dal comando Rust `generate_commentary` (serde). */
interface NativeCommentary {
  summary: string;
  details: string;
  severity: string;
}

function nativeSeverityToType(s: string): Severity {
  const map: Record<string, Severity> = {
    best: "best",
    good: "good",
    inaccuracy: "inaccuracy",
    mistake: "mistake",
    blunder: "blunder",
  };
  return map[s] ?? "good";
}

async function explainMoveNative(input: MoveExplanationInput): Promise<MoveExplanation> {
  const { invoke } = await import("@tauri-apps/api/core");
  const bestSan = input.beforeEval.bestMoveUci
    ? uciToSan(input.beforeFen, input.beforeEval.bestMoveUci)
    : null;

  const result = await invoke<NativeCommentary>("generate_commentary", {
    args: {
      fen_before: input.beforeFen,
      fen_after: input.afterFen,
      played_san: input.playedMoveSan,
      played_by: input.playedBy,
      white_name: input.whiteName ?? null,
      black_name: input.blackName ?? null,
      eval_cp: input.beforeEval.cp,
      eval_mate: input.beforeEval.mate,
      eval_depth: input.beforeEval.depth,
      after_eval_cp: input.afterEval.cp,
      after_eval_mate: input.afterEval.mate,
      best_move_san: bestSan,
    },
  });

  return {
    summary: result.summary,
    details: [result.details],
    severity: nativeSeverityToType(result.severity),
    tactics: [],
    stockfishExplains: null,
  };
}

export async function explainMove(input: MoveExplanationInput): Promise<MoveExplanation> {
  if (await isLlmReady()) {
    try {
      const exp = await explainMoveNative(input);
      console.log("[LLM] commento generato:", exp.summary);
      return exp;
    } catch (e) {
      console.error("[LLM] fallback a rule-based:", e);
    }
  } else {
    console.log("[LLM] non disponibile, uso rule-based");
  }
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
  const details = buildDetails(severity, playedMoveSan, playedBy, player, cpLoss, beforeFen, beforeEval, afterEval, tactics, stockfishExplains);

  return { summary, details, severity, tactics, stockfishExplains };
}

function buildSummary(severity: Severity, san: string, cpLoss: number | null, tactics: TacticalPattern[]): string {
  const badge = severityBadge(severity);
  const label = severityLabel(severity);
  const lossStr = cpLoss != null ? ` (-${formatCpLoss(cpLoss)})` : "";
  let sentence = `${badge} ${san} — ${label}${lossStr}.`;
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
  cpLoss: number | null,
  _beforeFen: string,
  beforeEval: MoveExplanationInput["beforeEval"],
  afterEval: MoveExplanationInput["afterEval"],
  tactics: TacticalPattern[],
  stockfishExplains: string | null
): string[] {
  const details: string[] = [];

  switch (severity) {
    case "blunder":
      details.push(`${player} perde ${formatCpLoss(cpLoss!)} di vantaggio.`);
      if (tactics.length > 0) {
        details.push("La posizione ora contiene debolezze tattiche:");
        for (const t of tactics.slice(0, 3)) details.push(`• ${t.description}`);
      }
      if (stockfishExplains) details.push(stockfishExplains);
      break;
    case "mistake":
details.push(`${player} cede ${formatCpLoss(cpLoss)}.`);
      if (stockfishExplains) details.push(stockfishExplains);
      for (const t of tactics.slice(0, 2)) details.push(`• ${t.description}`);
      break;
    case "inaccuracy":
details.push(`Piccola imprecisione di ${player}: ${formatCpLoss(cpLoss)} di svantaggio.`);
      if (stockfishExplains) details.push(stockfishExplains);
      break;
    case "good": {
      const bestSan = beforeEval.bestMoveUci ? uciToSan(_beforeFen, beforeEval.bestMoveUci) : null;
      if (bestSan && bestSan === playedSan) {
        details.push(`${player} ha giocato la mossa migliore secondo Stockfish.`);
      } else {
        details.push(`Mossa solida di ${player}, vicina all'ottimale (solo -${formatCpLoss(cpLoss)}).`);
      }
      }
      for (const t of tactics.slice(0, 2)) details.push(`• ${t.description}`);
      break;
    case "best":
details.push(`${player} ha giocato la mossa esattamente corrispondente alla prima scelta di Stockfish.`);
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
  if (await isLlmReady()) {
    try {
      return await batchExplainNative(input);
    } catch {
      // Fallback a rule-based.
    }
  }
  return batchExplainRuleBased(input);
}

async function batchExplainNative(input: BatchExplainInput): Promise<MoveExplanation[]> {
  const { invoke } = await import("@tauri-apps/api/core");
  const { startFen, moves, boardEval } = input;

  const batchMoves = moves.map((move, i) => {
    const playedBy = i % 2 === 0 ? "w" : "b";
    const beforeFen = i === 0 ? startFen : moves[i - 1].fen;
    const bestSan = i === 0 && boardEval.bestMoveUci
      ? uciToSan(beforeFen, boardEval.bestMoveUci)
      : null;

    return {
      fen_before: beforeFen,
      fen_after: move.fen,
      played_san: move.san,
      played_by: playedBy,
      white_name: input.whiteName ?? null,
      black_name: input.blackName ?? null,
      eval_cp: i === 0 ? boardEval.cp : moves[i - 1].evalCp,
      eval_mate: i === 0 ? boardEval.mate : moves[i - 1].evalMate,
      eval_depth: boardEval.depth,
      after_eval_cp: move.evalCp,
      after_eval_mate: move.evalMate,
      best_move_san: bestSan,
    };
  });

  const results = await invoke<NativeCommentary[]>("generate_batch_commentary", {
    args: {
      moves: batchMoves,
    },
  });

  return results.map((r) => ({
    summary: r.summary,
    details: [r.details],
    severity: nativeSeverityToType(r.severity),
    tactics: [],
    stockfishExplains: null,
  }));
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
    san: string;
    player: string;
    evalBefore: string;
    evalAfter: string;
    classification: string;
    bestSan: string | null;
  }>;
  keySwings: string[];
}

export interface GameAnalysisMoveComment {
  index: number;
  comment: string;
}

export interface GameAnalysisResult {
  overview: string;
  judgment: string;
  moveComments: GameAnalysisMoveComment[];
}

export async function analyzeGame(input: GameAnalysisArgs): Promise<GameAnalysisResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  const result = await invoke<{
    overview: string;
    judgment: string;
    moveComments: GameAnalysisMoveComment[];
  }>("generate_game_analysis", { args: input });
  return result;
}
