import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useChessBoard } from "@/hooks/useChessBoard";

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
});
