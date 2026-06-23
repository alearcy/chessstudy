import { Chess, DEFAULT_POSITION } from "chess.js";
import db from "@/db/database";
import { createBoardWithFen } from "@/services/boardService";
import { createLesson } from "@/services/lessonService";
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
  /** Titolo derivato da White vs Black + risultato (con Elo). */
  title: string;
  /** Riepilogo metadati PGN per le note della scacchiera. */
  notes: string;
  /** Nome del giocatore Bianco (header [White], senza Elo); null se assente. */
  whiteName: string | null;
  /** Nome del giocatore Nero (header [Black], senza Elo); null se assente. */
  blackName: string | null;
}

const MAX_TITLE_LEN = 60;

/** Restituisce null per valori assenti (null, "?", vuoto). */
function clean(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  if (!t || t === "?") return null;
  return t;
}

/** Formatta "White (Elo)" con Elo opzionale. */
function playerWithElo(
  name: string | null,
  elo: string | null
): string | null {
  if (!name) return null;
  return elo ? `${name} (${elo})` : name;
}

/** Deriva un titolo leggibile dagli header PGN (senza Event). */
function deriveTitle(headers: Record<string, string | null>): string {
  const white = clean(headers.White);
  const black = clean(headers.Black);
  const result = clean(headers.Result);
  const whiteElo = clean(headers.WhiteElo);
  const blackElo = clean(headers.BlackElo);

  const w = playerWithElo(white, whiteElo);
  const b = playerWithElo(black, blackElo);
  const vs = w && b ? `${w} vs ${b}` : null;
  const withResult =
    vs && result && result !== "*" ? `${vs} ${result}` : vs;

  const raw = withResult ?? "Partita importata";
  return raw.length > MAX_TITLE_LEN
    ? raw.slice(0, MAX_TITLE_LEN - 1) + "…"
    : raw;
}

/** Costruisce le note della scacchiera con i metadati PGN rilevanti. */
function buildNotes(headers: Record<string, string | null>): string {
  const lines: string[] = [];
  const push = (label: string, value: string | null) => {
    if (value) lines.push(`${label}: ${value}`);
  };
  push("Sito", clean(headers.Site));
  push("Data", clean(headers.Date));
  push("Bianco", playerWithElo(clean(headers.White), clean(headers.WhiteElo)));
  push("Nero", playerWithElo(clean(headers.Black), clean(headers.BlackElo)));
  push("Risultato", clean(headers.Result));
  push("Terminazione", clean(headers.Termination));
  push("Link", clean(headers.Link));
  return lines.join("\n");
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
    notes: buildNotes(headers),
    whiteName: clean(headers.White),
    blackName: clean(headers.Black),
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
      notes: "",
      whiteName: parsed.whiteName,
      blackName: parsed.blackName,
      headers: parsed.headers,
    });
  }

  const boardId = await createBoardWithFen(lessonId, {
    title: parsed.title,
    fen: parsed.startFen,
    notes: "",
    whiteName: parsed.whiteName,
    blackName: parsed.blackName,
    headers: parsed.headers,
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

/**
 * Crea una nuova lezione in modalità "analysis" con una singola scacchiera
 * popolata dal PGN. Ogni import PGN dalla home page produce una lezione
 * autonoma (nessun riuso di un contenitore "analisi" cumulativo).
 * Il titolo è derivato dagli header PGN (White vs Black / fallback).
 * Ritorna `{ lessonId, boardId }`.
 */
export async function importPgnAsLesson(
  pgn: string
): Promise<{ lessonId: number; boardId: number }> {
  const parsed = parsePgn(pgn);
  const lessonId = await createLesson(
    { title: parsed.title, description: "" },
    "analysis"
  );
  const boardId = await importPgnToLesson(lessonId, pgn);
  return { lessonId, boardId };
}