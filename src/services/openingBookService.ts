import { Chess } from "chess.js";

import type { OpeningReference, OpeningReport } from "@/types";

export interface OpeningLine extends OpeningReference {
  movesSan: string[];
  movesUci: string[];
}

interface IdentifyOpeningOptions {
  gameMovesUci: string[];
  /** Miglior mossa UCI per ogni posizione prima della mossa allo stesso indice. */
  bestMovesUci: Array<string | null>;
}

const rawOpeningLoaders = [
  () => import("../../docs/aperture/a.tsv?raw").then((module) => module.default),
  () => import("../../docs/aperture/b.tsv?raw").then((module) => module.default),
  () => import("../../docs/aperture/c.tsv?raw").then((module) => module.default),
  () => import("../../docs/aperture/d.tsv?raw").then((module) => module.default),
  () => import("../../docs/aperture/e.tsv?raw").then((module) => module.default),
];

let openingBookPromise: Promise<OpeningLine[]> | null = null;

function moveToUci(move: { from: string; to: string; promotion?: string }): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function openingFamily(name: string): string {
  return name.split(":", 1)[0].trim();
}

function parseOpeningPgn(pgn: string): Pick<OpeningLine, "movesSan" | "movesUci"> {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const history = chess.history({ verbose: true });
  if (history.length === 0) throw new Error("Linea di apertura senza mosse");
  return {
    movesSan: history.map((move) => move.san),
    movesUci: history.map(moveToUci),
  };
}

export function parseOpeningTsv(raw: string): OpeningLine[] {
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/);
  const parsed: OpeningLine[] = [];

  for (const row of lines.slice(1)) {
    if (!row.trim()) continue;
    const [eco, name, ...pgnColumns] = row.split("\t");
    const pgn = pgnColumns.join("\t").trim();
    if (!eco?.trim() || !name?.trim() || !pgn) continue;

    try {
      parsed.push({
        eco: eco.trim(),
        name: name.trim(),
        family: openingFamily(name),
        pgn,
        ...parseOpeningPgn(pgn),
      });
    } catch {
      // Una singola riga malformata non rende inutilizzabile tutto il libro.
    }
  }

  return parsed;
}

function prefixMatches(
  openingMoves: string[],
  gameMoves: string[],
  length: number,
): boolean {
  if (openingMoves.length < length || gameMoves.length < length) return false;
  for (let index = 0; index < length; index += 1) {
    if (openingMoves[index] !== gameMoves[index]) return false;
  }
  return true;
}

function compareOpeningDepth(left: OpeningLine, right: OpeningLine): number {
  return (
    right.movesUci.length - left.movesUci.length ||
    left.eco.localeCompare(right.eco) ||
    left.name.localeCompare(right.name)
  );
}

function toReference(line: OpeningLine | undefined): OpeningReference | null {
  if (!line) return null;
  return {
    eco: line.eco,
    name: line.name,
    family: line.family,
    pgn: line.pgn,
  };
}

function playedOpening(
  exactLines: OpeningLine[],
  colorIndex: 0 | 1,
): OpeningLine | undefined {
  return (
    exactLines
      .filter((line) => (line.movesUci.length - 1) % 2 === colorIndex)
      .sort(compareOpeningDepth)[0] ?? exactLines.sort(compareOpeningDepth)[0]
  );
}

function suggestedOpening(
  book: OpeningLine[],
  options: IdentifyOpeningOptions,
  colorIndex: 0 | 1,
  fallback: OpeningLine | undefined,
): OpeningLine | undefined {
  for (
    let moveIndex = colorIndex;
    moveIndex < options.gameMovesUci.length;
    moveIndex += 2
  ) {
    const candidates = book.filter(
      (line) =>
        line.movesUci.length > moveIndex &&
        prefixMatches(line.movesUci, options.gameMovesUci, moveIndex),
    );
    if (candidates.length === 0) break;

    const playedMove = options.gameMovesUci[moveIndex];
    if (candidates.some((line) => line.movesUci[moveIndex] === playedMove)) {
      continue;
    }

    const stockfishMove = options.bestMovesUci[moveIndex];
    if (!stockfishMove) break;
    return (
      candidates
        .filter((line) => line.movesUci[moveIndex] === stockfishMove)
        .sort(compareOpeningDepth)[0] ?? fallback
    );
  }

  return fallback;
}

export function identifyOpeningReport(
  book: OpeningLine[],
  options: IdentifyOpeningOptions,
): OpeningReport {
  const exactLines = book.filter(
    (line) =>
      line.movesUci.length <= options.gameMovesUci.length &&
      prefixMatches(line.movesUci, options.gameMovesUci, line.movesUci.length),
  );
  const whitePlayed = playedOpening(exactLines, 0);
  const blackPlayed = playedOpening(exactLines, 1);

  return {
    whitePlayed: toReference(whitePlayed),
    blackPlayed: toReference(blackPlayed),
    whiteSuggested: toReference(
      suggestedOpening(book, options, 0, whitePlayed),
    ),
    blackSuggested: toReference(
      suggestedOpening(book, options, 1, blackPlayed),
    ),
  };
}

export function gameMovesToUci(startFen: string, movesSan: string[]): string[] {
  const chess = new Chess(startFen);
  return movesSan.map((san) => {
    const move = chess.move(san);
    if (!move) throw new Error(`Mossa non valida nella partita: ${san}`);
    return moveToUci(move);
  });
}

export async function loadOpeningBook(): Promise<OpeningLine[]> {
  openingBookPromise ??= Promise.all(rawOpeningLoaders.map((load) => load()))
    .then((sources) => sources.flatMap(parseOpeningTsv))
    .catch((error) => {
      openingBookPromise = null;
      throw error;
    });
  return openingBookPromise;
}

export async function analyzeGameOpenings(args: {
  startFen: string;
  movesSan: string[];
  bestMovesUci: Array<string | null>;
}): Promise<OpeningReport> {
  const [book, gameMovesUci] = await Promise.all([
    loadOpeningBook(),
    Promise.resolve(gameMovesToUci(args.startFen, args.movesSan)),
  ]);
  return identifyOpeningReport(book, {
    gameMovesUci,
    bestMovesUci: args.bestMovesUci,
  });
}
