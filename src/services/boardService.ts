import db from "@/db/database";
import type { Board } from "@/types";

const DEFAULT_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export async function getBoardsByLesson(lessonId: number): Promise<Board[]> {
  return db.boards.where("lessonId").equals(lessonId).sortBy("order");
}

export async function getBoard(id: number): Promise<Board | undefined> {
  return db.boards.get(id);
}

export async function createBoard(
  lessonId: number,
  title?: string
): Promise<number> {
  const count = await db.boards.where("lessonId").equals(lessonId).count();
  const id = await db.boards.add({
    lessonId,
    title: title || `Scacchiera ${count + 1}`,
    fen: DEFAULT_FEN,
    notes: "",
    order: count,
    createdAt: new Date(),
  } as Board);
  return id as number;
}

export async function updateBoard(
  id: number,
  data: Partial<Pick<Board, "title" | "fen" | "notes">>
): Promise<void> {
  await db.boards.update(id, data);
}

export async function deleteBoard(id: number): Promise<void> {
  await db.moves.where("boardId").equals(id).delete();
  await db.boards.delete(id);
}
