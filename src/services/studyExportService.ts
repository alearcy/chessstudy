import { Chess, type Color, type PieceSymbol } from "chess.js";

import type { BoardArrow, BoardHighlight, Move } from "@/types";

interface StudyPgnInput {
  initialFen: string;
  lessonTitle: string;
  boardTitle: string;
  moves: Move[];
  headers?: Record<string, string | null>;
}

interface StudyBoardImageInput {
  fen: string;
  arrows: BoardArrow[];
  highlights: BoardHighlight[];
  orientation: "white" | "black";
  size?: number;
}

type CanvasFactory = () => HTMLCanvasElement;

const LIGHT_SQUARE = "#f0d9b5";
const DARK_SQUARE = "#b58863";
const DEFAULT_HIGHLIGHT = "rgb(250,204,21)";
const DEFAULT_ARROW = "rgb(239,68,68)";

const PIECES: Record<Color, Record<PieceSymbol, string>> = {
  w: {
    k: "♔",
    q: "♕",
    r: "♖",
    b: "♗",
    n: "♘",
    p: "♙",
  },
  b: {
    k: "♚",
    q: "♛",
    r: "♜",
    b: "♝",
    n: "♞",
    p: "♟",
  },
};

function cleanHeaderValue(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

export function buildStudyPgn({
  initialFen,
  lessonTitle,
  boardTitle,
  moves,
  headers = {},
}: StudyPgnInput): string {
  const game = new Chess(initialFen);

  for (const [key, value] of Object.entries(headers)) {
    const cleaned = cleanHeaderValue(value);
    if (!cleaned || key === "SetUp" || key === "FEN") continue;
    game.setHeader(key, cleaned);
  }
  game.setHeader("Event", lessonTitle.trim() || "Studio di scacchi");
  game.setHeader("Board", boardTitle.trim() || "Scacchiera");

  [...moves]
    .sort((left, right) => left.order - right.order)
    .forEach((move, index) => {
      try {
        game.move(move.moveNotation);
      } catch (error) {
        throw new Error(
          `Impossibile esportare la mossa ${index + 1} (${move.moveNotation}).`,
          { cause: error },
        );
      }
      const comment = move.comment.trim();
      if (comment) game.setComment(comment);
    });

  return game.pgn({ newline: "\n", maxWidth: 80 });
}

function filenamePart(value: string, fallback: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

export function studyExportFilename(
  lessonTitle: string,
  boardTitle: string,
  extension: "pgn" | "png",
): string {
  const lesson = filenamePart(lessonTitle, "studio");
  const board = filenamePart(boardTitle, "scacchiera");
  return `${lesson}-${board}.${extension}`;
}

function squarePosition(
  square: string,
  orientation: "white" | "black",
): { column: number; row: number } | null {
  if (!/^[a-h][1-8]$/.test(square)) return null;
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return orientation === "white"
    ? { column: file, row: 7 - rank }
    : { column: 7 - file, row: rank };
}

function annotationParts(
  highlight: BoardHighlight,
): [string, string | undefined] {
  return typeof highlight === "string"
    ? [highlight, undefined]
    : [highlight[0], highlight[1]];
}

function translucent(color: string): string {
  const rgb = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  return rgb
    ? `rgba(${rgb[1]},${rgb[2]},${rgb[3]},0.55)`
    : color;
}

function drawArrow(
  context: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string,
  squareSize: number,
) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const headLength = squareSize * 0.28;

  context.beginPath();
  context.moveTo(fromX, fromY);
  context.lineTo(toX, toY);
  context.strokeStyle = color;
  context.lineWidth = squareSize * 0.11;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.stroke();

  context.beginPath();
  context.moveTo(toX, toY);
  context.lineTo(
    toX - headLength * Math.cos(angle - Math.PI / 6),
    toY - headLength * Math.sin(angle - Math.PI / 6),
  );
  context.lineTo(
    toX - headLength * Math.cos(angle + Math.PI / 6),
    toY - headLength * Math.sin(angle + Math.PI / 6),
  );
  context.closePath();
  context.fillStyle = color;
  context.fill();
}

function drawStudyBoard(
  context: CanvasRenderingContext2D,
  input: Required<Pick<StudyBoardImageInput, "fen" | "arrows" | "highlights" | "orientation" | "size">>,
) {
  const squareSize = input.size / 8;
  context.fillStyle = LIGHT_SQUARE;
  context.fillRect(0, 0, input.size, input.size);

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      context.fillStyle = (row + column) % 2 === 0 ? LIGHT_SQUARE : DARK_SQUARE;
      context.fillRect(column * squareSize, row * squareSize, squareSize, squareSize);
    }
  }

  for (const highlight of input.highlights) {
    const [square, color] = annotationParts(highlight);
    const position = squarePosition(square, input.orientation);
    if (!position) continue;
    context.fillStyle = translucent(color ?? DEFAULT_HIGHLIGHT);
    context.fillRect(
      position.column * squareSize,
      position.row * squareSize,
      squareSize,
      squareSize,
    );
  }

  const game = new Chess(input.fen);
  context.font = `${squareSize * 0.78}px "Arial Unicode MS", "Noto Sans Symbols 2", serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (const rank of game.board()) {
    for (const piece of rank) {
      if (!piece) continue;
      const position = squarePosition(piece.square, input.orientation);
      if (!position) continue;
      const symbol = PIECES[piece.color][piece.type];
      const x = (position.column + 0.5) * squareSize;
      const y = (position.row + 0.5) * squareSize;
      context.fillStyle = piece.color === "w" ? "#f8fafc" : "#111827";
      context.strokeStyle = piece.color === "w" ? "#111827" : "#f8fafc";
      context.lineWidth = squareSize * 0.015;
      context.strokeText(symbol, x, y);
      context.fillText(symbol, x, y);
    }
  }

  for (const [from, to, color] of input.arrows) {
    const start = squarePosition(from, input.orientation);
    const end = squarePosition(to, input.orientation);
    if (!start || !end) continue;
    drawArrow(
      context,
      (start.column + 0.5) * squareSize,
      (start.row + 0.5) * squareSize,
      (end.column + 0.5) * squareSize,
      (end.row + 0.5) * squareSize,
      color ?? DEFAULT_ARROW,
      squareSize,
    );
  }
}

export async function createStudyBoardPng(
  input: StudyBoardImageInput,
  createCanvas: CanvasFactory = () => document.createElement("canvas"),
): Promise<Blob> {
  const size = input.size ?? 1200;
  const canvas = createCanvas();
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas non disponibile per l'esportazione.");

  drawStudyBoard(context, { ...input, size });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Impossibile generare l'immagine PNG."));
    }, "image/png");
  });
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function saveStudyExportFile(
  contents: Blob,
  filename: string,
): Promise<string | null> {
  if (isTauriRuntime()) {
    const [{ save }, { writeFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const extension = filename.split(".").pop() ?? "";
    const path = await save({
      defaultPath: filename,
      filters: [{ name: "Esportazione Chess Study", extensions: [extension] }],
    });
    if (!path) return null;
    await writeFile(path, new Uint8Array(await contents.arrayBuffer()));
    return path.split(/[\\/]/).pop() || path;
  }

  const url = URL.createObjectURL(contents);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
  return filename;
}

export function studyPgnBlob(pgn: string): Blob {
  return new Blob([pgn], { type: "application/x-chess-pgn;charset=utf-8" });
}
