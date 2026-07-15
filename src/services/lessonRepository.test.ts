import { afterEach, beforeEach, describe, expect, it } from "vitest";

import db from "@/db/database";
import { createBoardWithFen } from "@/services/boardService";
import {
  createLocalProfile,
  ensureDefaultProfile,
} from "@/services/profileService";
import {
  createLesson,
  getLessonsPage,
} from "@/services/lessonService";

describe("lesson repository", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("creates one default profile and assigns new lessons to it", async () => {
    const firstProfile = await ensureDefaultProfile();
    const secondProfile = await ensureDefaultProfile();
    const lessonId = await createLesson({ title: "Finali", description: "" });

    expect(secondProfile.id).toBe(firstProfile.id);
    await expect(db.profiles.count()).resolves.toBe(1);
    await expect(db.lessons.get(lessonId)).resolves.toMatchObject({
      profileId: firstProfile.id,
    });
  });

  it("isolates lessons by profile and returns stable pages", async () => {
    const primary = await ensureDefaultProfile();
    const secondary = await createLocalProfile("Ospite");

    for (let index = 0; index < 5; index += 1) {
      await createLesson(
        { title: `Lezione ${index + 1}`, description: "" },
        "study",
        {
          profileId: primary.id,
          createdAt: new Date(Date.UTC(2026, 0, index + 1)),
        },
      );
    }
    await createLesson(
      { title: "Partita ospite", description: "" },
      "analysis",
      { profileId: secondary.id },
    );

    const firstPage = await getLessonsPage({
      profileId: primary.id,
      page: 1,
      pageSize: 2,
    });
    const lastPage = await getLessonsPage({
      profileId: primary.id,
      page: 3,
      pageSize: 2,
    });

    expect(firstPage.items.map((lesson) => lesson.title)).toEqual([
      "Lezione 5",
      "Lezione 4",
    ]);
    expect(firstPage).toMatchObject({ total: 5, page: 1, pageCount: 3 });
    expect(lastPage.items.map((lesson) => lesson.title)).toEqual(["Lezione 1"]);
  });

  it("searches imported games using title and PGN metadata", async () => {
    const profile = await ensureDefaultProfile();
    const lessonId = await createLesson(
      { title: "Partita del torneo", description: "Difesa molto precisa" },
      "analysis",
      { profileId: profile.id },
    );
    await createBoardWithFen(lessonId, {
      title: "Round 7",
      fen: "start",
      headers: {
        White: "Garry Kasparov",
        Black: "Veselin Topalov",
        Event: "Wijk aan Zee",
        ECO: "B07",
        Date: "1999.01.20",
      },
    });

    const byPlayer = await getLessonsPage({
      profileId: profile.id,
      query: "kasparov",
      page: 1,
      pageSize: 10,
    });
    const byEventAndEco = await getLessonsPage({
      profileId: profile.id,
      query: "wijk b07",
      page: 1,
      pageSize: 10,
    });
    const missing = await getLessonsPage({
      profileId: profile.id,
      query: "carlsen",
      page: 1,
      pageSize: 10,
    });

    expect(byPlayer.items.map((lesson) => lesson.id)).toEqual([lessonId]);
    expect(byEventAndEco.items.map((lesson) => lesson.id)).toEqual([lessonId]);
    expect(missing.total).toBe(0);
  });

  it("combines mode, favorites and creation-date filters", async () => {
    const profile = await ensureDefaultProfile();
    await createLesson(
      { title: "Preferita", description: "" },
      "analysis",
      {
        profileId: profile.id,
        isFavorite: true,
        createdAt: new Date(2026, 6, 15, 10),
      },
    );
    await createLesson(
      { title: "Non preferita", description: "" },
      "analysis",
      {
        profileId: profile.id,
        createdAt: new Date(2026, 6, 15, 11),
      },
    );
    await createLesson(
      { title: "Studio", description: "" },
      "study",
      {
        profileId: profile.id,
        createdAt: new Date(2026, 6, 15, 12),
      },
    );

    const result = await getLessonsPage({
      profileId: profile.id,
      kind: "favorites",
      createdOn: "2026-07-15",
      page: 1,
      pageSize: 10,
    });

    expect(result.items.map((lesson) => lesson.title)).toEqual(["Preferita"]);
  });
});
