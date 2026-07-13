import { afterEach, describe, expect, it } from "vitest";

import db from "@/db/database";
import { setLessonFavorite } from "@/services/lessonService";

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
});
