import { Chess } from "chess.js";

import { createStableId } from "@/lib/dataUtils";
import { supabase } from "@/lib/supabase/client";
import {
  boardPayload,
  lessonPayload,
  movePayload,
} from "@/repositories/supabaseMappers";
import { requireData, throwIfError } from "@/repositories/repositoryError";
import type { OpeningReference } from "@/types";

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
    super(kind === "lesson"
      ? "Esiste già uno studio con questo nome."
      : "Esiste già una scacchiera con questo nome.");
    this.name = "OpeningDestinationConflict";
  }
}

interface StudyRow {
  id: number;
  uid: string;
  title: string;
  description: string;
  mode: "study" | "analysis";
  is_favorite: boolean;
  boards: Array<{
    id: number;
    uid: string;
    title: string;
    board_order: number;
    opening_family: string | null;
  }>;
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

function openingPayload(opening: OpeningReference, boardTitle: string) {
  const chess = new Chess();
  chess.loadPgn(opening.pgn);
  const history = chess.history({ verbose: true });
  if (history.length === 0) {
    throw new Error("L'apertura selezionata non contiene mosse valide.");
  }
  const now = new Date();
  return {
    board: boardPayload({
      uid: createStableId(),
      title: boardTitle,
      fen: DEFAULT_FEN,
      notes: "",
      arrows: [],
      highlights: [],
      openingEco: opening.eco,
      openingName: opening.name,
      openingFamily: opening.family,
      createdAt: now,
      updatedAt: now,
    }),
    moves: history.map((move, order) => movePayload({
      uid: createStableId(),
      moveNotation: move.san,
      fen: move.after,
      order,
      comment: "",
      arrows: [],
      highlights: [],
      createdAt: now,
      updatedAt: now,
    })),
    now,
  };
}

async function getStudies(): Promise<StudyRow[]> {
  const { data, error } = await supabase
    .from("lessons")
    .select("id, uid, title, description, mode, is_favorite, boards(id, uid, title, board_order, opening_family)")
    .eq("mode", "study");
  throwIfError(error);
  return (data ?? []) as StudyRow[];
}

export async function createOpeningStudy(
  opening: OpeningReference,
  options: { title?: string; conflict: OpeningConflictStrategy },
): Promise<{ lessonId: number; boardId: number }> {
  const title = options.title?.trim() || opening.name;
  const studies = await getStudies();
  const existing = studies.find((lesson) =>
    normalizeName(lesson.title) === normalizeName(title));
  if (existing && options.conflict === "error") {
    throw new OpeningDestinationConflict(
      "lesson",
      existing.id,
      nextAvailableName(title, studies.map((lesson) => lesson.title)),
    );
  }

  const { board, moves, now } = openingPayload(opening, opening.name);
  const response = await supabase.rpc("save_lesson_tree", {
    p_lesson_id: existing?.id ?? null,
    p_lesson: lessonPayload({
      uid: existing?.uid ?? createStableId(),
      title,
      description: existing?.description ?? "",
      mode: "study",
      isFavorite: existing?.is_favorite ?? false,
      createdAt: now,
      updatedAt: now,
    }),
    p_board: board,
    p_moves: moves,
    p_replace: existing != null,
  });
  const result = requireData(
    response.data as { lesson_id: number; board_id: number } | null,
    response.error,
    "Creazione studio fallita.",
  );
  return { lessonId: result.lesson_id, boardId: result.board_id };
}

export async function addOpeningToStudy(
  opening: OpeningReference,
  options: {
    lessonId: number;
    boardTitle?: string;
    conflict: OpeningConflictStrategy;
  },
): Promise<{ lessonId: number; boardId: number }> {
  const studies = await getStudies();
  const lesson = studies.find((candidate) => candidate.id === options.lessonId);
  if (!lesson) throw new Error("Lo studio selezionato non è disponibile.");

  const boardTitle = options.boardTitle?.trim() || opening.name;
  const existing = lesson.boards.find((board) =>
    normalizeName(board.title) === normalizeName(boardTitle));
  if (existing && options.conflict === "error") {
    throw new OpeningDestinationConflict(
      "board",
      existing.id,
      nextAvailableName(boardTitle, lesson.boards.map((board) => board.title)),
    );
  }

  const { board, moves } = openingPayload(opening, boardTitle);
  if (existing) board.uid = existing.uid;
  const response = await supabase.rpc("save_board_line", {
    p_lesson_id: lesson.id,
    p_board_id: existing?.id ?? null,
    p_board: board,
    p_moves: moves,
  });
  const result = requireData(
    response.data as { lesson_id: number; board_id: number } | null,
    response.error,
    "Salvataggio variante fallito.",
  );
  return { lessonId: result.lesson_id, boardId: result.board_id };
}

export async function getOpeningStudyDestinations(
  opening: OpeningReference,
): Promise<OpeningStudyDestination[]> {
  const studies = await getStudies();
  return studies
    .map((lesson) => ({
      lessonId: lesson.id,
      title: lesson.title,
      related: lesson.boards.some((board) => board.opening_family === opening.family),
    }))
    .sort((left, right) =>
      Number(right.related) - Number(left.related) ||
      left.title.localeCompare(right.title, "it"));
}
