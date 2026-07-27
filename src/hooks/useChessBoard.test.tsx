import { act, renderHook } from "@testing-library/react";
import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";

import { useChessBoard } from "@/hooks/useChessBoard";
import type { Move } from "@/types";

const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function persistedLine(sans: string[]): Move[] {
  const game = new Chess(START_FEN);
  return sans.map((san, index) => {
    const played = game.move(san);
    const id = index + 10;
    return {
      id,
      boardId: 1,
      parentId: index === 0 ? null : id - 1,
      order: index,
      moveNotation: played.san,
      fen: game.fen(),
      comment: "",
      arrows: [],
      highlights: [],
      tactics: [],
      createdAt: new Date(),
    };
  });
}

describe("useChessBoard", () => {
  it("records legal moves and can navigate back to the initial position", () => {
    const { result } = renderHook(() => useChessBoard());

    let moveResult: ReturnType<typeof result.current.makeMove> = null;
    act(() => {
      moveResult = result.current.makeMove("e2", "e4");
    });

    expect(moveResult).toMatchObject({ san: "e4" });
    expect(result.current.moves).toHaveLength(1);
    expect(result.current.fen).toContain(" b ");

    act(() => {
      result.current.goToMove(0);
    });

    expect(result.current.fen).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
  });

  it("truncates the linear history from the selected move", () => {
    const { result } = renderHook(() => useChessBoard());

    act(() => {
      result.current.makeMove("e2", "e4");
    });
    act(() => {
      result.current.makeMove("e7", "e5");
    });
    act(() => {
      result.current.makeMove("g1", "f3");
    });

    act(() => {
      result.current.truncateMovesFrom(1);
    });

    expect(result.current.moves.map((move) => move.moveNotation)).toEqual([
      "e4",
    ]);
    expect(result.current.history).toHaveLength(2);
    expect(result.current.historyIndex).toBe(1);
    expect(result.current.fen).toContain(" b ");
    expect(result.current.canRedo).toBe(false);
  });

  it("appends without truncating after loading at the persisted end", () => {
    const { result } = renderHook(() => useChessBoard());
    const loadedMoves = persistedLine(["e4", "e5"]);
    let truncatedMoveIds: number[] | null = null;

    act(() => {
      result.current.loadSequence(
        START_FEN,
        loadedMoves,
        [],
        [],
        loadedMoves.length,
      );
    });
    act(() => {
      truncatedMoveIds =
        result.current.makeMove("g1", "f3")?.truncatedMoveIds ?? null;
    });

    expect(result.current.historyIndex).toBe(3);
    expect(result.current.moves.map((move) => move.moveNotation)).toEqual([
      "e4",
      "e5",
      "Nf3",
    ]);
    expect(truncatedMoveIds).toEqual([]);
  });
});
