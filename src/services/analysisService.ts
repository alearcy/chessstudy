import type { EvalFields } from "@/types";
import {
  DEFAULT_APP_SETTINGS,
  getAppSettings,
} from "@/services/settingsService";

const MULTI_ENGINE_URL = import.meta.env.BASE_URL + "stockfish/stockfish-18-lite.js";
const SINGLE_ENGINE_URL = import.meta.env.BASE_URL + "stockfish/stockfish-18-lite-single.js";

export interface StockfishCapabilities {
  crossOriginIsolated: boolean;
  hasSharedArrayBuffer: boolean;
  hardwareConcurrency: number;
}

export interface StockfishRuntime {
  flavor: "multi" | "single";
  workerUrl: string;
  threads: number;
  compatibilityMode: boolean;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

function browserCapabilities(): StockfishCapabilities {
  return {
    crossOriginIsolated: globalThis.crossOriginIsolated === true,
    hasSharedArrayBuffer: typeof globalThis.SharedArrayBuffer !== "undefined",
    hardwareConcurrency: typeof navigator !== "undefined"
      ? clampInteger(navigator.hardwareConcurrency || 1, 1, 32)
      : 1,
  };
}

export function selectStockfishRuntime(
  capabilities: StockfishCapabilities,
  requestedThreads: number,
): StockfishRuntime {
  const canUseThreads = capabilities.crossOriginIsolated
    && capabilities.hasSharedArrayBuffer;
  if (!canUseThreads) {
    return {
      flavor: "single",
      workerUrl: SINGLE_ENGINE_URL,
      threads: 1,
      compatibilityMode: true,
    };
  }
  const hardwareLimit = clampInteger(capabilities.hardwareConcurrency, 1, 32);
  return {
    flavor: "multi",
    workerUrl: MULTI_ENGINE_URL,
    threads: clampInteger(requestedThreads, 1, hardwareLimit),
    compatibilityMode: false,
  };
}

export function getStockfishRuntimeInfo(requestedThreads = 2): StockfishRuntime {
  return selectStockfishRuntime(browserCapabilities(), requestedThreads);
}

export function buildStockfishCommands(
  fen: string,
  depth: number,
  multipv: number,
  runtime: StockfishRuntime,
): string[] {
  return [
    `setoption name Threads value ${runtime.threads}`,
    `setoption name MultiPV value ${clampInteger(multipv, 1, 3)}`,
    `position fen ${fen}`,
    `go depth ${clampInteger(depth, 1, 30)}`,
  ];
}

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

export interface StockfishEngineHandle {
  runtime: StockfishRuntime;
  whenReady: () => Promise<void>;
  analyze: (fen: string, depth: number, multipv?: number) => Promise<PositionEval>;
  terminate: () => void;
}

type StockfishEngineFactory = (
  runtime: StockfishRuntime,
) => StockfishEngineHandle;

type WorkerFactory = (url: string) => Worker;

export function parseStockfishEvaluation(
  fen: string,
  lines: string[],
): PositionEval | null {
  let scoreCp: number | null = null;
  let scoreMate: number | null = null;
  let depth = 0;
  let bestMoveUci: string | null = null;
  let isComplete = false;

  for (const line of lines) {
    if (line.startsWith("info") && line.includes(" score ")) {
      const depthMatch = line.match(/ depth (\d+)/);
      const cpMatch = line.match(/score cp (-?\d+)/);
      const mateMatch = line.match(/score mate (-?\d+)/);
      if (cpMatch) {
        scoreCp = Number.parseInt(cpMatch[1], 10);
        scoreMate = null;
      } else if (mateMatch) {
        scoreMate = Number.parseInt(mateMatch[1], 10);
        scoreCp = null;
      }
      if (depthMatch) depth = Number.parseInt(depthMatch[1], 10);
    } else if (line.startsWith("bestmove")) {
      const bestMoveMatch = line.match(/bestmove (\S+)/);
      bestMoveUci = bestMoveMatch && bestMoveMatch[1] !== "(none)"
        ? bestMoveMatch[1]
        : null;
      isComplete = true;
    }
  }

  if (!isComplete) return null;
  const blackToMove = fen.split(" ")[1] === "b";
  return {
    fen,
    depth,
    scoreCp: scoreCp == null || !blackToMove ? scoreCp : -scoreCp,
    scoreMate: scoreMate == null || !blackToMove ? scoreMate : -scoreMate,
    bestMoveUci,
  };
}

export class StockfishEngine implements StockfishEngineHandle {
  private worker: Worker;
  private listener: LineListener | null = null;
  private rejectCurrent: ((reason: Error) => void) | null = null;
  private readyPromise: Promise<void>;
  private analysisTail: Promise<void> = Promise.resolve();

