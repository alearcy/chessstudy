import {
  createBoard as createRemoteBoard,
  deleteBoard,
  getBoard,
  getBoardsByLesson,
  updateBoard,
} from "@/repositories/boardRepository";
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
