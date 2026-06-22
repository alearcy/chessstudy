import db from "@/db/database";
import type { Board } from "@/types";

const DEFAULT_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Normalizza una board letta dal DB garantendo i campi arrows/highlights. */
function normalizeBoard(b: Board): Board {
  return {
    ...b,
    arrows: b.arrows ?? [],
    highlights: b.highlights ?? [],
  };
}

export async function getBoardsByLesson(lessonId: number): Promise<Board[]> {
  const boards = await db.boards.where("lessonId").equals(lessonId).sortBy("order");
  return boards.map(normalizeBoard);
}

export async function getBoard(id: number): Promise<Board | undefined> {
  const b = await db.boards.get(id);
  return b ? normalizeBoard(b) : undefined;
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
    arrows: [],
    highlights: [],
    order: count,
    createdAt: new Date(),
  } as Board);
  return id as number;
}

export async function updateBoard(
  id: number,
  data: Partial<Pick<Board, "title" | "fen" | "notes" | "arrows" | "highlights">>
): Promise<void> {
  await db.boards.update(id, data);
}

export async function deleteBoard(id: number): Promise<void> {
  await db.moves.where("boardId").equals(id).delete();
  await db.boards.delete(id);
}
