import { Chess } from "chess.js";

import {
  evalScore,
  moveClassification,
  sanMovesMatch,
  type MoveBadge,
} from "@/services/analysisService";

export interface EvaluationPosition {
  fen: string;
  evalCp?: number | null;
  evalMate?: number | null;
  evalBestMoveUci?: string | null;
}

export interface EvaluatedMove extends EvaluationPosition {
  moveNotation: string;
}

export interface MoveAnnotation {
  cpLoss: number | null;
  isBestMove: boolean;
  badge: MoveBadge | null;
}

function hasEvaluation(position: EvaluationPosition): boolean {
  return position.evalCp != null || position.evalMate != null;
}

function isPlayedBestMove(
  move: EvaluatedMove,
  before: EvaluationPosition,
): boolean {
  if (!before.evalBestMoveUci) return false;
  try {
    const chess = new Chess(before.fen);
    const bestMove = chess.move(before.evalBestMoveUci);
    return sanMovesMatch(move.moveNotation, bestMove.san);
  } catch {
    return false;
  }
}

export function classifyMoveAtIndex(
  start: EvaluationPosition,
  moves: readonly EvaluatedMove[],
  moveIndex: number,
): MoveAnnotation | null {
  const move = moves[moveIndex];
  if (!move) return null;

  const before = moveIndex === 0 ? start : moves[moveIndex - 1];
  const isBestMove = isPlayedBestMove(move, before);
  const cpLoss =
    hasEvaluation(before) && hasEvaluation(move)
      ? moveIndex % 2 === 0
        ? evalScore(before.evalCp ?? null, before.evalMate ?? null) -
          evalScore(move.evalCp ?? null, move.evalMate ?? null)
        : evalScore(move.evalCp ?? null, move.evalMate ?? null) -
          evalScore(before.evalCp ?? null, before.evalMate ?? null)
      : null;

  return {
    cpLoss,
    isBestMove,
    badge: moveClassification(cpLoss, isBestMove),
  };
}
