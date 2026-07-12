import { describe, expect, it, vi } from "vitest";

import {
  evalScore,
  findCriticalPositionIndexes,
  formatEval,
  moveClassification,
  runAdaptiveAnalysis,
  type AnalyzeOptions,
  type PositionEval,
} from "@/services/analysisService";

function positionEval(fen: string, scoreCp: number, depth = 15): PositionEval {
  return {
    fen,
    depth,
    scoreCp,
    scoreMate: null,
    bestMoveUci: null,
  };
}

describe("analysisService eval helpers", () => {
  it("formats centipawn and mate evaluations for display", () => {
    expect(formatEval(120, null)).toBe("+1.2");
    expect(formatEval(-35, null)).toBe("-0.3");
    expect(formatEval(null, 3)).toBe("M3");
    expect(formatEval(null, -5)).toBe("-M5");
  });

  it("classifies move quality from centipawn loss", () => {
    expect(moveClassification(10)).toMatchObject({ label: "!" });
    expect(moveClassification(80)).toMatchObject({ label: "?!" });
    expect(moveClassification(180)).toMatchObject({ label: "?" });
    expect(moveClassification(350)).toMatchObject({ label: "??" });
  });

  it("makes a shorter forced mate substantially better than a longer one", () => {
    expect(evalScore(null, 1) - evalScore(null, 5)).toBeGreaterThanOrEqual(300);
    expect(evalScore(null, -5) - evalScore(null, -1)).toBeGreaterThanOrEqual(300);
  });
});

describe("adaptive Stockfish analysis", () => {
  it("selects and deduplicates both sides of critical moves", () => {
    const evals = [
      positionEval("p0", 20),
      positionEval("p1", -40), // White loses 60: critical.
      positionEval("p2", 30),  // Black loses 70: critical.
      positionEval("p3", 10),  // White loses 20: not critical.
    ];

    expect(findCriticalPositionIndexes(evals)).toEqual([0, 1, 2]);
  });

  it("uses the FEN side to move for games that start with Black", () => {
    const evals = [
      positionEval("8/8/8/8/8/8/8/8 b - - 0 1", 80),
      positionEval("8/8/8/8/8/8/8/8 w - - 1 2", 150),
    ];

    expect(findCriticalPositionIndexes(evals)).toEqual([0, 1]);
  });

  it("refines critical positions at depth +5 with MultiPV 1", async () => {
    const shallow = [
      positionEval("p0", 20),
      positionEval("p1", -40),
      positionEval("p2", -30),
    ];
    const deep = [
      positionEval("p0", 10, 20),
      positionEval("p1", -20, 20),
    ];
    const analyzeBatch = vi
      .fn<(fens: string[], options?: AnalyzeOptions) => Promise<PositionEval[]>>()
      .mockResolvedValueOnce(shallow)
      .mockResolvedValueOnce(deep);

    const result = await runAdaptiveAnalysis(
      ["p0", "p1", "p2"],
      { stockfish_depth: 15, stockfish_threads: 2 },
      {},
      analyzeBatch,
    );

    expect(analyzeBatch).toHaveBeenNthCalledWith(
      1,
      ["p0", "p1", "p2"],
      expect.objectContaining({ depth: 15, threads: 2, multipv: 1 }),
    );
    expect(analyzeBatch).toHaveBeenNthCalledWith(
      2,
      ["p0", "p1"],
      expect.objectContaining({ depth: 20, threads: 2, multipv: 1 }),
    );
    expect(result).toEqual([deep[0], deep[1], shallow[2]]);
  });

  it("does not start a deep batch when every move is stable", async () => {
    const shallow = [positionEval("p0", 10), positionEval("p1", 0)];
    const analyzeBatch = vi.fn().mockResolvedValue(shallow);

    await runAdaptiveAnalysis(
      ["p0", "p1"],
      { stockfish_depth: 15, stockfish_threads: 2 },
      {},
      analyzeBatch,
    );

    expect(analyzeBatch).toHaveBeenCalledTimes(1);
  });
});
