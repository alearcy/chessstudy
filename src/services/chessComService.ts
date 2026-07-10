import { parsePgn } from "@/services/pgnService";
import type { PlatformGameSummary, PlatformPlayerColor } from "@/types/platformGame";

export interface ChessComArchive {
  url: string;
  year: number;
  month: number;
  label: string;
}

export type ChessComGameSummary = PlatformGameSummary;

interface ChessComPlayerJson {
  rating?: number;
  username?: string;
}

interface ChessComGameJson {
  url?: string;
  pgn?: string;
  time_control?: string;
  end_time?: number;
  uuid?: string;
  time_class?: string;
  rules?: string;
  white?: ChessComPlayerJson;
  black?: ChessComPlayerJson;
}

const CHESS_COM_BASE_URL = "https://api.chess.com/pub/player";

function parseArchiveUrl(urlValue: unknown, username: string): ChessComArchive {
  if (typeof urlValue !== "string") {
    throw new Error("URL archivio Chess.com non valido.");
  }

  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    throw new Error("URL archivio Chess.com non valido.");
  }

  const match = url.pathname.match(
    /^\/pub\/player\/([^/]+)\/games\/(\d{4})\/(0[1-9]|1[0-2])$/,
  );
  const archiveUsername = match ? decodeURIComponent(match[1]) : "";
  if (
    url.protocol !== "https:" ||
    url.hostname !== "api.chess.com" ||
    !match ||
    archiveUsername.toLocaleLowerCase() !== username.trim().toLocaleLowerCase()
  ) {
    throw new Error("URL archivio Chess.com non valido.");
  }

  const year = Number(match[2]);
  const month = Number(match[3]);
  return {
    url: url.toString(),
    year,
    month,
    label: new Date(year, month - 1, 1).toLocaleDateString("it-IT", {
      month: "long",
      year: "numeric",
    }),
  };
}

export function parseChessComArchives(
  payload: string,
  username: string,
): ChessComArchive[] {
  let parsed: { archives?: unknown[] };
  try {
    parsed = JSON.parse(payload) as { archives?: unknown[] };
  } catch {
    throw new Error("Risposta Chess.com non valida.");
  }
  if (!Array.isArray(parsed.archives)) {
    throw new Error("Risposta Chess.com non valida: archivi mancanti.");
  }

  return parsed.archives
    .map((archiveUrl) => parseArchiveUrl(archiveUrl, username))
    .sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month));
}

function parseOpening(ecoUrl: string | null): string | null {
  if (!ecoUrl) return null;
  try {
    const slug = new URL(ecoUrl).pathname.split("/").filter(Boolean).at(-1);
    return slug ? decodeURIComponent(slug).replaceAll("-", " ") : null;
  } catch {
    return null;
  }
}

function formatTimeControl(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d+)(?:\+(\d+))?$/);
  if (!match) return value;
  const seconds = Number(match[1]);
  const base = seconds % 60 === 0 ? String(seconds / 60) : `${seconds}s`;
  return match[2] ? `${base}+${match[2]}` : `${base} min`;
}

function playerColor(
  game: ChessComGameJson,
  username: string,
): PlatformPlayerColor {
  const normalized = username.trim().toLocaleLowerCase();
  if (game.white?.username?.toLocaleLowerCase() === normalized) return "white";
  if (game.black?.username?.toLocaleLowerCase() === normalized) return "black";
  return null;
}

function mapGame(game: ChessComGameJson, username: string): ChessComGameSummary {
  if (!game.pgn?.trim()) {
    throw new Error("Risposta Chess.com non valida: PGN mancante.");
  }

  let parsedPgn;
  try {
    parsedPgn = parsePgn(game.pgn);
  } catch {
    throw new Error("Risposta Chess.com non valida: PGN non valido.");
  }

  const url = game.url ?? parsedPgn.headers.Link;
  const id = game.uuid ?? url?.split("/").filter(Boolean).at(-1);
  if (!url || !id) {
    throw new Error("Risposta Chess.com non valida: identificativo mancante.");
  }

  return {
    id,
    pgn: game.pgn,
    whiteName: game.white?.username ?? parsedPgn.whiteName ?? "Anonimo",
    blackName: game.black?.username ?? parsedPgn.blackName ?? "Anonimo",
    whiteRating: typeof game.white?.rating === "number" ? game.white.rating : null,
    blackRating: typeof game.black?.rating === "number" ? game.black.rating : null,
    result: parsedPgn.headers.Result ?? "*",
    userColor: playerColor(game, username),
    speed: game.time_class ?? "unknown",
    timeControl: formatTimeControl(game.time_control),
    opening: parseOpening(parsedPgn.headers.ECOUrl ?? null),
    createdAt: new Date((game.end_time ?? 0) * 1_000),
    url,
  };
}

export function parseChessComGames(
  payload: string,
  username: string,
): ChessComGameSummary[] {
  let parsed: { games?: ChessComGameJson[] };
  try {
    parsed = JSON.parse(payload) as { games?: ChessComGameJson[] };
  } catch {
    throw new Error("Risposta Chess.com non valida.");
  }
  if (!Array.isArray(parsed.games)) {
    throw new Error("Risposta Chess.com non valida: partite mancanti.");
  }

  return parsed.games
    .filter((game) => game.rules === "chess")
    .map((game) => mapGame(game, username))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

async function requestChessCom(url: string, notFoundMessage: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new Error("Impossibile contattare Chess.com. Controlla la connessione.");
  }

  if (response.status === 404) throw new Error(notFoundMessage);
  if (response.status === 429) {
    throw new Error("Troppe richieste a Chess.com. Riprova tra poco.");
  }
  if (!response.ok) {
    throw new Error("Chess.com non e disponibile. Riprova piu tardi.");
  }
  return response.text();
}

export async function fetchChessComArchives(
  username: string,
): Promise<ChessComArchive[]> {
  const normalizedUsername = username.trim();
  if (!normalizedUsername) {
    throw new Error("Configura lo username Chess.com nelle impostazioni.");
  }
  const url = `${CHESS_COM_BASE_URL}/${encodeURIComponent(normalizedUsername)}/games/archives`;
  const payload = await requestChessCom(url, "Giocatore Chess.com non trovato.");
  return parseChessComArchives(payload, normalizedUsername);
}

export async function fetchChessComGames(
  archiveUrl: string,
  username: string,
): Promise<ChessComGameSummary[]> {
  const archive = parseArchiveUrl(archiveUrl, username);
  const payload = await requestChessCom(
    archive.url,
    "Archivio Chess.com non trovato.",
  );
  return parseChessComGames(payload, username);
}
