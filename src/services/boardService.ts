import {
  createBoard as createRemoteBoard,
  deleteBoard,
  getBoard,
  getBoardsByLesson,
  updateBoard,
} from "@/repositories/boardRepository";
import { requireData } from "@/repositories/repositoryError";
import { supabase } from "@/lib/supabase/client";
import type { Board } from "@/types";

export { deleteBoard, getBoard, getBoardsByLesson, updateBoard };

export async function createBoard(lessonId: number, title?: string): Promise<number> {
  return createRemoteBoard(lessonId, { title });
}

export async function createBoardWithFen(
  lessonId: number,
  data: {
    title: string;
    fen: string;
    notes?: string;
    whiteName?: string | null;
    blackName?: string | null;
    headers?: Record<string, string | null>;
  },
): Promise<number> {
  return createRemoteBoard(lessonId, data satisfies Partial<Board>);
}

export async function duplicateBoard(sourceBoardId: number): Promise<number> {
  const response = await supabase.rpc("duplicate_study_board", {
    p_source_board_id: sourceBoardId,
  });
  return requireData(
    response.data as number | null,
    response.error,
    "Duplicazione scacchiera fallita.",
  );
}

export async function reorderStudyBoards(
  lessonId: number,
  boardIds: number[],
): Promise<void> {
  const { error } = await supabase.rpc("reorder_study_boards", {
    p_lesson_id: lessonId,
    p_board_ids: boardIds,
  });
  if (error) {
    throw new Error("Riordino scacchiere fallito.");
  }
}
