import { describe, expect, it } from "vitest";

import {
  boardFromRow,
  lessonFromRow,
  moveFromRow,
} from "@/repositories/supabaseMappers";

describe("Supabase data mappers", () => {
  it("maps lesson rows to the existing frontend contract", () => {
    expect(lessonFromRow({
      id: 12,
      uid: "10000000-0000-4000-8000-000000000012",
      title: "Finali",
      description: "Torri",
      mode: "study",
      is_favorite: true,
      created_at: "2026-07-18T10:00:00.000Z",
      updated_at: "2026-07-18T11:00:00.000Z",
    })).toEqual({
      id: 12,
      uid: "10000000-0000-4000-8000-000000000012",
      title: "Finali",
      description: "Torri",
      mode: "study",
      isFavorite: true,
      createdAt: new Date("2026-07-18T10:00:00.000Z"),
      updatedAt: new Date("2026-07-18T11:00:00.000Z"),
    });
  });

  it("preserves board JSON and nullable analysis fields", () => {
    expect(boardFromRow({
      id: 21,
      uid: "20000000-0000-4000-8000-000000000021",
      lesson_id: 12,
      title: "Principale",
      fen: "start",
      notes: "",
      arrows: [["e2", "e4", "green"]],
      highlights: [["d4", "yellow"]],
      board_order: 0,
      eval_cp: null,
      eval_mate: 3,
      eval_depth: 15,
      eval_best_move_uci: "e2e4",
      white_name: "Bianco",
      black_name: "Nero",
      headers: { Event: "Test" },
      game_analysis: null,
      opening_report: null,
      opening_eco: null,
      opening_name: null,
      opening_family: null,
      created_at: "2026-07-18T10:00:00.000Z",
      updated_at: "2026-07-18T11:00:00.000Z",
    })).toMatchObject({
      id: 21,
      lessonId: 12,
      order: 0,
      arrows: [["e2", "e4", "green"]],
      highlights: [["d4", "yellow"]],
      evalMate: 3,
      gameAnalysis: undefined,
      headers: { Event: "Test" },
      createdAt: new Date("2026-07-18T10:00:00.000Z"),
    });
  });

  it("maps move rows and keeps the rebuilt parent chain", () => {
    expect(moveFromRow({
      id: 31,
      uid: "30000000-0000-4000-8000-000000000031",
      board_id: 21,
      parent_id: 30,
      move_notation: "e4",
      fen: "after-e4",
      move_order: 1,
      comment: "",
      analysis_comment: null,
      stockfish_comment: "Buona mossa",
      arrows: [],
      highlights: [],
      eval_cp: 24,
      eval_mate: null,
      eval_depth: 15,
      eval_best_move_uci: "e7e5",
      created_at: "2026-07-18T10:00:00.000Z",
      updated_at: "2026-07-18T11:00:00.000Z",
    })).toMatchObject({
      id: 31,
      boardId: 21,
      parentId: 30,
      moveNotation: "e4",
      order: 1,
      stockfishComment: "Buona mossa",
      evalCp: 24,
      updatedAt: new Date("2026-07-18T11:00:00.000Z"),
    });
  });
});