  constructor(
    readonly runtime: StockfishRuntime,
    createWorker: WorkerFactory = (url) => new Worker(url),
  ) {
    this.worker = createWorker(runtime.workerUrl);
    this.worker.onmessage = (e: MessageEvent) => {
      const data = e.data;
      const line = typeof data === "string" ? data : "";
      if (line) this.listener?.(line);
    };
    this.worker.onerror = (e: ErrorEvent) => {
      console.error("[stockfish] worker error", e.message ?? e);
      const error = new Error(e.message || "Avvio di Stockfish non riuscito.");
      this.listener = null;
      const reject = this.rejectCurrent;
      this.rejectCurrent = null;
      reject?.(error);
    };
    this.readyPromise = this.init();
  }

  private init(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.rejectCurrent = reject;
      const onLine: LineListener = (line) => {
        if (line === "uciok") {
          this.send("isready");
        } else if (line === "readyok") {
          this.listener = null;
          this.rejectCurrent = null;
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
  analyze(fen: string, depth: number, multipv = 1): Promise<PositionEval> {
    const run = this.analysisTail
      .then(() => this.readyPromise)
      .then(() => this.analyzeNow(fen, depth, multipv));
    this.analysisTail = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private analyzeNow(fen: string, depth: number, multipv: number): Promise<PositionEval> {
    return new Promise<PositionEval>((resolve, reject) => {
      const outputLines: string[] = [];
      this.rejectCurrent = reject;

      const onLine: LineListener = (line) => {
        if (line.startsWith("info") && line.includes(" score ")) {
          outputLines.push(line);
        } else if (line.startsWith("bestmove")) {
          outputLines.push(line);
          const evaluation = parseStockfishEvaluation(fen, outputLines);
          this.listener = null;
          this.rejectCurrent = null;
          if (evaluation) resolve(evaluation);
        }
      };
      this.listener = onLine;
      for (const command of buildStockfishCommands(fen, depth, multipv, this.runtime)) {
        this.send(command);
      }
    });
  }

  terminate() {
    this.worker.terminate();
  }
}

// Singleton: un solo engine per sessione (costoso da istanziare).
let engineInstance: StockfishEngine | null = null;
export function getEngine(runtime: StockfishRuntime): StockfishEngine {
  if (
    !engineInstance
    || engineInstance.runtime.flavor !== runtime.flavor
    || engineInstance.runtime.threads !== runtime.threads
  ) {
    engineInstance?.terminate();
    engineInstance = new StockfishEngine(runtime);
  }
  return engineInstance;
}

function terminateEngine(engine: StockfishEngineHandle): void {
  engine.terminate();
  if (engine === engineInstance) engineInstance = null;
}

export async function prepareStockfishEngine(
  runtime: StockfishRuntime,
  createEngine: StockfishEngineFactory = getEngine,
): Promise<StockfishEngineHandle> {
  const engine = createEngine(runtime);
  try {
    await engine.whenReady();
    return engine;
  } catch (error) {
    terminateEngine(engine);
    if (runtime.flavor === "single") throw error;
  }

  const fallbackRuntime: StockfishRuntime = {
    flavor: "single",
    workerUrl: SINGLE_ENGINE_URL,
    threads: 1,
    compatibilityMode: true,
  };
  const fallbackEngine = createEngine(fallbackRuntime);
  try {
    await fallbackEngine.whenReady();
    return fallbackEngine;
  } catch (error) {
    terminateEngine(fallbackEngine);
    throw error;
  }
}

export interface AnalyzeOptions {
  depth?: number;
  threads?: number;
  multipv?: number;
  onProgress?: (done: number, total: number) => void;
  /** Oggetto mutabile: settare `cancelled = true` per interrompere. */
  signal?: { cancelled: boolean };
}

interface AnalysisQueueJob {
  fens: string[];
  options: AnalyzeOptions;
  resolve: (value: PositionEval[]) => void;
  reject: (reason?: unknown) => void;
}

const analysisQueue: AnalysisQueueJob[] = [];
let analysisQueueRunning = false;

/**
 * Analizza una sequenza di posizioni (FEN) in ordine. Risolve con gli eval
 * (POV Bianco). Interruzione cooperativa via `signal.cancelled`.
 *
 * Usa Stockfish 18 lite WASM multi-threaded quando il browser e isolato;
 * altrimenti forza il worker single-threaded in modalita compatibilita.
 */
export async function analyzePositions(
  fens: string[],
  options: AnalyzeOptions = {}
): Promise<PositionEval[]> {
  return enqueueAnalysis(fens, options);
}

type AnalyzeBatch = (
  fens: string[],
  options?: AnalyzeOptions,
) => Promise<PositionEval[]>;

const ADAPTIVE_DEPTH_INCREMENT = 5;
const CRITICAL_CP_LOSS = 50;

/** Indici delle posizioni prima/dopo le mosse critiche, ordinati e deduplicati. */
export function findCriticalPositionIndexes(evals: PositionEval[]): number[] {
  const indexes = new Set<number>();

  for (let moveIndex = 0; moveIndex < evals.length - 1; moveIndex++) {
    const beforeScore = evalScore(evals[moveIndex].scoreCp, evals[moveIndex].scoreMate);
    const afterScore = evalScore(evals[moveIndex + 1].scoreCp, evals[moveIndex + 1].scoreMate);
    const sideToMove = evals[moveIndex].fen.split(" ")[1];
    const moverIsWhite = sideToMove === "w" || (sideToMove !== "b" && moveIndex % 2 === 0);
    const cpLoss = moverIsWhite ? beforeScore - afterScore : afterScore - beforeScore;

    if (cpLoss >= CRITICAL_CP_LOSS) {
      indexes.add(moveIndex);
      indexes.add(moveIndex + 1);
    }
  }

  return [...indexes].sort((a, b) => a - b);
}

/** Orchestratore iniettabile per testare le due passate senza avviare Stockfish. */
export async function runAdaptiveAnalysis(
  fens: string[],
  settings: StockfishSettings,
  options: AnalyzeOptions = {},
  analyzeBatch: AnalyzeBatch = analyzePositions,
): Promise<PositionEval[]> {
  const depth = options.depth ?? settings.stockfish_depth;
  const threads = options.threads ?? settings.stockfish_threads;
  const shallow = await analyzeBatch(fens, {
    ...options,
    depth,
    threads,
    multipv: 1,
    onProgress: (done) => options.onProgress?.(done, fens.length),
  });

  if (options.signal?.cancelled || shallow.length !== fens.length) return shallow;

  const criticalIndexes = findCriticalPositionIndexes(shallow);
  if (criticalIndexes.length === 0) return shallow;

  const total = fens.length + criticalIndexes.length;
  options.onProgress?.(fens.length, total);
  const refined = await analyzeBatch(
    criticalIndexes.map((index) => fens[index]),
    {
      ...options,
      depth: Math.min(30, depth + ADAPTIVE_DEPTH_INCREMENT),
      threads,
      multipv: 1,
      onProgress: (done) => options.onProgress?.(fens.length + done, total),
    },
  );

  const merged = [...shallow];
  refined.forEach((evaluation, refinedIndex) => {
    const positionIndex = criticalIndexes[refinedIndex];
    if (positionIndex != null) merged[positionIndex] = evaluation;
  });
  return merged;
}

export async function analyzePositionsAdaptive(
  fens: string[],
  options: AnalyzeOptions = {},
): Promise<PositionEval[]> {
  const settings = await getStockfishSettings();
  return runAdaptiveAnalysis(fens, settings, options);
}

function enqueueAnalysis(
  fens: string[],
  options: AnalyzeOptions
): Promise<PositionEval[]> {
  return new Promise<PositionEval[]>((resolve, reject) => {
    analysisQueue.push({ fens, options, resolve, reject });
    void runAnalysisQueue();
  });
}

async function runAnalysisQueue(): Promise<void> {
  if (analysisQueueRunning) return;
  analysisQueueRunning = true;

  try {
    while (analysisQueue.length > 0) {
      const job = analysisQueue.shift();
      if (!job) continue;

      try {
        if (job.options.signal?.cancelled) {
          job.resolve([]);
          continue;
        }
        const result = await analyzePositionsNow(job.fens, job.options);
        job.resolve(result);
      } catch (error) {
        job.reject(error);
      }
    }
  } finally {
    analysisQueueRunning = false;
    if (analysisQueue.length > 0) void runAnalysisQueue();
  }
}

async function analyzePositionsNow(
  fens: string[],
  options: AnalyzeOptions
): Promise<PositionEval[]> {
  return analyzePositionsWasm(fens, options);
}

export interface StockfishSettings {
  stockfish_depth: number;
  stockfish_threads: number;
}

let stockfishSettingsPromise: Promise<StockfishSettings> | null = null;

export function resetStockfishSettingsCache(): void {
  stockfishSettingsPromise = null;
}

export async function getStockfishSettings(): Promise<StockfishSettings> {
  if (!stockfishSettingsPromise) {
    stockfishSettingsPromise = getAppSettings()
      .then(({ stockfish_depth, stockfish_threads }) => ({
        stockfish_depth,
        stockfish_threads,
      }))
      .catch(() => ({
        stockfish_depth: DEFAULT_APP_SETTINGS.stockfish_depth,
        stockfish_threads: DEFAULT_APP_SETTINGS.stockfish_threads,
      }));
  }
  return stockfishSettingsPromise;
}

async function analyzePositionsWasm(
  fens: string[],
  options: AnalyzeOptions
): Promise<PositionEval[]> {
  const settings = await getStockfishSettings();
  const depth = options.depth ?? settings.stockfish_depth;
  const threads = options.threads ?? settings.stockfish_threads;
  const multipv = options.multipv ?? 1;
  const runtime = getStockfishRuntimeInfo(threads);
  const engine = await prepareStockfishEngine(runtime);
  const results: PositionEval[] = [];
  for (let i = 0; i < fens.length; i++) {
    if (options.signal?.cancelled) break;
    const ev = await engine.analyze(fens[i], depth, multipv);
    results.push(ev);
    options.onProgress?.(i + 1, fens.length);
  }
  return results;
}

// --- Helpers di formatting / classificazione (POV Bianco) ---

/** Converte eval in un numero confrontabile dando peso sostanziale alla distanza dal matto. */
export function evalScore(evalCp: number | null, evalMate: number | null): number {
  if (evalMate != null) {
    const mateScore = Math.max(1000, 100000 - Math.abs(evalMate) * 1000);
    return evalMate > 0 ? mateScore : -mateScore;
  }
  if (evalCp != null) return evalCp;
  return 0;
}

/** Converte la valutazione nella percentuale visuale occupata dal Bianco. */
export function evalToWhiteShare(
  evalCp: number | null,
  evalMate: number | null,
): number {
  if (evalMate != null) return evalMate > 0 ? 100 : 0;
  if (evalCp == null) return 50;
  const boundedCp = Math.min(600, Math.max(-600, evalCp));
  return Math.min(100, Math.max(0, 50 + boundedCp / 12));
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

export interface MoveBadge {
  label: string;
  color: string;
}

/** Mappa simbolo → colore per i badge (usata da parsing commenti). */
export const BADGE_COLORS: Record<string, string> = {
  "!!": "rgb(59,130,246)",
  "!": "rgb(34,197,94)",
  "?!": "rgb(202,138,4)",
  "?": "rgb(234,88,12)",
  "??": "rgb(220,38,38)",
};

const BADGE_ALIASES: Record<string, string> = {
  "⭐": "!!",
  "✅": "!",
};

/**
 * Estrae un badge iniziale da un testo commento (es. "?? e4 — Errore grave!").
 * Ritorna { label, color, rest } se il testo inizia con un simbolo badge,
 * altrimenti null.
 */
export function parseBadgePrefix(
  text: string
): { label: string; color: string; rest: string } | null {
  // Ordine: prima simboli più lunghi ("??" prima di "?")
  const symbols = ["??", "?!", "!!", "⭐", "✅", "!", "?"];
  for (const s of symbols) {
    if (text.startsWith(s + " ")) {
      const label = BADGE_ALIASES[s] ?? s;
      return { label, color: BADGE_COLORS[label], rest: text.slice(s.length + 1) };
    }
  }
  return null;
}

/** Colore badge per una mossa in base al centipawn loss (POV del mosritore). */
export function moveClassification(
  cpLoss: number | null,
  isBestMove?: boolean
): MoveBadge | null {
  if (cpLoss == null) return null;

  if (isBestMove) {
    return { label: "!!", color: "rgb(59,130,246)" };
  }

  if (cpLoss < 50) return { label: "!", color: "rgb(34,197,94)" };
  if (cpLoss < 100) return { label: "?!", color: "rgb(202,138,4)" };
  if (cpLoss < 300) return { label: "?", color: "rgb(234,88,12)" };
  return { label: "??", color: "rgb(220,38,38)" };
}

/** Confronta due SAN ignorando solo i suffissi di scacco, matto e annotazione. */
export function sanMovesMatch(playedSan: string, candidateSan: string | null): boolean {
  if (!candidateSan) return false;
  const normalize = (san: string) => san.replace(/[+#?!]+$/, "");
  return normalize(playedSan) === normalize(candidateSan);
}

export function stockfishCommentForMove(args: {
  moveNotation: string;
  cpLoss: number;
  bestSan: string | null;
  isBestMove: boolean;
}): string {
  const cls = moveClassification(args.cpLoss, args.isBestMove);

  if (cls?.label === "!!") {
    return `Analisi: ${args.moveNotation} - mossa migliore. La mossa giocata coincide con la scelta principale.`;
  }

  const classification =
    cls?.label === "??" ? "errore grave" :
    cls?.label === "?" ? "errore" :
    cls?.label === "?!" ? "imprecisione" :
    args.cpLoss <= -50 ? "buona risorsa" :
    "mossa solida";
  const swing =
    args.cpLoss <= -50
      ? "la posizione migliora"
      : Math.abs(args.cpLoss) >= 250
      ? "la posizione peggiora molto"
      : Math.abs(args.cpLoss) >= 120
        ? "la posizione peggiora in modo importante"
        : Math.abs(args.cpLoss) >= 25
          ? "la posizione peggiora leggermente"
          : "posizione quasi invariata";
  const best =
    args.bestSan && !sanMovesMatch(args.moveNotation, args.bestSan)
      ? `La continuazione piu precisa era ${args.bestSan}.`
      : "La mossa resta pienamente giocabile.";

  return `Analisi: ${args.moveNotation} - ${classification}, ${swing}. ${best}`;
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
