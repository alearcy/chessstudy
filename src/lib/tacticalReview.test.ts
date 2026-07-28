import { describe, expect, it } from "vitest";

import { buildTacticalReview } from "@/lib/tacticalReview";
import { tacticalPatternKey } from "@/lib/tacticalPatterns";
import type { TacticalPattern } from "@/types";

function pattern(
  state: TacticalPattern["state"],
  type: TacticalPattern["type"],
  squares: string[],
): TacticalPattern {
  return {
    state,
    type,
    actor: "cavallo",
    victims: ["donna"],
    squares,
    description: "Pattern tattico.",
    ...(state === "missed"
      ? {
          alternative: {
            moveSan: "Cc7+",
            fen: "7k/2N5/8/8/8/8/8/4K3 b - - 1 1",
          },
        }
      : {}),
  };
}

describe("buildTacticalReview", () => {
  it("ordina mancate, concesse e trovate mantenendo la cronologia", () => {
    const found = pattern("found", "fork", ["d5", "c7", "f6"]);
    const concededLate = pattern("conceded", "skewer", ["a4", "e8", "h3"]);
    const missed = pattern("missed", "double_check", ["c7", "e8"]);
    const concededEarly = pattern("conceded", "mate_threat", ["h5", "f7"]);

    const review = buildTacticalReview([
      [found],
      [concededLate],
      [missed],
      [concededEarly],
    ]);

    expect(review.moments).toEqual([
      {
        moveIndex: 2,
        state: "missed",
        tacticKey: tacticalPatternKey(missed),
      },
      {
        moveIndex: 1,
        state: "conceded",
        tacticKey: tacticalPatternKey(concededLate),
      },
      {
        moveIndex: 3,
        state: "conceded",
        tacticKey: tacticalPatternKey(concededEarly),
      },
      {
        moveIndex: 0,
        state: "found",
        tacticKey: tacticalPatternKey(found),
      },
    ]);
    expect(review.summary).toEqual({
      training: 3,
      positives: 1,
    });
  });

  it("sceglie sulla stessa mossa lo stato più istruttivo ma conta tutti i pattern", () => {
    const found = pattern("found", "fork", ["d5", "c7", "f6"]);
    const conceded = pattern("conceded", "skewer", ["a4", "e8", "h3"]);
    const missed = pattern("missed", "double_check", ["c7", "e8"]);

    const review = buildTacticalReview([[found, conceded, missed]]);

    expect(review.moments).toEqual([
      {
        moveIndex: 0,
        state: "missed",
        tacticKey: tacticalPatternKey(missed),
      },
    ]);
    expect(review.summary).toEqual({
      training: 2,
      positives: 1,
    });
  });
});
