import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260725120615_reorder_study_boards.sql",
);
const sql = readFileSync(migrationPath, "utf8");

describe("reorder study boards migration", () => {
  it("exposes a restricted security-invoker RPC for study owners", () => {
    expect(sql).toContain(
      "create or replace function public.reorder_study_boards",
    );
    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toMatch(/revoke execute[^;]+from public, anon/);
    expect(sql).toMatch(/grant execute[^;]+to authenticated/);
    expect(sql).toContain("and l.mode = 'study'");
    expect(sql).toContain("and l.user_id = v_user_id");
  });

  it("requires a unique and complete list of lesson board ids", () => {
    expect(sql).toContain("count(distinct requested.board_id)");
    expect(sql).toContain("array_length(p_board_ids, 1)");
    expect(sql).toContain("Scacchiere duplicate nell''ordine richiesto.");
    expect(sql).toContain("L''ordine deve includere tutte le scacchiere.");
  });

  it("locks rows consistently and assigns collision-free zero-based positions", () => {
    expect(sql).toMatch(/order by b\.id\s+for update/);
    expect(sql).toContain("set board_order = board_order + v_offset");
    expect(sql).toContain("with ordinality");
    expect(sql).toContain("ordinality - 1");
  });
});
