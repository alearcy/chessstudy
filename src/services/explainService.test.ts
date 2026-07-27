import { describe, expect, it } from "vitest";

import {
  detectTactics,
  explainMoveRuleBased,
  formatDiagnosisHint,
  resolveMoveTactics,
} from "@/services/explainService";
import type { Board, Move } from "@/types";

describe("explainService tactical explanations", () => {
  it("detects a fork even when the attacker is not the side encoded by legal move generation", () => {
    const fen = "4k3/2r5/5q2/3N4/8/8/8/4K3 b - - 0 1";

    const fork = detectTactics(fen, "w").find((pattern) => pattern.type === "fork");

    expect(fork).toMatchObject({ actor: "cavallo" });
    expect(fork?.squares).toEqual(expect.arrayContaining(["d5", "c7", "f6"]));
  });

  it("looks for the opponent tactical reply after a blunder", () => {
    const explanation = explainMoveRuleBased({
      beforeFen: "4k3/8/8/3n4/8/2Q1R3/7P/4K3 w - - 0 1",
      afterFen: "4k3/8/8/3n4/8/2Q1R2P/8/4K3 b - - 0 1",
      playedMoveSan: "h3",
      playedBy: "w",
      beforeEval: { cp: 0, mate: null, depth: 18, bestMoveUci: null },
      afterEval: { cp: -400, mate: null, depth: 18 },
    });

    expect(explanation.severity).toBe("blunder");
    expect(explanation.tactics.some((pattern) => pattern.type === "fork")).toBe(true);
    expect(explanation.summary).toContain("Subisci una forchetta");
  });

  it("classifies worsening a forced mate distance as a blunder", () => {
    const explanation = explainMoveRuleBased({
      beforeFen: "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1",
      afterFen: "4k3/8/8/8/8/4P3/8/4K3 b - - 0 1",
      playedMoveSan: "e3",
      playedBy: "w",
      beforeEval: { cp: null, mate: 1, depth: 18, bestMoveUci: null },
      afterEval: { cp: null, mate: 5, depth: 18 },
    });

    expect(explanation.severity).toBe("blunder");
  });

  it("compares material from the player's perspective without exposing point totals", () => {
    const explanation = explainMoveRuleBased({
      beforeFen: "3r3k/8/8/8/8/8/8/3Q3K w - - 0 1",
      afterFen: "3r3k/8/8/8/8/8/8/6QK b - - 1 1",
      playedMoveSan: "Qg1",
      playedBy: "w",
      beforeEval: { cp: 0, mate: null, depth: 18, bestMoveUci: "d1d8" },
      afterEval: { cp: -400, mate: null, depth: 18 },
    });

    expect(explanation.stockfishExplains).toContain("più materiale");
    expect(explanation.stockfishExplains).not.toContain("punti materiale");
  });

  it("keeps the educational principle when the tactical text already mentions mate", () => {
    const hint = formatDiagnosisHint({
      type: "allowed_mate_in_one",
      confidence: 1,
      facts: ["L'avversario ha matto."],
      principle: "Controlla gli scacchi forzanti.",
      mustMention: ["Qh2#", "matto"],
    }, "Il Nero ha matto in una mossa.");

    expect(hint).toContain("Idea chiave");
  });

  it("does not repeat the best move when there is no concrete educational reason", () => {
    const explanation = explainMoveRuleBased({
      beforeFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      afterFen: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1",
      playedMoveSan: "d4",
      playedBy: "w",
      beforeEval: { cp: 0, mate: null, depth: 18, bestMoveUci: "e2e4" },
      afterEval: { cp: -60, mate: null, depth: 18 },
    });

    expect(explanation.stockfishExplains).toBeNull();
  });

  it("rebuilds tactics for a legacy analyzed move without persisted groups", () => {
    const board = {
      id: 1,
      lessonId: 1,
      title: "Analisi",
      fen: "4k3/8/8/3n4/8/2Q1R3/7P/4K3 w - - 0 1",
      notes: "",
      arrows: [],
      highlights: [],
      order: 0,
      evalCp: 0,
      evalMate: null,
      evalDepth: 18,
      evalBestMoveUci: null,
      createdAt: new Date(),
    } satisfies Board;
    const move = {
      id: 2,
      boardId: 1,
      moveNotation: "h3",
      fen: "4k3/8/8/3n4/8/2Q1R2P/8/4K3 b - - 0 1",
      parentId: null,
      order: 0,
      comment: "",
      analysisComment: "La posizione ora contiene debolezze tattiche.",
      arrows: [],
      highlights: ["d5", "c3", "e3"],
      tactics: [],
      evalCp: -400,
      evalMate: null,
      evalDepth: 18,
      evalBestMoveUci: null,
      createdAt: new Date(),
    } satisfies Move;

    expect(resolveMoveTactics(board, [move], 0)).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "fork" })]),
    );
  });
});
