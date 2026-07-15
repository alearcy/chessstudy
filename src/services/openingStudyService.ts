import { Chess } from "chess.js";

import db from "@/db/database";
import { buildLessonSearchTerms, createStableId } from "@/db/recordMetadata";
import { refreshLessonSearchIndex } from "@/services/lessonSearchService";
import { ensureDefaultProfile } from "@/services/profileService";
import type { Board, Lesson, Move, OpeningReference } from "@/types";

const DEFAULT_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type OpeningConflictKind = "lesson" | "board";
export type OpeningConflictStrategy = "error" | "overwrite";

export interface OpeningStudyDestination {
  lessonId: number;
  title: string;
  related: boolean;
}

export class OpeningDestinationConflict extends Error {
  constructor(
    public readonly kind: OpeningConflictKind,
    public readonly existingId: number,
    public readonly suggestedName: string,
  ) {
    super(kind === "lesson" ? "Esiste già uno studio con questo nome." : "Esiste già una scacchiera con questo nome.");
    this.name = "OpeningDestinationConflict";
  }
}

interface ParsedOpeningMove {
  san: string;
  fenAfter: string;
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase("it");
}

function nextAvailableName(baseName: string, existingNames: string[]): string {
  const normalized = new Set(existingNames.map(normalizeName));
  if (!normalized.has(normalizeName(baseName))) return baseName;

  let suffix = 2;
  while (normalized.has(normalizeName(`${baseName} (${suffix})`))) suffix += 1;
  return `${baseName} (${suffix})`;
}

function parseOpeningMoves(opening: OpeningReference): ParsedOpeningMove[] {
  const chess = new Chess();
  chess.loadPgn(opening.pgn);
  const history = chess.history({ verbose: true });
  if (history.length === 0) throw new Error("L'apertura selezionata non contiene mosse valide.");
  return history.map((move) => ({ san: move.san, fenAfter: move.after }));
}

function openingBoardData(
  lessonId: number,
  opening: OpeningReference,
  title: string,
  order: number,
): Omit<Board, "id"> {
  return {
    uid: createStableId(),
    lessonId,
    title,
    fen: DEFAULT_FEN,
    notes: "",
    arrows: [],
    highlights: [],
    order,
    createdAt: new Date(),
    updatedAt: new Date(),
    openingEco: opening.eco,
    openingName: opening.name,
    openingFamily: opening.family,
    evalCp: null,
    evalMate: null,
    evalDepth: 0,
    evalBestMoveUci: null,
    whiteName: null,
    blackName: null,
    headers: {},
    gameAnalysis: "",
    openingReport: undefined,
  };
}

