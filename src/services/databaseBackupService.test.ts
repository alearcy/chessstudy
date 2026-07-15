import { afterEach, beforeEach, describe, expect, it } from "vitest";

import db from "@/db/database";
import { createBoardWithFen } from "@/services/boardService";
import {
  BackupValidationError,
  createDatabaseBackupJson,
  inspectDatabaseBackupJson,
  restoreDatabaseBackupJson,
} from "@/services/databaseBackupService";
import { createLesson } from "@/services/lessonService";
import { createMove } from "@/services/moveService";
import { ensureDefaultProfile } from "@/services/profileService";

async function seedDatabase(title = "Partita originale") {
  const profile = await ensureDefaultProfile();
  const lessonId = await createLesson(
    { title, description: "Descrizione" },
    "analysis",
    {
      profileId: profile.id,
      isFavorite: true,
      createdAt: new Date("2026-01-02T10:00:00.000Z"),
    },
  );
  const boardId = await createBoardWithFen(lessonId, {
    title: "Kasparov vs Topalov",
    fen: "start",
    headers: { White: "Garry Kasparov", Black: "Veselin Topalov", ECO: "B07" },
  });
  const moveId = await createMove({
    boardId,
    moveNotation: "e4",
    fen: "after-e4",
    parentId: null,
    order: 0,
    comment: "Mossa centrale",
    arrows: [],
    highlights: [],
  });
  return { profile, lessonId, boardId, moveId };
}

describe("database backup service", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("exports a versioned portable document with ISO dates", async () => {
    const ids = await seedDatabase();

    const json = await createDatabaseBackupJson();
    const backup = JSON.parse(json) as {
      format: string;
      version: number;
      createdAt: string;
      data: {
        profiles: Array<{ id: number; createdAt: string }>;
        lessons: Array<{ id: number; profileId: number; createdAt: string }>;
        boards: Array<{ id: number; lessonId: number; createdAt: string }>;
        moves: Array<{ id: number; boardId: number; createdAt: string }>;
      };
    };

    expect(backup).toMatchObject({
      format: "chessstudy-backup",
      version: 1,
    });
    expect(new Date(backup.createdAt).toISOString()).toBe(backup.createdAt);
    expect(backup.data.profiles[0]).toMatchObject({ id: ids.profile.id });
    expect(backup.data.lessons[0]).toMatchObject({
      id: ids.lessonId,
      profileId: ids.profile.id,
    });
    expect(backup.data.boards[0]).toMatchObject({ id: ids.boardId, lessonId: ids.lessonId });
    expect(backup.data.moves[0]).toMatchObject({ id: ids.moveId, boardId: ids.boardId });
    expect(backup.data.lessons[0].createdAt).toBe("2026-01-02T10:00:00.000Z");
    expect(inspectDatabaseBackupJson(json)).toEqual({
      profiles: 1,
      lessons: 1,
      boards: 1,
      moves: 1,
    });
  });

  it("rejects broken relationships without changing current data", async () => {
    await seedDatabase();
    const backup = JSON.parse(await createDatabaseBackupJson());
    backup.data.boards[0].lessonId = 999_999;

    await expect(
      restoreDatabaseBackupJson(JSON.stringify(backup)),
    ).rejects.toBeInstanceOf(BackupValidationError);

    await expect(db.lessons.toArray()).resolves.toHaveLength(1);
    await expect(db.lessons.toCollection().first()).resolves.toMatchObject({
      title: "Partita originale",
    });
  });

  it("replaces all tables atomically and restores Date values", async () => {
    await seedDatabase("Contenuto backup");
    const json = await createDatabaseBackupJson();

    await db.transaction("rw", db.moves, db.boards, db.lessons, db.profiles, async () => {
      await db.moves.clear();
      await db.boards.clear();
      await db.lessons.clear();
      await db.profiles.clear();
    });
    await seedDatabase("Contenuto temporaneo");

    const summary = await restoreDatabaseBackupJson(json);

    expect(summary).toEqual({ profiles: 1, lessons: 1, boards: 1, moves: 1 });
    const restoredLesson = await db.lessons.toCollection().first();
    expect(restoredLesson).toMatchObject({ title: "Contenuto backup" });
    expect(restoredLesson?.createdAt).toBeInstanceOf(Date);
    expect(restoredLesson?.updatedAt).toBeInstanceOf(Date);
  });

  it("rolls back cleared data when a database constraint rejects the backup", async () => {
    await seedDatabase();
    const backup = JSON.parse(await createDatabaseBackupJson());
    backup.data.profiles.push({
      ...backup.data.profiles[0],
      id: 999,
      uid: "second-profile-uid",
    });

    await expect(
      restoreDatabaseBackupJson(JSON.stringify(backup)),
    ).rejects.toThrow();

    await expect(db.lessons.toCollection().first()).resolves.toMatchObject({
      title: "Partita originale",
    });
    await expect(db.profiles.count()).resolves.toBe(1);
  });

  it("repairs legacy cross-board parent links using each board linear order", async () => {
    const ids = await seedDatabase();
    const secondBoardId = await createBoardWithFen(ids.lessonId, {
      title: "Scacchiera copiata",
      fen: "start",
    });
    await createMove({
      boardId: secondBoardId,
      moveNotation: "d4",
      fen: "after-d4",
      parentId: ids.moveId,
      order: 0,
      comment: "",
      arrows: [],
      highlights: [],
    });
    const json = await createDatabaseBackupJson();

    await expect(restoreDatabaseBackupJson(json)).resolves.toMatchObject({
      boards: 2,
      moves: 2,
    });

    const restored = await db.moves.where("boardId").equals(secondBoardId).sortBy("order");
    expect(restored[0].parentId).toBeNull();
  });
});
