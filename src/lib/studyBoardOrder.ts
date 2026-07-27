import type { Board } from "@/types";

export function moveStudyBoard(
  boards: Board[],
  boardId: number,
  targetIndex: number,
): Board[] {
  const sourceIndex = boards.findIndex((board) => board.id === boardId);
  const boundedTargetIndex = Math.max(
    0,
    Math.min(targetIndex, boards.length - 1),
  );

  if (sourceIndex < 0 || sourceIndex === boundedTargetIndex) return boards;

  const reordered = [...boards];
  const [movedBoard] = reordered.splice(sourceIndex, 1);
  if (!movedBoard) return boards;
  reordered.splice(boundedTargetIndex, 0, movedBoard);

  return reordered.map((board, order) =>
    board.order === order ? board : { ...board, order },
  );
}

export function studyBoardIds(boards: Board[]): number[] {
  return boards.flatMap((board) => (board.id == null ? [] : [board.id]));
}
