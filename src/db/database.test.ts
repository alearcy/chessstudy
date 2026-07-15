import { afterEach, describe, expect, it } from "vitest";
import Dexie from "dexie";

import db from "@/db/database";

describe("database", () => {
  afterEach(async () => {
    await db.delete();
    await db.open();
  });

  it("persists lessons, boards and moves with boardId queries", async () => {
    const now = new Date();
    const lessonId = (await db.lessons.add({
      title: "Lezione test",
      description: "",
      mode: "study",
      createdAt: now,
      updatedAt: now,
    })) as number;
    const boardId = (await db.boards.add({
      lessonId,
      title: "Scacchiera 1",
      fen: "start",
      notes: "",
      arrows: [],
      highlights: [],
      order: 0,
      createdAt: now,
      updatedAt: now,
    })) as number;
    const savedLessonId = lessonId;
    const savedBoardId = boardId;
    await db.moves.add({
      boardId,
      moveNotation: "e4",
      fen: "fen-after-e4",
      parentId: null,
      order: 0,
      comment: "",
      arrows: [],
      highlights: [],
      createdAt: now,
      updatedAt: now,
    });

    await expect(db.lessons.get(savedLessonId)).resolves.toMatchObject({
      title: "Lezione test",
    });
    await expect(db.boards.where("lessonId").equals(savedLessonId).count()).resolves.toBe(1);
    await expect(db.moves.where("boardId").equals(savedBoardId).first()).resolves.toMatchObject({
      moveNotation: "e4",
    });
  });

  it("migrates v12 data losslessly into the default local profile", async () => {
    await db.delete();
    const legacy = new Dexie("ChessStudyDB");
    legacy.version(12).stores({
      lessons: "++id, title, mode, createdAt",
      boards: "++id, lessonId, createdAt",
      moves: "++id, boardId, parentId, order, createdAt",
    });
    await legacy.open();

    const createdAt = new Date("2025-01-02T10:00:00.000Z");
    const lessonId = (await legacy.table("lessons").add({
      title: "Kasparov vs Topalov",
      description: "",
      mode: "analysis",
      isFavorite: true,
      createdAt,
    })) as number;
    const boardId = (await legacy.table("boards").add({
      lessonId,
      title: "Wijk aan Zee",
      fen: "start",
      notes: "",
      arrows: [],
      highlights: [],
      order: 0,
      headers: { White: "Garry Kasparov", Black: "Veselin Topalov", ECO: "B07" },
      createdAt,
    })) as number;
    await legacy.table("moves").add({
      boardId,
      moveNotation: "e4",
      fen: "after-e4",
      parentId: null,
      order: 0,
      comment: "",
      arrows: [],
      highlights: [],
      createdAt,
    });
    legacy.close();

    await db.open();

    const [profiles, lessons, boards, moves] = await Promise.all([
      db.profiles.toArray(),
      db.lessons.toArray(),
      db.boards.toArray(),
      db.moves.toArray(),
    ]);
    expect(profiles).toHaveLength(1);
    expect(lessons).toHaveLength(1);
    expect(boards).toHaveLength(1);
    expect(moves).toHaveLength(1);
    expect(lessons[0]).toMatchObject({
      id: lessonId,
      profileId: profiles[0].id,
      isFavorite: true,
    });
    expect(lessons[0].uid).toBeTruthy();
    expect(lessons[0].searchTerms).toEqual(expect.arrayContaining(["kasparov", "topalov", "b07"]));
    expect(boards[0]).toMatchObject({ id: boardId, lessonId });
    expect(boards[0].uid).toBeTruthy();
    expect(moves[0].uid).toBeTruthy();
  });

  it("repairs cross-board parent links when upgrading an existing v13 database", async () => {
    await db.delete();
    const legacy = new Dexie("ChessStudyDB");
    legacy.version(13).stores({
      profiles: "++id, &uid, &name, createdAt",
      lessons: "++id, &uid, profileId, title, mode, createdAt, [profileId+createdAt], [profileId+mode+createdAt], *searchTerms",
      boards: "++id, &uid, lessonId, createdAt",
      moves: "++id, &uid, boardId, parentId, order, createdAt, [boardId+order]",
    });
    await legacy.open();
    const now = new Date();
    const profileId = await legacy.table("profiles").add({
      uid: "profile-uid",
      name: "Principale",
      createdAt: now,
      updatedAt: now,
    });
    const lessonId = await legacy.table("lessons").add({
      uid: "lesson-uid",
      profileId,
      title: "Legacy",
      description: "",
      mode: "study",
      searchTerms: ["legacy"],
      createdAt: now,
      updatedAt: now,
    });
    const firstBoardId = await legacy.table("boards").add({
      uid: "board-one-uid",
      lessonId,
      title: "Prima",
      fen: "start",
      notes: "",
      arrows: [],
      highlights: [],
      order: 0,
      createdAt: now,
      updatedAt: now,
    });
    const secondBoardId = await legacy.table("boards").add({
      uid: "board-two-uid",
      lessonId,
      title: "Seconda",
      fen: "start",
      notes: "",
      arrows: [],
      highlights: [],
      order: 1,
      createdAt: now,
      updatedAt: now,
    });
    const firstMoveId = await legacy.table("moves").add({
      uid: "move-one-uid",
      boardId: firstBoardId,
      moveNotation: "e4",
      fen: "after-e4",
      parentId: null,
      order: 0,
      comment: "",
      arrows: [],
      highlights: [],
      createdAt: now,
      updatedAt: now,
    });
    await legacy.table("moves").add({
      uid: "move-two-uid",
      boardId: secondBoardId,
      moveNotation: "d4",
      fen: "after-d4",
      parentId: firstMoveId,
      order: 0,
      comment: "",
      arrows: [],
      highlights: [],
      createdAt: now,
      updatedAt: now,
    });
    legacy.close();

    await db.open();

    const [repaired] = await db.moves.where("boardId").equals(Number(secondBoardId)).toArray();
    expect(repaired.parentId).toBeNull();
  });
});