async function persistOpeningMoves(
  boardId: number,
  opening: OpeningReference,
): Promise<void> {
  let parentId: number | null = null;
  const moves = parseOpeningMoves(opening);

  for (let order = 0; order < moves.length; order += 1) {
    const move = moves[order];
    const moveId = (await db.moves.add({
      uid: createStableId(),
      boardId,
      moveNotation: move.san,
      fen: move.fenAfter,
      parentId,
      order,
      comment: "",
      arrows: [],
      highlights: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Move)) as number;
    parentId = moveId;
  }
}

async function createOpeningBoard(
  lessonId: number,
  opening: OpeningReference,
  title: string,
  order: number,
): Promise<number> {
  const boardId = (await db.boards.add(
    openingBoardData(lessonId, opening, title, order),
  )) as number;
  await persistOpeningMoves(boardId, opening);
  return boardId;
}

export async function createOpeningStudy(
  opening: OpeningReference,
  options: { title?: string; conflict: OpeningConflictStrategy },
): Promise<{ lessonId: number; boardId: number }> {
  const title = options.title?.trim() || opening.name;
  const profile = await ensureDefaultProfile();

  const result = await db.transaction("rw", db.lessons, db.boards, db.moves, async () => {
    const studies = await db.lessons
      .where("mode")
      .equals("study")
      .filter((lesson) => lesson.profileId === profile.id)
      .toArray();
    const existing = studies.find(
      (lesson) => lesson.id != null && normalizeName(lesson.title) === normalizeName(title),
    );

    let lessonId: number;
    if (existing?.id != null) {
      if (options.conflict === "error") {
        throw new OpeningDestinationConflict(
          "lesson",
          existing.id,
          nextAvailableName(title, studies.map((lesson) => lesson.title)),
        );
      }

      lessonId = existing.id;
      const boards = await db.boards.where("lessonId").equals(lessonId).toArray();
      for (const board of boards) {
        if (board.id != null) await db.moves.where("boardId").equals(board.id).delete();
      }
      await db.boards.where("lessonId").equals(lessonId).delete();
      await db.lessons.update(lessonId, {
        title,
        searchTerms: buildLessonSearchTerms({ title, description: existing.description }),
        updatedAt: new Date(),
      });
    } else {
      const now = new Date();
      lessonId = (await db.lessons.add({
        uid: createStableId(),
        profileId: profile.id,
        title,
        description: "",
        mode: "study",
        isFavorite: false,
        searchTerms: buildLessonSearchTerms({ title, description: "" }),
        createdAt: now,
        updatedAt: now,
      } as Lesson)) as number;
    }

    const boardId = await createOpeningBoard(lessonId, opening, opening.name, 0);
    return { lessonId, boardId };
  });
  await refreshLessonSearchIndex(result.lessonId);
  return result;
}

export async function addOpeningToStudy(
  opening: OpeningReference,
  options: {
    lessonId: number;
    boardTitle?: string;
    conflict: OpeningConflictStrategy;
  },
): Promise<{ lessonId: number; boardId: number }> {
  const boardTitle = options.boardTitle?.trim() || opening.name;

  const result = await db.transaction("rw", db.lessons, db.boards, db.moves, async () => {
    const lesson = await db.lessons.get(options.lessonId);
    if (!lesson || lesson.mode !== "study") {
      throw new Error("Lo studio selezionato non è disponibile.");
    }

    const boards = await db.boards.where("lessonId").equals(options.lessonId).sortBy("order");
    const existing = boards.find(
      (board) => board.id != null && normalizeName(board.title) === normalizeName(boardTitle),
    );

    if (existing?.id != null && options.conflict === "error") {
      throw new OpeningDestinationConflict(
        "board",
        existing.id,
        nextAvailableName(boardTitle, boards.map((board) => board.title)),
      );
    }

    let boardId: number;
    if (existing?.id != null) {
      boardId = existing.id;
      await db.moves.where("boardId").equals(boardId).delete();
      const replacement = openingBoardData(
        options.lessonId,
        opening,
        boardTitle,
        existing.order,
      );
      replacement.uid = existing.uid ?? replacement.uid;
      await db.boards.update(
        boardId,
        replacement,
      );
      await persistOpeningMoves(boardId, opening);
    } else {
      boardId = await createOpeningBoard(
        options.lessonId,
        opening,
        boardTitle,
        boards.length,
      );
    }

    return { lessonId: options.lessonId, boardId };
  });
  await refreshLessonSearchIndex(result.lessonId);
  return result;
}

export async function getOpeningStudyDestinations(
  opening: OpeningReference,
): Promise<OpeningStudyDestination[]> {
  const profile = await ensureDefaultProfile();
  const studies = await db.lessons
    .where("mode")
    .equals("study")
    .filter((lesson) => lesson.profileId === profile.id)
    .toArray();
  const destinations = await Promise.all(studies.flatMap(async (lesson) => {
    if (lesson.id == null) return [];
    const boards = await db.boards.where("lessonId").equals(lesson.id).toArray();
    const related = boards.some(
      (board) => board.openingFamily === opening.family,
    );
    return [{ lessonId: lesson.id, title: lesson.title, related }];
  }));

  return destinations
    .flat()
    .sort((left, right) =>
      Number(right.related) - Number(left.related) ||
      left.title.localeCompare(right.title, "it"),
    );
}
