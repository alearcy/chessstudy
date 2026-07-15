import { afterEach, describe, expect, it } from "vitest";

import db from "@/db/database";
import type { OpeningReference } from "@/types";
import {
  OpeningDestinationConflict,
  addOpeningToStudy,
  createOpeningStudy,
  getOpeningStudyDestinations,
} from "@/services/openingStudyService";

const sicilian: OpeningReference = {
  eco: "B20",
  name: "Sicilian Defense",
  family: "Sicilian Defense",
  pgn: "1. e4 c5",
};

const dragon: OpeningReference = {
  eco: "B70",
  name: "Sicilian Defense: Dragon Variation",
  family: "Sicilian Defense",
  pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6",
};

describe("openingStudyService", () => {
  afterEach(async () => {
    await db.delete();
    await db.open();
  });

  it("creates a study board containing the complete opening sequence", async () => {
    const { lessonId, boardId } = await createOpeningStudy(sicilian, {
      title: "Siciliana",
      conflict: "error",
    });

    await expect(db.lessons.get(lessonId)).resolves.toMatchObject({
      title: "Siciliana",
      mode: "study",
    });
    await expect(db.boards.get(boardId)).resolves.toMatchObject({
      title: "Sicilian Defense",
      openingEco: "B20",
      openingFamily: "Sicilian Defense",
    });

    const moves = await db.moves.where("boardId").equals(boardId).sortBy("order");
    expect(moves.map((move) => move.moveNotation)).toEqual(["e4", "c5"]);
    expect(moves[0].parentId).toBeNull();
    expect(moves[1].parentId).toBe(moves[0].id);
  });

  it("adds a variant as a new board without renaming the destination study", async () => {
    const { lessonId } = await createOpeningStudy(sicilian, {
      title: "Siciliana",
      conflict: "error",
    });

    const { boardId } = await addOpeningToStudy(dragon, {
      lessonId,
      conflict: "error",
    });

    await expect(db.lessons.get(lessonId)).resolves.toMatchObject({
      title: "Siciliana",
    });
    const boards = await db.boards.where("lessonId").equals(lessonId).sortBy("order");
    expect(boards.map((board) => board.title)).toEqual([
      "Sicilian Defense",
      "Sicilian Defense: Dragon Variation",
    ]);

    const moves = await db.moves.where("boardId").equals(boardId).sortBy("order");
    expect(moves.map((move) => move.moveNotation)).toEqual([
      "e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "g6",
    ]);
  });

  it("suggests a free name instead of silently overwriting a study", async () => {
    await createOpeningStudy(sicilian, {
      title: "Siciliana",
      conflict: "error",
    });

    await expect(createOpeningStudy(dragon, {
      title: "Siciliana",
      conflict: "error",
    })).rejects.toMatchObject({
      kind: "lesson",
      suggestedName: "Siciliana (2)",
    } satisfies Partial<OpeningDestinationConflict>);
  });

  it("lists related studies first using persisted opening family metadata", async () => {
    const related = await createOpeningStudy(sicilian, {
      title: "Repertorio principale",
      conflict: "error",
    });
    await createOpeningStudy({
      eco: "C50",
      name: "Italian Game",
      family: "Italian Game",
      pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4",
    }, {
      title: "Altro studio",
      conflict: "error",
    });

    const destinations = await getOpeningStudyDestinations(dragon);

    expect(destinations[0]).toMatchObject({
      lessonId: related.lessonId,
      title: "Repertorio principale",
      related: true,
    });
    expect(destinations[1].related).toBe(false);
  });
});
