import { describe, expect, it } from "vitest";

import { calculatePlayerAccuracies } from "@/services/gameAccuracyService";
import type {
  EvaluatedMove,
  EvaluationPosition,
} from "@/services/moveAnnotationService";

function position(
  evalCp: number | null,
  evalMate: number | null = null,
): EvaluationPosition {
  return {
    fen: "position",
    evalCp,
    evalMate,
  };
}

function move(
  evalCp: number | null,
  evalMate: number | null = null,
): EvaluatedMove {
  return {
    ...position(evalCp, evalMate),
    moveNotation: "e4",
  };
}

describe("calculatePlayerAccuracies", () => {
  it("assegna 100 a entrambi quando nessuna mossa perde probabilita", () => {
    expect(
      calculatePlayerAccuracies(position(0), [move(0), move(0)]),
    ).toEqual({ white: 100, black: 100 });
  });

  it("penalizza separatamente gli errori dal punto di vista di chi muove", () => {
    const result = calculatePlayerAccuracies(position(0), [
      move(0),
      move(300),
    ]);

    expect(result.white).toBe(100);
    expect(result.black).not.toBeNull();
    expect(result.black!).toBeLessThan(result.white!);
  });

  it("porta a zero una mossa che ribalta un matto a favore in matto contro", () => {
    expect(
      calculatePlayerAccuracies(position(null, 2), [move(null, -1)]),
    ).toEqual({ white: 0, black: null });
  });

  it("non mostra risultati quando l'analisi di una posizione e incompleta", () => {
    expect(
      calculatePlayerAccuracies(position(0), [move(0), move(null)]),
    ).toEqual({ white: null, black: null });
    expect(calculatePlayerAccuracies(position(null), [move(0)])).toEqual({
      white: null,
      black: null,
    });
  });

  it("lascia nullo il colore che non ha ancora mosse", () => {
    expect(calculatePlayerAccuracies(position(0), [move(0)])).toEqual({
      white: 100,
      black: null,
    });
  });
});
