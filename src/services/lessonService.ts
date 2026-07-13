import db from "@/db/database";
import type { Lesson, LessonFormData, Board, Move } from "@/types";

export async function getAllLessons(): Promise<Lesson[]> {
  return db.lessons.orderBy("createdAt").reverse().toArray();
}

export async function getLesson(id: number): Promise<Lesson | undefined> {
  return db.lessons.get(id);
}

export async function createLesson(
  data: LessonFormData,
  mode: Lesson["mode"] = "study"
): Promise<number> {
  const id = await db.lessons.add({
    ...data,
    mode,
    isFavorite: false,
    createdAt: new Date(),
  } as Lesson);
  return id as number;
}

export async function updateLesson(
  id: number,
  data: LessonFormData
): Promise<void> {
  await db.lessons.update(id, data);
}

export async function setLessonFavorite(
  id: number,
  isFavorite: boolean,
): Promise<void> {
  await db.lessons.update(id, { isFavorite });
}

export async function deleteLesson(id: number): Promise<void> {
  const boards = await db.boards.where("lessonId").equals(id).toArray();
  for (const board of boards) {
    await db.moves.where("boardId").equals(board.id!).delete();
  }
  await db.boards.where("lessonId").equals(id).delete();
  await db.lessons.delete(id);
}

/**
 * Converte una scacchiera di analisi in una nuova lezione di studio.
 * Crea un nuovo Lesson (mode "study"), una Board che copia i dati della
 * scacchiera sorgente (FEN, frecce, evidenziazioni, eval, giocatori) e tutte
 * le mosse relative (con commenti, annotazioni, eval). La sorgente non viene
 * modificata. Ritorna l'id della nuova lezione.
 */
export async function convertAnalysisToStudy(
  sourceLesson: Lesson,
  sourceBoard: Board,
  sourceMoves: Move[]
): Promise<number> {
  return db.transaction("rw", db.lessons, db.boards, db.moves, async () => {
    const lessonId = (await db.lessons.add({
      title: `${sourceLesson.title} (Studio)`,
      description: sourceLesson.description,
      mode: "study",
      createdAt: new Date(),
    } as Lesson)) as number;

    const boardId = (await db.boards.add({
      lessonId,
      title: sourceBoard.title,
      fen: sourceBoard.fen,
      notes: sourceBoard.notes,
      arrows: sourceBoard.arrows ?? [],
      highlights: sourceBoard.highlights ?? [],
      order: 0,
      createdAt: new Date(),
      evalCp: sourceBoard.evalCp ?? null,
      evalMate: sourceBoard.evalMate ?? null,
      evalDepth: sourceBoard.evalDepth ?? 0,
      evalBestMoveUci: sourceBoard.evalBestMoveUci ?? null,
      whiteName: sourceBoard.whiteName ?? null,
      blackName: sourceBoard.blackName ?? null,
      headers: sourceBoard.headers ?? {},
    } as Board)) as number;

    for (const m of sourceMoves) {
      await db.moves.add({
        boardId,
        moveNotation: m.moveNotation,
        fen: m.fen,
        parentId: m.parentId,
        order: m.order,
        comment: m.comment ?? "",
        stockfishComment: m.stockfishComment ?? null,
        arrows: m.arrows ?? [],
        highlights: m.highlights ?? [],
        createdAt: new Date(),
        evalCp: m.evalCp ?? null,
        evalMate: m.evalMate ?? null,
        evalDepth: m.evalDepth ?? 0,
        evalBestMoveUci: m.evalBestMoveUci ?? null,
      } as Move);
    }

    return lessonId;
  });
}
