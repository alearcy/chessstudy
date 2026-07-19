import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("static web deployment", () => {
  it("non distribuisce piu runtime o dipendenze Tauri", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(root, "package.json"), "utf8"),
    ) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(packageJson.scripts).not.toHaveProperty("tauri");
    expect([
      ...Object.keys(packageJson.dependencies),
      ...Object.keys(packageJson.devDependencies),
    ].filter((name) => name.startsWith("@tauri-apps/"))).toEqual([]);
    expect(existsSync(resolve(root, "src-tauri"))).toBe(false);
  });

  it("configura fallback SPA e isolamento cross-origin per Cloudflare Pages", () => {
    const redirects = readFileSync(resolve(root, "public/_redirects"), "utf8");
    const headers = readFileSync(resolve(root, "public/_headers"), "utf8");

    expect(redirects).toContain("/* /index.html 200");
    expect(headers).toContain("Cross-Origin-Opener-Policy: same-origin");
    expect(headers).toContain("Cross-Origin-Embedder-Policy: require-corp");
    expect(headers).toContain("X-Content-Type-Options: nosniff");
  });

  it("pubblica soltanto asset statici nel progetto Pages chessstudy", () => {
    const wranglerConfig = JSON.parse(
      readFileSync(resolve(root, "wrangler.jsonc"), "utf8"),
    ) as Record<string, unknown>;

    expect(wranglerConfig).toMatchObject({
      name: "chessstudy",
      pages_build_output_dir: "./dist",
    });
    expect(wranglerConfig).not.toHaveProperty("main");
    expect(wranglerConfig).not.toHaveProperty("d1_databases");
    expect(wranglerConfig).not.toHaveProperty("kv_namespaces");
    expect(wranglerConfig).not.toHaveProperty("r2_buckets");
    expect(wranglerConfig).not.toHaveProperty("services");
    expect(wranglerConfig).not.toHaveProperty("ai");
  });

  it("configura il dominio Pages per i redirect Auth di produzione", () => {
    const supabaseConfig = readFileSync(
      resolve(root, "supabase/config.toml"),
      "utf8",
    );

    expect(supabaseConfig).toContain(
      'site_url = "https://chessstudy.pages.dev"',
    );
    expect(supabaseConfig).toContain(
      '"https://chessstudy.pages.dev/auth/confirm"',
    );
    expect(supabaseConfig).toContain(
      '"https://chessstudy.pages.dev/auth/update-password"',
    );
    expect(supabaseConfig).toContain(
      '"http://localhost:5173/auth/confirm"',
    );
  });
});
