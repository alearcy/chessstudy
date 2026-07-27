import { describe, expect, it } from "vitest";

import {
  tacticalPatternColor,
  tacticalPatternKey,
  tacticalPatternLabel,
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
    expect(tacticalPatternColor(0)).toBe("#0284c7");
    expect(tacticalPatternColor(1)).toBe("#c026d3");
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
