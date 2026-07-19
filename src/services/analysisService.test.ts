import { describe, expect, it, vi } from "vitest";

import {
  buildStockfishCommands,
  evalScore,
  findCriticalPositionIndexes,
  formatEval,
  moveClassification,
  parseStockfishEvaluation,
  prepareStockfishEngine,
  runAdaptiveAnalysis,
  selectStockfishRuntime,
  StockfishEngine,
  stockfishCommentForMove,
  evalToWhiteShare,
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

  it.each([
    { moveNotation: "Rf5+", cpLoss: 350 },
    { moveNotation: "e2", cpLoss: 80 },
  ])(
    "keeps the Stockfish comment consistent with the best-move badge for $moveNotation",
    ({ moveNotation, cpLoss }) => {
      const comment = stockfishCommentForMove({
        moveNotation,
        cpLoss,
        bestSan: moveNotation,
        isBestMove: true,
      });

      expect(comment).toContain("mossa migliore");
      expect(comment).toContain("coincide con la scelta principale");
      expect(comment).not.toMatch(/imprecisione|errore|peggiora/i);
    },
  );

  it("makes a shorter forced mate substantially better than a longer one", () => {
    expect(evalScore(null, 1) - evalScore(null, 5)).toBeGreaterThanOrEqual(300);
    expect(evalScore(null, -5) - evalScore(null, -1)).toBeGreaterThanOrEqual(300);
  });

  it("maps evaluations to the same bounded white share used by visual analysis", () => {
    expect(evalToWhiteShare(null, null)).toBe(50);
    expect(evalToWhiteShare(0, null)).toBe(50);
    expect(evalToWhiteShare(300, null)).toBe(75);
    expect(evalToWhiteShare(600, null)).toBe(100);
    expect(evalToWhiteShare(-600, null)).toBe(0);
    expect(evalToWhiteShare(null, 3)).toBe(100);
    expect(evalToWhiteShare(null, -3)).toBe(0);
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

describe("Stockfish 18 web runtime", () => {
  it("selects the multi-threaded lite worker only in an isolated browser", () => {
    expect(selectStockfishRuntime({
      crossOriginIsolated: true,
      hasSharedArrayBuffer: true,
      hardwareConcurrency: 8,
    }, 4)).toMatchObject({
      flavor: "multi",
      threads: 4,
      compatibilityMode: false,
      workerUrl: expect.stringContaining("stockfish-18-lite.js"),
    });
  });

  it("forces the single-threaded fallback when isolation is unavailable", () => {
    expect(selectStockfishRuntime({
      crossOriginIsolated: false,
      hasSharedArrayBuffer: true,
      hardwareConcurrency: 8,
    }, 4)).toMatchObject({
      flavor: "single",
      threads: 1,
      compatibilityMode: true,
      workerUrl: expect.stringContaining("stockfish-18-lite-single.js"),
    });
  });

  it("builds clamped UCI commands including Threads and MultiPV", () => {
    const runtime = selectStockfishRuntime({
      crossOriginIsolated: true,
      hasSharedArrayBuffer: true,
      hardwareConcurrency: 8,
    }, 99);

    expect(buildStockfishCommands("start-fen", 99, 1, runtime)).toEqual([
      "setoption name Threads value 8",
      "setoption name MultiPV value 1",
      "position fen start-fen",
      "go depth 30",
    ]);
  });

  it.each([
    {
      fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
      lines: [
        "info depth 18 score cp 42 nodes 1000",
        "bestmove a1b1",
      ],
      expected: {
        depth: 18,
        scoreCp: 42,
        scoreMate: null,
        bestMoveUci: "a1b1",
      },
    },
    {
      fen: "8/8/8/8/8/8/8/K6k b - - 0 1",
      lines: [
        "info depth 21 score mate 3 nodes 2000",
        "bestmove h1g1",
      ],
      expected: {
        depth: 21,
        scoreCp: null,
        scoreMate: -3,
        bestMoveUci: "h1g1",
      },
    },
    {
      fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
      lines: ["bestmove (none)"],
      expected: {
        depth: 0,
        scoreCp: null,
        scoreMate: null,
        bestMoveUci: null,
      },
    },
  ])("parses cp, mate and bestmove from White's POV", ({ fen, lines, expected }) => {
    expect(parseStockfishEvaluation(fen, lines)).toMatchObject(expected);
  });

  it("rejects worker initialization errors instead of waiting forever", async () => {
    const worker = {
      onmessage: null,
      onerror: null,
      postMessage: vi.fn(),
      terminate: vi.fn(),
    };
    const runtime = selectStockfishRuntime({
      crossOriginIsolated: false,
      hasSharedArrayBuffer: false,
      hardwareConcurrency: 8,
    }, 2);
    const engine = new StockfishEngine(
      runtime,
      () => worker as unknown as Worker,
    );

    const readiness = engine.whenReady();
    (worker.onerror as ((event: ErrorEvent) => void) | null)?.({
      message: "WASM non disponibile",
    } as ErrorEvent);

    await expect(readiness).rejects.toThrow("WASM non disponibile");
  });

  it("falls back from the multi-threaded worker to the single-threaded worker", async () => {
    const multiRuntime = selectStockfishRuntime({
      crossOriginIsolated: true,
      hasSharedArrayBuffer: true,
      hardwareConcurrency: 8,
    }, 4);
    const terminateMulti = vi.fn();
    const createEngine = vi.fn((runtime: typeof multiRuntime) => ({
      runtime,
      whenReady: runtime.flavor === "multi"
        ? () => Promise.reject(new Error("multi worker failed"))
        : () => Promise.resolve(),
      analyze: vi.fn(),
      terminate: runtime.flavor === "multi" ? terminateMulti : vi.fn(),
    }));

    const engine = await prepareStockfishEngine(multiRuntime, createEngine);

    expect(terminateMulti).toHaveBeenCalledOnce();
    expect(createEngine).toHaveBeenCalledTimes(2);
    expect(engine.runtime).toMatchObject({
      flavor: "single",
      threads: 1,
      compatibilityMode: true,
    });
  });
});
