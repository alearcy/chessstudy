import { afterEach, describe, expect, it } from "vitest";

import db from "@/db/database";
import { createBoardWithFen, getBoardsByLesson } from "@/services/boardService";
import {
  convertAnalysisToStudy,
  createLesson,
  getLesson,
  setLessonFavorite,
} from "@/services/lessonService";
import { createMove, getMovesByBoard } from "@/services/moveService";

describe("lessonService favorites", () => {
  afterEach(async () => {
    await db.delete();
    await db.open();
  });

  it("persists adding and removing an imported game from favorites", async () => {
    const lessonId = (await db.lessons.add({
      title: "Partita importata",
      description: "",
      mode: "analysis",
      createdAt: new Date(),
    })) as number;

    await setLessonFavorite(lessonId, true);
    await expect(db.lessons.get(lessonId)).resolves.toMatchObject({
      isFavorite: true,
    });

    await setLessonFavorite(lessonId, false);
    await expect(db.lessons.get(lessonId)).resolves.toMatchObject({
      isFavorite: false,
    });
  });

  it("rebuilds parent links when converting an analysis to a study", async () => {
    const sourceLessonId = await createLesson(
      { title: "Analisi", description: "" },
      "analysis",
    );
    const sourceBoardId = await createBoardWithFen(sourceLessonId, {
      title: "Partita",
      fen: "start",
    });
    const firstMoveId = await createMove({
      boardId: sourceBoardId,
      moveNotation: "e4",
      fen: "after-e4",
      parentId: null,
      order: 0,
      comment: "",
      arrows: [],
      highlights: [],
    });
    await createMove({
      boardId: sourceBoardId,
      moveNotation: "e5",
      fen: "after-e5",
      parentId: firstMoveId,
      order: 1,
      comment: "",
      arrows: [],
      highlights: [],
    });
    const sourceLesson = await getLesson(sourceLessonId);
    const sourceBoards = await getBoardsByLesson(sourceLessonId);
    const sourceMoves = await getMovesByBoard(sourceBoardId);
    if (!sourceLesson || !sourceBoards[0]) throw new Error("Fixture non valida");

    const studyId = await convertAnalysisToStudy(sourceLesson, sourceBoards[0], sourceMoves);
    const [studyBoard] = await getBoardsByLesson(studyId);
    if (!studyBoard?.id) throw new Error("Studio non creato");
    const studyMoves = await getMovesByBoard(studyBoard.id);

    expect(studyMoves[0].parentId).toBeNull();
    expect(studyMoves[1].parentId).toBe(studyMoves[0].id);
    expect(studyMoves[1].parentId).not.toBe(firstMoveId);
  });
});
