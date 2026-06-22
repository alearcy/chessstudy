import type { EvalFields } from "@/types";

/**
 * Stockfish 18 (lite single-threaded) wrapper.
 *
 * Engine: `public/stockfish/stockfish-18-lite-single.js` + `stockfish.wasm`
 * (vedi docs/adr/0001-stockfish-in-browser.md). Lo script glue emscripten è
 * già uno worker classic: `new Worker(url)` e si parla UCI via postMessage.
 * Single-threaded → niente SharedArrayBuffer → niente COOP/COEP.
 */

const ENGINE_URL =
  import.meta.env.BASE_URL + "stockfish/stockfish-18-lite-single.js";

export interface PositionEval {
  fen: string;
  depth: number;
  /** centesimi di pedone, POV Bianco (null se mate o non disponibile). */
  scoreCp: number | null;
  /** mosse a mate, POV Bianco (+ Bianco matta, - Bianco viene mattato). */
  scoreMate: number | null;
  /** miglior mossa UCI (es. "e2e4"), null se posizione terminale. */
  bestMoveUci: string | null;
}

type LineListener = (line: string) => void;

class StockfishEngine {
  private worker: Worker;
  private listener: LineListener | null = null;
  private readyPromise: Promise<void>;

  constructor() {
    this.worker = new Worker(ENGINE_URL);
    this.worker.onmessage = (e: MessageEvent) => {
      const data = e.data;
      const line = typeof data === "string" ? data : "";
      if (line) this.listener?.(line);
    };
    this.worker.onerror = (e: ErrorEvent) => {
      console.error("[stockfish] worker error", e.message ?? e);
    };
    this.readyPromise = this.init();
  }

  private init(): Promise<void> {
    return new Promise<void>((resolve) => {
      const onLine: LineListener = (line) => {
        if (line === "uciok") {
          this.send("isready");
        } else if (line === "readyok") {
          this.listener = null;
          resolve();
        }
      };
      this.listener = onLine;
      this.send("uci");
    });
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  /** Analizza una singola posizione a profondità fissa. */
  analyze(fen: string, depth: number): Promise<PositionEval> {
    return new Promise<PositionEval>((resolve) => {
      let bestCp: number | null = null;
      let bestMate: number | null = null;
      let bestDepth = 0;
      let bestMove: string | null = null;

      // Lato al tratto dal FEN per normalizzare al POV Bianco.
      const sideToMove = fen.split(" ")[1];
      const blackToMove = sideToMove === "b";

      const onLine: LineListener = (line) => {
        if (line.startsWith("info") && line.includes(" score ")) {
          const depthM = line.match(/ depth (\d+)/);
          const cpM = line.match(/score cp (-?\d+)/);
          const mateM = line.match(/score mate (-?\d+)/);
          if (cpM) {
            bestCp = parseInt(cpM[1], 10);
            bestMate = null;
          } else if (mateM) {
            bestMate = parseInt(mateM[1], 10);
            bestCp = null;
          }
          if (depthM) bestDepth = parseInt(depthM[1], 10);
        } else if (line.startsWith("bestmove")) {
          const m = line.match(/bestmove (\S+)/);
          bestMove = m && m[1] !== "(none)" ? m[1] : null;
          this.listener = null;
          // Normalizza al POV Bianco (l'engine riporta POV lato al tratto).
          const scoreCp =
            bestCp == null ? null : blackToMove ? -bestCp : bestCp;
          const scoreMate =
            bestMate == null ? null : blackToMove ? -bestMate : bestMate;
          resolve({
            fen,
            depth: bestDepth,
            scoreCp,
            scoreMate,
            bestMoveUci: bestMove,
          });
        }
      };
      this.listener = onLine;
      this.send("position fen " + fen);
      this.send("go depth " + depth);
    });
  }

  terminate() {
    this.worker.terminate();
  }
}

// Singleton: un solo engine per sessione (costoso da istanziare).
let engineInstance: StockfishEngine | null = null;
export function getEngine(): StockfishEngine {
  if (!engineInstance) engineInstance = new StockfishEngine();
  return engineInstance;
}

export interface AnalyzeOptions {
  depth?: number;
  onProgress?: (done: number, total: number) => void;
  /** Oggetto mutabile: settare `cancelled = true` per interrompere. */
  signal?: { cancelled: boolean };
}

/**
 * Analizza una sequenza di posizioni (FEN) in ordine. Risolve con gli eval
 * (POV Bianco). Interruzione cooperativa via `signal.cancelled`.
 */
export async function analyzePositions(
  fens: string[],
  options: AnalyzeOptions = {}
): Promise<PositionEval[]> {
  const depth = options.depth ?? 15;
  const engine = getEngine();
  await engine.whenReady();
  const results: PositionEval[] = [];
  for (let i = 0; i < fens.length; i++) {
    if (options.signal?.cancelled) break;
    const ev = await engine.analyze(fens[i], depth);
    results.push(ev);
    options.onProgress?.(i + 1, fens.length);
  }
  return results;
}

// --- Helpers di formatting / classificazione (POV Bianco) ---

/** Converte eval in un numero confrontabile (mate → ±100000 - n). */
export function evalScore(evalCp: number | null, evalMate: number | null): number {
  if (evalMate != null) {
    return evalMate > 0 ? 100000 - evalMate : -100000 - evalMate;
  }
  if (evalCp != null) return evalCp;
  return 0;
}

/** Formatta un eval per display: "+1.2", "M3", "‑M5", "—". */
export function formatEval(
  evalCp: number | null,
  evalMate: number | null
): string {
  if (evalMate != null) {
    return evalMate > 0 ? `M${evalMate}` : `-M${Math.abs(evalMate)}`;
  }
  if (evalCp != null) {
    const pawns = evalCp / 100;
    return (pawns >= 0 ? "+" : "") + pawns.toFixed(1);
  }
  return "—";
}

/** Colore badge per una mossa in base al centipawn loss (POV del mosritore). */
export function moveClassification(cpLoss: number | null): {
  label: string;
  color: string;
} | null {
  if (cpLoss == null) return null;
  if (cpLoss >= 300) return { label: "??", color: "rgb(220,38,38)" }; // blunder
  if (cpLoss >= 200) return { label: "?", color: "rgb(234,88,12)" }; // mistake
  if (cpLoss >= 100) return { label: "?!", color: "rgb(202,138,4)" }; // inaccuracy
  return null; // good
}

/** Converte UCI "e2e4" / "e7e8q" in [from, to] per BoardArrow. */
export function uciToArrow(uci: string): [string, string] | null {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
  return [uci.slice(0, 2), uci.slice(2, 4)];
}

/** Estrae i campi EvalFields da un PositionEval. */
export function toEvalFields(ev: PositionEval): EvalFields {
  return {
    evalCp: ev.scoreCp,
    evalMate: ev.scoreMate,
    evalDepth: ev.depth,
    evalBestMoveUci: ev.bestMoveUci,
  };
}
