import { toJson } from "@/lib/dataUtils";
import { tacticalPatternsFromJson } from "@/lib/tacticalPatterns";
import type {
  Tables,
  TablesInsert,
} from "@/lib/supabase/database.types";
import type {
  Board,
  BoardArrow,
  BoardHighlight,
  Lesson,
  Move,
  OpeningReport,
} from "@/types";

export type LessonRow = Omit<
  Tables<"lessons">,
  "mode" | "search_text" | "user_id"
> & {
  mode: Lesson["mode"];
};
export type BoardRow = Omit<Tables<"boards">, "user_id">;
export type MoveRow = Omit<Tables<"moves">, "user_id">;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function lessonFromRow(row: LessonRow): Lesson {
  return {
    id: row.id,
    uid: row.uid,
    title: row.title,
    description: row.description,
    mode: row.mode,
    isFavorite: row.is_favorite,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function boardFromRow(row: BoardRow): Board {
  return {
    id: row.id,
    uid: row.uid,
    lessonId: row.lesson_id,
    title: row.title,
    fen: row.fen,
    notes: row.notes,
    arrows: Array.isArray(row.arrows) ? row.arrows as BoardArrow[] : [],
    highlights: Array.isArray(row.highlights) ? row.highlights as BoardHighlight[] : [],
    order: row.board_order,
    evalCp: row.eval_cp,
    evalMate: row.eval_mate,
    evalDepth: row.eval_depth,
    evalBestMoveUci: row.eval_best_move_uci,
    whiteName: row.white_name,
    blackName: row.black_name,
    headers: record(row.headers) as Record<string, string | null>,
    gameAnalysis: row.game_analysis ?? undefined,
    openingReport: row.opening_report
      ? record(row.opening_report) as unknown as OpeningReport
      : undefined,
    openingEco: row.opening_eco ?? undefined,
    openingName: row.opening_name ?? undefined,
    openingFamily: row.opening_family ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function moveFromRow(row: MoveRow): Move {
  return {
    id: row.id,
    uid: row.uid,
    boardId: row.board_id,
    parentId: row.parent_id,
    moveNotation: row.move_notation,
    fen: row.fen,
    order: row.move_order,
    comment: row.comment,
    analysisComment: row.analysis_comment,
    stockfishComment: row.stockfish_comment,
    arrows: Array.isArray(row.arrows) ? row.arrows as BoardArrow[] : [],
    highlights: Array.isArray(row.highlights) ? row.highlights as BoardHighlight[] : [],
    tactics: tacticalPatternsFromJson(row.tactics),
    evalCp: row.eval_cp,
    evalMate: row.eval_mate,
    evalDepth: row.eval_depth,
    evalBestMoveUci: row.eval_best_move_uci,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function lessonPayload(
  lesson: Partial<Lesson> & Pick<Lesson, "title" | "description" | "mode">,
): Omit<TablesInsert<"lessons">, "id" | "search_text" | "user_id"> {
  return {
    ...(lesson.uid ? { uid: lesson.uid } : {}),
    title: lesson.title,
    description: lesson.description,
    mode: lesson.mode,
    is_favorite: lesson.isFavorite ?? false,
    ...(lesson.createdAt ? { created_at: lesson.createdAt.toISOString() } : {}),
    ...(lesson.updatedAt ? { updated_at: lesson.updatedAt.toISOString() } : {}),
  };
}

export function boardPayload(
  board: Partial<Board> & Pick<Board, "title" | "fen">,
): Omit<TablesInsert<"boards">, "board_order" | "id" | "lesson_id" | "user_id"> {
  return {
    ...(board.uid ? { uid: board.uid } : {}),
    title: board.title,
    fen: board.fen,
    notes: board.notes ?? "",
    arrows: toJson(board.arrows ?? []),
    highlights: toJson(board.highlights ?? []),
    eval_cp: board.evalCp ?? null,
    eval_mate: board.evalMate ?? null,
    eval_depth: board.evalDepth ?? 0,
    eval_best_move_uci: board.evalBestMoveUci ?? null,
    white_name: board.whiteName ?? null,
    black_name: board.blackName ?? null,
    headers: toJson(board.headers ?? {}),
    game_analysis: board.gameAnalysis ?? null,
    opening_report: board.openingReport ? toJson(board.openingReport) : null,
    opening_eco: board.openingEco ?? null,
    opening_name: board.openingName ?? null,
    opening_family: board.openingFamily ?? null,
    ...(board.createdAt ? { created_at: board.createdAt.toISOString() } : {}),
    ...(board.updatedAt ? { updated_at: board.updatedAt.toISOString() } : {}),
  };
}

export function movePayload(
  move: Partial<Move> & Pick<Move, "moveNotation" | "fen" | "order">,
): Omit<TablesInsert<"moves">, "board_id" | "id" | "parent_id" | "user_id"> {
  return {
    ...(move.uid ? { uid: move.uid } : {}),
    move_notation: move.moveNotation,
    fen: move.fen,
    move_order: move.order,
    comment: move.comment ?? "",
    analysis_comment: move.analysisComment ?? null,
    stockfish_comment: move.stockfishComment ?? null,
    arrows: toJson(move.arrows ?? []),
    highlights: toJson(move.highlights ?? []),
    tactics: toJson(move.tactics ?? []),
    eval_cp: move.evalCp ?? null,
    eval_mate: move.evalMate ?? null,
    eval_depth: move.evalDepth ?? 0,
    eval_best_move_uci: move.evalBestMoveUci ?? null,
    ...(move.createdAt ? { created_at: move.createdAt.toISOString() } : {}),
    ...(move.updatedAt ? { updated_at: move.updatedAt.toISOString() } : {}),
  };
}
