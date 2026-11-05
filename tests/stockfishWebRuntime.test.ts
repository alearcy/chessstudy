import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Stockfish web distribution", () => {
  it.each([
    "stockfish-19-lite.js",
    "stockfish-19-lite.wasm",
    "stockfish-19-lite-single.js",
    "stockfish-19-lite-single.wasm",
    "Copying.txt",
    "SOURCE.txt",
  ])("ships %s", (asset) => {
    expect(existsSync(resolve(process.cwd(), "public/stockfish", asset))).toBe(true);
  });

  it("configures cross-origin isolation in dev and preview", () => {
    const config = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");
    expect(config).toContain('"Cross-Origin-Opener-Policy": "same-origin"');
    expect(config).toContain('"Cross-Origin-Embedder-Policy": "require-corp"');
    expect(config).toContain("server:");
    expect(config).toContain("preview:");
  });
});
