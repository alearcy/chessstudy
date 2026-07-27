import { describe, expect, it } from "vitest";

import { moveStudyBoard } from "@/lib/studyBoardOrder";
import type { Board } from "@/types";

function board(id: number, order: number): Board {
  return {
    id,
    lessonId: 3,
    title: `Scacchiera ${id}`,
    fen: "start",
    notes: "",
    arrows: [],
    highlights: [],
    order,
    createdAt: new Date(),
  };
}

describe("moveStudyBoard", () => {
  it("moves a board and normalizes every local order", () => {
    const reordered = moveStudyBoard(
      [board(7, 0), board(8, 1), board(9, 2)],
      7,
      2,
    );

    expect(reordered.map(({ id, order }) => ({ id, order }))).toEqual([
      { id: 8, order: 0 },
      { id: 9, order: 1 },
      { id: 7, order: 2 },
    ]);
  });

  it("preserves the original array when the move has no effect", () => {
    const boards = [board(7, 0), board(8, 1)];

    expect(moveStudyBoard(boards, 7, 0)).toBe(boards);
    expect(moveStudyBoard(boards, 99, 1)).toBe(boards);
  });
});
