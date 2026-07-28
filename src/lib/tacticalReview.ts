import { tacticalPatternKey } from "@/lib/tacticalPatterns";
import type { TacticalPattern, TacticalReviewState } from "@/types";

export interface TacticalReviewMoment {
  moveIndex: number;
  state: TacticalReviewState;
  tacticKey: string;
}

export interface TacticalReview {
  moments: TacticalReviewMoment[];
  summary: {
    training: number;
    positives: number;
  };
}

const STATE_PRIORITY: Record<TacticalReviewState, number> = {
  missed: 0,
  conceded: 1,
  found: 2,
};

export function buildTacticalReview(
  patternsByMove: TacticalPattern[][],
): TacticalReview {
  const moments = patternsByMove.flatMap((patterns, moveIndex) => {
    const pattern = [...patterns].sort(
      (left, right) =>
        STATE_PRIORITY[left.state] - STATE_PRIORITY[right.state],
    )[0];
    return pattern
      ? [{
          moveIndex,
          state: pattern.state,
          tacticKey: tacticalPatternKey(pattern),
        }]
      : [];
  }).sort(
    (left, right) =>
      STATE_PRIORITY[left.state] - STATE_PRIORITY[right.state] ||
      left.moveIndex - right.moveIndex,
  );

  const patterns = patternsByMove.flat();
  return {
    moments,
    summary: {
      training: patterns.filter(
        (pattern) =>
          pattern.state === "missed" || pattern.state === "conceded",
      ).length,
      positives: patterns.filter((pattern) => pattern.state === "found").length,
    },
  };
}
