import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(process.cwd(), "supabase/migrations");
const migrationName = readdirSync(migrationsDir).find((name) =>
  name.endsWith("_web_auth_schema.sql"),
);
if (!migrationName) throw new Error("Migrazione web_auth_schema non trovata.");
const sql = readFileSync(resolve(migrationsDir, migrationName), "utf8")
  .replace(/\s+/g, " ")
  .toLowerCase();
const allSql = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .map((name) => readFileSync(resolve(migrationsDir, name), "utf8"))
  .join("\n")
  .replace(/\s+/g, " ")
  .toLowerCase();
const searchRefreshFixName = readdirSync(migrationsDir).find((name) =>
  name.endsWith("_fix_search_refresh_trigger_permissions.sql"),
);
if (!searchRefreshFixName) throw new Error("Migrazione fix trigger ricerca non trovata.");
const searchRefreshFixSql = readFileSync(
  resolve(migrationsDir, searchRefreshFixName),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();
const firstPasswordMigrationName = readdirSync(migrationsDir).find((name) =>
  name.endsWith("_require_first_login_password_change.sql"),
);
if (!firstPasswordMigrationName) {
  throw new Error("Migrazione cambio password iniziale non trovata.");
}
const firstPasswordSql = readFileSync(
  resolve(migrationsDir, firstPasswordMigrationName),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("Supabase web auth schema", () => {
  it.each(["user_settings", "lessons", "boards", "moves"])(
    "creates %s with RLS and owner policies",
    (table) => {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toMatch(new RegExp(`on public\\.${table} for select to authenticated using \\(`));
      expect(sql).toMatch(new RegExp(`on public\\.${table} for update to authenticated using \\(`));
      expect(sql).toMatch(new RegExp(`on public\\.${table} for update.*with check \\(`));
    },
  );

  it("uses database-enforced ownership and indexed relationships", () => {
    expect(sql).toContain("user_id uuid not null default auth.uid()");
    expect(sql).toContain("foreign key (lesson_id, user_id)");
    expect(sql).toContain("foreign key (board_id, user_id)");
    expect(sql).toContain("foreign key (parent_id, board_id, user_id)");
    expect(sql).toContain("create index lessons_user_created_idx");
    expect(sql).toContain("create index boards_lesson_id_idx");
    expect(sql).toContain("create index moves_board_id_idx");
  });

  it("exposes only the minimum Data API privileges", () => {
    expect(sql).toMatch(/revoke all on table public\.user_settings, public\.lessons, public\.boards, public\.moves from public, anon/);
    expect(sql).toMatch(/grant select, insert, update, delete on table public\.user_settings, public\.lessons, public\.boards, public\.moves to authenticated/);
    expect(sql).toMatch(/grant usage, select on sequence public\.lessons_id_seq, public\.boards_id_seq, public\.moves_id_seq to authenticated/);
    expect(sql).not.toMatch(/grant [^;]+ to anon/);
  });

  it.each([
    "import_database_backup_v1",
    "convert_analysis_to_study",
    "save_lesson_tree",
    "save_board_line",
  ])("defines restricted security-invoker RPC %s", (functionName) => {
    expect(allSql).toContain(`function public.${functionName}`);
    expect(allSql).toMatch(
      new RegExp(`function public\\.${functionName}[^;]+security invoker`),
    );
    expect(allSql).toMatch(
      new RegExp(`revoke execute on function public\\.${functionName}[^;]+from public, anon`),
    );
    expect(allSql).toMatch(
      new RegExp(`grant execute on function public\\.${functionName}[^;]+to authenticated`),
    );
  });

  it("validates the complete backup graph before importing rows", () => {
    expect(allSql).toContain("formato o versione del backup non supportati");
    expect(allSql).toContain("il backup contiene una scacchiera orfana");
    expect(allSql).toContain("il backup contiene una mossa orfana");
  });

  it("refreshes lesson search text without calling a revoked helper", () => {
    expect(searchRefreshFixSql).toContain(
      "create or replace function public.handle_lesson_search_refresh()",
    );
    expect(searchRefreshFixSql).not.toContain("perform public.refresh_lesson_search_text");
    expect(searchRefreshFixSql).toContain(
      "drop function public.refresh_lesson_search_text(bigint)",
    );
  });

  it("creates a read-only first-access gate driven by Supabase Auth", () => {
    expect(firstPasswordSql).toContain("create table public.user_security_state");
    expect(firstPasswordSql).toContain(
      "alter table public.user_security_state enable row level security",
    );
    expect(firstPasswordSql).toContain(
      "on public.user_security_state for select to authenticated",
    );
    expect(firstPasswordSql).toContain(
      "grant select on table public.user_security_state to authenticated",
    );
    expect(firstPasswordSql).not.toMatch(/grant (insert|update|delete)/);
    expect(firstPasswordSql).toContain(
      "after insert or update of encrypted_password on auth.users",
    );
    expect(firstPasswordSql).toContain("set must_change_password = false");
    expect(firstPasswordSql).toContain("security definer set search_path = ''");
    expect(firstPasswordSql).toContain(
      "revoke all on function private.sync_user_security_state() from public, anon, authenticated",
    );
  });
});
