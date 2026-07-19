import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = resolve(projectRoot, "node_modules/stockfish");
const outputRoot = resolve(projectRoot, "public/stockfish");

const assets = [
  ["bin/stockfish-18-lite.js", "stockfish-18-lite.js"],
  ["bin/stockfish-18-lite.wasm", "stockfish-18-lite.wasm"],
  ["bin/stockfish-18-lite-single.js", "stockfish-18-lite-single.js"],
  ["bin/stockfish-18-lite-single.wasm", "stockfish-18-lite-single.wasm"],
  ["Copying.txt", "Copying.txt"],
];

await mkdir(outputRoot, { recursive: true });
await Promise.all(assets.map(([source, destination]) =>
  cp(resolve(packageRoot, source), resolve(outputRoot, destination)),
));
