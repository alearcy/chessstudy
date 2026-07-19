import {
  createMove,
  deleteMovesByBoard,
  deleteMovesFromOrder,
  getMove,
  getMovesByBoard,
  updateMove,
} from "@/repositories/moveRepository";
import type { Move } from "@/types";

export {
  createMove,
  deleteMovesByBoard,
  deleteMovesFromOrder,
  getMove,
  getMovesByBoard,
  updateMove,
};

export async function updateMoveEval(
  id: number,
  data: Partial<Pick<Move, "evalCp" | "evalMate" | "evalDepth" | "evalBestMoveUci">>,
): Promise<void> {
  await updateMove(id, data);
}
