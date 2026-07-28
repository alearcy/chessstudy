import { describe, expect, it } from "vitest";

import {
  tacticalPatternColor,
  tacticalAlternativeForSelection,
  tacticalAlternativeMoveSquares,
  tacticalPatternKey,
  tacticalPatternLabel,
  tacticalReviewStateLabel,
  tacticalPatternsFromJson,
} from "@/lib/tacticalPatterns";
import type { TacticalPattern } from "@/types";

const fork: TacticalPattern = {
  type: "fork",
  state: "found",
  actor: "cavallo bianco in d5",
  victims: ["torre nera in c7", "donna nera in f6"],
  squares: ["d5", "c7", "f6"],
  description: "Il cavallo crea una forchetta.",
};

describe("tactical pattern presentation", () => {
  it("uses stable keys, Italian labels and distinct colors", () => {
    expect(tacticalPatternKey(fork)).toBe("found:fork:c7,d5,f6");
    expect(tacticalPatternLabel(fork.type)).toBe("Forchetta");
    expect(tacticalReviewStateLabel(fork.state)).toBe("Trovata");
    expect(tacticalPatternColor("fork")).toBe("#0284c7");
    expect(tacticalPatternColor("pin_absolute")).toBe("#c026d3");
    expect(tacticalPatternColor("pin_relative")).toBe("#c026d3");
  });

  it("returns an alternative only when the selected tactic is missed", () => {
    const missed = {
      ...fork,
      state: "missed",
      alternative: {
        moveSan: "Nd5",
        fen: "7k/2r5/5q2/3N4/8/8/7P/4K3 b - - 1 1",
      },
    } satisfies TacticalPattern;

    expect(
      tacticalAlternativeForSelection(
        [fork, missed],
        tacticalPatternKey(missed),
      ),
    ).toEqual(missed.alternative);
    expect(
      tacticalAlternativeForSelection(
        [fork, missed],
        tacticalPatternKey(fork),
      ),
    ).toBeNull();
    expect(
      tacticalAlternativeMoveSquares(
        "7k/2r5/5q2/8/8/2N5/7P/4K3 w - - 0 1",
        missed.alternative,
      ),
    ).toEqual({ from: "c3", to: "d5" });
  });

  it("accepts valid persisted patterns and rejects malformed entries", () => {
    expect(tacticalPatternsFromJson([fork])).toEqual([fork]);
    expect(tacticalPatternsFromJson([
      fork,
      { ...fork, state: "unknown" },
      {
        ...fork,
        state: "missed",
        alternative: { moveSan: "Nd5", fen: "not-a-fen" },
      },
      { ...fork, squares: ["not-a-square"] },
      { ...fork, type: "unknown" },
    ])).toEqual([fork]);
    expect(tacticalPatternsFromJson(null)).toEqual([]);
  });

  it("accepts a complete missed alternative and ignores legacy patterns without state", () => {
    const missed = {
      ...fork,
      state: "missed",
      alternative: {
        moveSan: "Nd5",
        fen: "7k/2r5/5q2/3N4/8/8/7P/4K3 b - - 1 1",
      },
    } as const;
    const { state: _state, ...legacy } = fork;

    expect(tacticalPatternsFromJson([missed, legacy])).toEqual([missed]);
  });
});
