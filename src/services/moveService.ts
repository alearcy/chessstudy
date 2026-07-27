import {
  createMove,
  deleteMovesByBoard,
  deleteMovesFromOrder,
  getMove,
  getMovesByBoard,
  updateMove,
  updateMovesBatch,
} from "@/repositories/moveRepository";
import type { Move } from "@/types";

export {
  createMove,
  deleteMovesByBoard,
  deleteMovesFromOrder,
  getMove,
  getMovesByBoard,
  updateMove,
  updateMovesBatch,
};
export type { MoveUpdatePatch } from "@/repositories/moveRepository";

export async function updateMoveEval(
  id: number,
  data: Partial<Pick<Move, "evalCp" | "evalMate" | "evalDepth" | "evalBestMoveUci">>,
): Promise<void> {
  await updateMove(id, data);
}
