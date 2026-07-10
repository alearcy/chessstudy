import { parsePgn } from "@/services/pgnService";
import type { PlatformGameSummary, PlatformPlayerColor } from "@/types/platformGame";

export type PlayerColor = PlatformPlayerColor;
export type LichessGameSummary = PlatformGameSummary;

interface LichessPlayerJson {
  user?: { id?: string; name?: string };
  name?: string;
  rating?: number;
}

interface LichessGameJson {
  id?: string;
  speed?: string;
  createdAt?: number;
  players?: {
    white?: LichessPlayerJson;
    black?: LichessPlayerJson;
  };
  clock?: {
    initial?: number;
    increment?: number;
  };
  opening?: {
    name?: string;
  };
  pgn?: string;
}

const LICHESS_GAMES_URL = "https://lichess.org/api/games/user";

function playerName(player: LichessPlayerJson | undefined): string {
  return player?.user?.name ?? player?.name ?? "Anonimo";
}

function playerRating(player: LichessPlayerJson | undefined): number | null {
  return typeof player?.rating === "number" ? player.rating : null;
}

function isConfiguredPlayer(
  player: LichessPlayerJson | undefined,
  username: string,
): boolean {
  const normalized = username.trim().toLocaleLowerCase();
  return [player?.user?.id, player?.user?.name, player?.name].some(
    (candidate) => candidate?.toLocaleLowerCase() === normalized,
  );
}

function formatTimeControl(game: LichessGameJson): string | null {
  const initial = game.clock?.initial;
  const increment = game.clock?.increment;
  if (typeof initial !== "number" || typeof increment !== "number") return null;
  const base = initial % 60 === 0 ? String(initial / 60) : `${initial}s`;
  return `${base}+${increment}`;
}

function parseGameLine(line: string, username: string): LichessGameSummary {
  let game: LichessGameJson;
  try {
    game = JSON.parse(line) as LichessGameJson;
  } catch {
    throw new Error("Risposta Lichess non valida.");
  }

  if (typeof game.id !== "string" || !game.id) {
    throw new Error("Risposta Lichess non valida: identificativo mancante.");
  }
  if (typeof game.pgn !== "string" || !game.pgn.trim()) {
    throw new Error("Risposta Lichess non valida: PGN mancante.");
  }

  let parsedPgn;
  try {
    parsedPgn = parsePgn(game.pgn);
  } catch {
    throw new Error("Risposta Lichess non valida: PGN non valido.");
  }

  const white = game.players?.white;
  const black = game.players?.black;
  const userColor: PlayerColor = isConfiguredPlayer(white, username)
    ? "white"
    : isConfiguredPlayer(black, username)
      ? "black"
      : null;

  return {
    id: game.id,
    pgn: game.pgn,
    whiteName: playerName(white),
    blackName: playerName(black),
    whiteRating: playerRating(white),
    blackRating: playerRating(black),
    result: parsedPgn.headers.Result ?? "*",
    userColor,
    speed: game.speed ?? "unknown",
    timeControl: formatTimeControl(game),
    opening: game.opening?.name ?? null,
    createdAt: new Date(game.createdAt ?? 0),
    url: `https://lichess.org/${game.id}`,
  };
}

export function parseLichessGames(
  ndjson: string,
  username: string,
): LichessGameSummary[] {
  return ndjson
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseGameLine(line, username));
}

export async function fetchLichessGames(
  username: string,
): Promise<LichessGameSummary[]> {
  const normalizedUsername = username.trim();
  if (!normalizedUsername) {
    throw new Error("Configura lo username Lichess nelle impostazioni.");
  }

  const url = new URL(`${LICHESS_GAMES_URL}/${encodeURIComponent(normalizedUsername)}`);
  url.search = new URLSearchParams({
    max: "30",
    moves: "true",
    tags: "true",
    pgnInJson: "true",
    opening: "true",
    sort: "dateDesc",
  }).toString();

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { Accept: "application/x-ndjson" },
    });
  } catch {
    throw new Error("Impossibile contattare Lichess. Controlla la connessione.");
  }

  if (response.status === 404) {
    throw new Error("Giocatore Lichess non trovato.");
  }
  if (response.status === 429) {
    throw new Error("Troppe richieste a Lichess. Riprova tra poco.");
  }
  if (!response.ok) {
    throw new Error("Lichess non e disponibile. Riprova piu tardi.");
  }

  return parseLichessGames(await response.text(), normalizedUsername);
}
