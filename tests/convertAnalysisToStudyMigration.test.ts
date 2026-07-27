import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260719141132_convert_analysis_to_study_moves_only.sql",
);
const sql = readFileSync(migrationPath, "utf8");

function insertedColumns(table: "boards" | "moves"): string[] {
  const match = sql.match(
    new RegExp(`insert into public\\.${table}\\s*\\(([^)]+)\\)`, "i"),
  );
  if (!match) return [];
  return match[1].split(",").map((column) => column.trim());
}

describe("convert_analysis_to_study moves-only migration", () => {
  it("replaces the restricted security-invoker RPC", () => {
    expect(sql).toContain("create or replace function public.convert_analysis_to_study");
    expect(sql).toContain("security invoker");
    expect(sql).toMatch(/revoke execute[^;]+from public, anon/);
    expect(sql).toMatch(/grant execute[^;]+to authenticated/);
  });

  it("copies only structural board data and the move sequence", () => {
    expect(insertedColumns("boards")).toEqual([
      "user_id",
      "uid",
      "lesson_id",
      "title",
      "fen",
      "board_order",
      "created_at",
      "updated_at",
    ]);
    expect(insertedColumns("moves")).toEqual([
      "user_id",
      "uid",
      "board_id",
      "parent_id",
      "move_notation",
      "fen",
      "move_order",
      "created_at",
      "updated_at",
    ]);
  });

  it("does not copy comments, annotations, evaluations or analysis reports", () => {
    for (const sourceField of [
      "v_source_board.notes",
      "v_source_board.arrows",
      "v_source_board.eval_cp",
      "v_source_board.game_analysis",
      "v_source_board.opening_report",
      "v_source_move.comment",
      "v_source_move.analysis_comment",
      "v_source_move.stockfish_comment",
      "v_source_move.arrows",
      "v_source_move.eval_cp",
      "v_source_move.eval_best_move_uci",
    ]) {
      expect(sql).not.toContain(sourceField);
    }
  });
});
