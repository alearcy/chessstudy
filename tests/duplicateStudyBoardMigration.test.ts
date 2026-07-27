import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260725111651_duplicate_study_board.sql",
);
const sql = readFileSync(migrationPath, "utf8");

describe("duplicate study board migration", () => {
  it("exposes a restricted security-invoker RPC", () => {
    expect(sql).toContain(
      "create or replace function public.duplicate_study_board",
    );
    expect(sql).toContain("security invoker");
    expect(sql).toMatch(/revoke execute[^;]+from public, anon/);
    expect(sql).toMatch(/grant execute[^;]+to authenticated/);
    expect(sql).toContain("and l.mode = 'study'");
  });

  it("copies the complete board content with a new identity", () => {
    for (const sourceField of [
      "v_source_board.fen",
      "v_source_board.notes",
      "v_source_board.arrows",
      "v_source_board.highlights",
      "v_source_board.eval_cp",
      "v_source_board.headers",
      "v_source_board.game_analysis",
      "v_source_board.opening_report",
    ]) {
      expect(sql).toContain(sourceField);
    }

    expect(sql).toContain("v_source_board.title || ' (copia)'");
    expect(sql).toContain("gen_random_uuid()");
  });

  it("copies every move field and remaps parent ids", () => {
    for (const sourceField of [
      "v_source_move.move_notation",
      "v_source_move.fen",
      "v_source_move.comment",
      "v_source_move.analysis_comment",
      "v_source_move.stockfish_comment",
      "v_source_move.arrows",
      "v_source_move.highlights",
      "v_source_move.tactics",
      "v_source_move.eval_cp",
      "v_source_move.eval_best_move_uci",
    ]) {
      expect(sql).toContain(sourceField);
    }

    expect(sql).toContain("v_source_move.parent_id::text");
    expect(sql).toContain("v_move_id_map");
  });
});
