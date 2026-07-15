import db from "@/db/database";
import { createStableId } from "@/db/recordMetadata";
import { refreshLessonSearchIndex } from "@/services/lessonSearchService";
import type { Board } from "@/types";

const DEFAULT_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Normalizza una board letta dal DB garantendo i campi arrows/highlights/eval. */
function normalizeBoard(b: Board): Board {
  return {
    ...b,
    arrows: b.arrows ?? [],
    highlights: b.highlights ?? [],
    evalCp: b.evalCp ?? null,
    evalMate: b.evalMate ?? null,
    evalDepth: b.evalDepth ?? 0,
    evalBestMoveUci: b.evalBestMoveUci ?? null,
    whiteName: b.whiteName ?? null,
    blackName: b.blackName ?? null,
    headers: b.headers ?? {},
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
    uid: createStableId(),
    lessonId,
    title: title || `Scacchiera ${count + 1}`,
    fen: DEFAULT_FEN,
    notes: "",
    arrows: [],
    highlights: [],
    order: count,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Board);
  await refreshLessonSearchIndex(lessonId);
  return id as number;
}

/** Crea una scacchiera con FEN di partenza custom (es. da import PGN). */
export async function createBoardWithFen(
  lessonId: number,
  data: { title: string; fen: string; notes?: string; whiteName?: string | null; blackName?: string | null; headers?: Record<string, string | null> }
): Promise<number> {
  const count = await db.boards.where("lessonId").equals(lessonId).count();
  const id = await db.boards.add({
    uid: createStableId(),
    lessonId,
    title: data.title,
    fen: data.fen,
    notes: data.notes ?? "",
    arrows: [],
    highlights: [],
    order: count,
    createdAt: new Date(),
    updatedAt: new Date(),
    whiteName: data.whiteName ?? null,
    blackName: data.blackName ?? null,
    headers: data.headers ?? {},
  } as Board);
  await refreshLessonSearchIndex(lessonId);
  return id as number;
}

export async function updateBoard(
  id: number,
  data: Partial<Pick<Board, "title" | "fen" | "notes" | "arrows" | "highlights" | "evalCp" | "evalMate" | "evalDepth" | "evalBestMoveUci" | "whiteName" | "blackName" | "headers" | "gameAnalysis" | "openingReport" | "openingEco" | "openingName" | "openingFamily">>
): Promise<void> {
  const board = await db.boards.get(id);
  await db.boards.update(id, { ...data, updatedAt: new Date() });
  const changesSearchMetadata = [
    "title",
    "whiteName",
    "blackName",
    "headers",
    "openingEco",
    "openingName",
    "openingFamily",
  ].some((key) => key in data);
  if (board && changesSearchMetadata) {
    await refreshLessonSearchIndex(board.lessonId);
  }
}

export async function deleteBoard(id: number): Promise<void> {
  const board = await db.boards.get(id);
  await db.moves.where("boardId").equals(id).delete();
  await db.boards.delete(id);
  if (board) await refreshLessonSearchIndex(board.lessonId);
}
