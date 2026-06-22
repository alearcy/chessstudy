import { Chess, DEFAULT_POSITION } from "chess.js";
import db from "@/db/database";
import { createBoardWithFen } from "@/services/boardService";
import type { Move } from "@/types";

export interface ParsedPgnMove {
  san: string;
  /** Posizione dopo la mossa (→ Move.fen). */
  fenAfter: string;
  /** Commento mainline {…} associato ("" se assente). */
  comment: string;
}

export interface ParsedPgn {
  /** startpos di default, o header [SetUp]/[FEN] se presente. */
  startFen: string;
  headers: Record<string, string | null>;
  moves: ParsedPgnMove[];
  /** Titolo derivato da Event / White vs Black / fallback. */
  title: string;
}

const MAX_TITLE_LEN = 60;

/** Deriva un titolo leggibile dagli header PGN. */
function deriveTitle(headers: Record<string, string | null>): string {
  const event = headers.Event;
  const white = headers.White;
  const black = headers.Black;
  const result = headers.Result;

  const vs = white && black ? `${white} vs ${black}` : null;
  const withResult = vs && result && result !== "*" ? `${vs} ${result}` : vs;

  const raw =
    event && event !== "?" && event.trim()
      ? event
      : withResult ?? "Partita importata";
  return raw.length > MAX_TITLE_LEN
    ? raw.slice(0, MAX_TITLE_LEN - 1) + "…"
    : raw;
}

/**
 * Parsa un PGN (mainline only — le varianti `( )` sono scartate da chess.js v1).
 * Lancia Error se il PGN è invalido.
 */
export function parsePgn(pgn: string): ParsedPgn {
  const game = new Chess();
  game.loadPgn(pgn); // lancia su PGN invalido

  const headers = game.header();
  const setUp = headers.SetUp;
  const fenHeader = headers.FEN;
  const startFen =
    setUp === "1" && fenHeader ? fenHeader : DEFAULT_POSITION;

  const verbose = game.history({ verbose: true });
  const comments = game.getComments(); // [{ fen, comment }]
  const commentByFen = new Map<string, string>();
  for (const c of comments) {
    if (!commentByFen.has(c.fen)) commentByFen.set(c.fen, c.comment);
  }

  const moves: ParsedPgnMove[] = verbose.map((m) => ({
    san: m.san,
    fenAfter: m.after,
    comment: commentByFen.get(m.after) ?? "",
  }));

  return {
    startFen,
    headers,
    moves,
    title: deriveTitle(headers),
  };
}

/**
 * Crea una nuova Board nella lezione + tutte le mosse (bulkAdd) a partire da
 * un PGN. Ritorna il boardId creato.
 *
 * Il `parentId` di ogni mossa è calcolato dagli id restituiti da `bulkAdd`,
 * quindi è sempre corretto (risolve il race "parentId con mosse veloci"
 * di TD-001 per il path di import).
 */
export async function importPgnToLesson(
  lessonId: number,
  pgn: string
): Promise<number> {
  const parsed = parsePgn(pgn);
  if (parsed.moves.length === 0) {
    // PGN valido ma senza mosse: crea comunque la board con la posizione di partenza.
    return createBoardWithFen(lessonId, {
      title: parsed.title,
      fen: parsed.startFen,
    });
  }

  const boardId = await createBoardWithFen(lessonId, {
    title: parsed.title,
    fen: parsed.startFen,
  });

  // Costruisce i record Move con parentId placeholder (aggiornato dopo bulkAdd).
  const now = new Date();
  const records: Omit<Move, "id">[] = parsed.moves.map((m, i) => ({
    boardId,
    parentId: null,
    order: i,
    moveNotation: m.san,
    fen: m.fenAfter,
    comment: m.comment,
    arrows: [],
    highlights: [],
    createdAt: now,
  }));

  const ids = (await db.moves.bulkAdd(records, { allKeys: true })) as number[];

  // Aggiorna parentId con l'id reale della mossa precedente.
  for (let i = 1; i < ids.length; i++) {
    await db.moves.update(ids[i], { parentId: ids[i - 1] });
  }

  return boardId;
}
