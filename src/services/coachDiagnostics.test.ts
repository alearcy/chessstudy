import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";

import {
  buildCriticalMoveDiagnostics,
  diagnoseCriticalMoves,
  type CoachMoveInput,
} from "@/services/coachDiagnostics";

function openingInputs(classification: string): CoachMoveInput[] {
  const chess = new Chess();
  return ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"].map((san, index) => {
    const fenBefore = chess.fen();
    const played = chess.move(san);
    if (!played) throw new Error(`Mossa test non valida: ${san}`);
    return {
      moveNumber: Math.floor(index / 2) + 1,
      index,
      fenBefore,
      fenAfter: chess.fen(),
      san: played.san,
      player: played.color === "w" ? "Bianco" : "Nero",
      evalBefore: "equilibrio",
      evalAfter: "equilibrio",
      evalBeforeCp: 0,
      evalAfterCp: 0,
      classification,
      bestSan: null,
      bestMoveLan: null,
      stockfishComment: null,
    };
  });
}

describe("coachDiagnostics", () => {
  it("diagnoses every inaccuracy while keeping the five-move summary cap separate", () => {
    const moves = openingInputs("IMPRECISIONE");

    expect(diagnoseCriticalMoves(moves)).toHaveLength(6);
    expect(buildCriticalMoveDiagnostics(moves)).toHaveLength(5);
  });

  it("recognizes the engine best capture even when another capture takes a more valuable piece", () => {
    const before = new Chess("3r3k/b7/8/8/8/8/8/R2Q3K w - - 0 1");
    const fenBefore = before.fen();
    const played = before.move("Qg1");
    if (!played) throw new Error("Mossa test non valida");

    const [diagnosed] = diagnoseCriticalMoves([{
      moveNumber: 1,
      index: 0,
      fenBefore,
      fenAfter: before.fen(),
      san: played.san,
      player: "Bianco",
      evalBefore: "equilibrio",
      evalAfter: "Nero meglio",
      evalBeforeCp: 0,
      evalAfterCp: -200,
      classification: "ERRORE",
      bestSan: "Rxa7",
      bestMoveLan: "a1a7",
      stockfishComment: null,
    }]);

    expect(diagnosed.diagnosis.type).toBe("missed_high_value_capture");
    expect(diagnosed.diagnosis.mustMention).toContain("Rxa7");
  });
});
