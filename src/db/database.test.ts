import { afterEach, describe, expect, it } from "vitest";

import db from "@/db/database";

describe("database", () => {
  afterEach(async () => {
    await db.delete();
    await db.open();
  });

  it("persists lessons, boards and moves with boardId queries", async () => {
    const now = new Date().toISOString();
    const lessonId = await db.lessons.add({
      title: "Lezione test",
      description: "",
      mode: "study",
      createdAt: now,
      updatedAt: now,
    } as any);
    const boardId = await db.boards.add({
      lessonId,
      title: "Scacchiera 1",
      fen: "start",
      moveIndex: 0,
      createdAt: now,
      updatedAt: now,
    } as any);
    const savedLessonId = lessonId as number;
    const savedBoardId = boardId as number;
    await db.moves.add({
      lessonId,
      boardId,
      san: "e4",
      fenAfter: "fen-after-e4",
      moveNumber: 1,
      color: "white",
      createdAt: now,
      updatedAt: now,
    } as any);

    await expect(db.lessons.get(savedLessonId)).resolves.toMatchObject({
      title: "Lezione test",
    });
    await expect(db.boards.where("lessonId").equals(savedLessonId).count()).resolves.toBe(1);
    await expect(db.moves.where("boardId").equals(savedBoardId).first()).resolves.toMatchObject({
      san: "e4",
    });
  });
});
