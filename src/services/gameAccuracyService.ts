import type {
  EvaluatedMove,
  EvaluationPosition,
} from "@/services/moveAnnotationService";

export interface PlayerAccuracies {
  white: number | null;
  black: number | null;
}

const WIN_CHANCE_FACTOR = 0.00368208;
const ACCURACY_SCALE = 103.1668;
const ACCURACY_DECAY = 0.04354;
const ACCURACY_OFFSET = 3.1669;

function hasEvaluation(position: EvaluationPosition): boolean {
  return position.evalCp != null || position.evalMate != null;
}

function whiteWinChance(position: EvaluationPosition): number {
  if (position.evalMate != null) return position.evalMate > 0 ? 100 : 0;

  const cp = position.evalCp ?? 0;
  return 50 + 50 * (2 / (1 + Math.exp(-WIN_CHANCE_FACTOR * cp)) - 1);
}

function accuracyFromWinChanceLoss(loss: number): number {
  const accuracy =
    ACCURACY_SCALE * Math.exp(-ACCURACY_DECAY * Math.max(0, loss)) -
    ACCURACY_OFFSET;
  return Math.min(100, Math.max(0, accuracy));
}

function meanRounded(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function calculatePlayerAccuracies(
  start: EvaluationPosition,
  moves: readonly EvaluatedMove[],
): PlayerAccuracies {
  if (!hasEvaluation(start) || moves.some((evaluatedMove) => !hasEvaluation(evaluatedMove))) {
    return { white: null, black: null };
  }

  const whiteMoves: number[] = [];
  const blackMoves: number[] = [];
  let before = start;

  moves.forEach((evaluatedMove, moveIndex) => {
    const beforeWhiteChance = whiteWinChance(before);
    const afterWhiteChance = whiteWinChance(evaluatedMove);
    const loss =
      moveIndex % 2 === 0
        ? beforeWhiteChance - afterWhiteChance
        : afterWhiteChance - beforeWhiteChance;
    const accuracy = accuracyFromWinChanceLoss(loss);

    if (moveIndex % 2 === 0) whiteMoves.push(accuracy);
    else blackMoves.push(accuracy);
    before = evaluatedMove;
  });

  return {
    white: meanRounded(whiteMoves),
    black: meanRounded(blackMoves),
  };
}
