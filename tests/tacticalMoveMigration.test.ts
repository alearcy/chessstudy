import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(process.cwd(), "supabase/migrations");

describe("move tactics migration", () => {
  it("adds structured tactics and keeps old backups compatible", () => {
    const migrationName = readdirSync(migrationsDir).find((name) =>
      name.endsWith("_add_move_tactics.sql"),
    );
    expect(migrationName).toBeDefined();
    if (!migrationName) return;

    const migrationPath = resolve(migrationsDir, migrationName);
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf8").toLowerCase();

    expect(sql).toContain("add column tactics jsonb not null default '[]'::jsonb");
    expect(sql).toContain("jsonb_typeof(tactics) = 'array'");
    expect(sql).toContain("create or replace function public.import_database_backup_v1");
    expect(sql).toContain("coalesce(v_move -> 'tactics', '[]'::jsonb)");
  });
});
