import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchLichessGames,
  parseLichessGames,
} from "@/services/lichessService";

const SAMPLE_PGN = `[Event "Rated Rapid game"]
[Site "https://lichess.org/abc123"]
[Date "2026.07.10"]
[White "Arcy"]
[Black "Opponent"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 1-0`;

function gameLine(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    id: "abc123",
    rated: true,
    variant: "standard",
    speed: "rapid",
    perf: "rapid",
    createdAt: 1_783_641_600_000,
    lastMoveAt: 1_783_641_900_000,
    status: "mate",
    winner: "white",
    players: {
      white: { user: { id: "arcy", name: "Arcy" }, rating: 1500 },
      black: { user: { id: "opponent", name: "Opponent" }, rating: 1490 },
    },
    clock: { initial: 600, increment: 5, totalTime: 800 },
    opening: { eco: "C20", name: "King's Pawn Game", ply: 2 },
    pgn: SAMPLE_PGN,
    ...overrides,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseLichessGames", () => {
  it("maps NDJSON games and identifies the configured player's color", () => {
    const games = parseLichessGames(`\n${gameLine()}\n`, "ARCY");

    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      id: "abc123",
      pgn: SAMPLE_PGN,
      whiteName: "Arcy",
      blackName: "Opponent",
      whiteRating: 1500,
      blackRating: 1490,
      result: "1-0",
      userColor: "white",
      speed: "rapid",
      timeControl: "10+5",
      opening: "King's Pawn Game",
      url: "https://lichess.org/abc123",
    });
  });

  it("rejects malformed lines and games without a PGN", () => {
    expect(() => parseLichessGames("not-json", "arcy")).toThrow(
      "Risposta Lichess non valida",
    );
    expect(() =>
      parseLichessGames(gameLine({ pgn: undefined }), "arcy"),
    ).toThrow("PGN mancante");
  });
});

describe("fetchLichessGames", () => {
  it("requests the 30 latest games as NDJSON with their PGN", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(gameLine(), {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchLichessGames(" Arcy ")).resolves.toHaveLength(1);

    const [requestUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const url = new URL(requestUrl);
    expect(url.pathname).toBe("/api/games/user/Arcy");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      max: "30",
      moves: "true",
      tags: "true",
      pgnInJson: "true",
      opening: "true",
      sort: "dateDesc",
    });
    expect(init.headers).toMatchObject({ Accept: "application/x-ndjson" });
  });

  it.each([
    [404, "Giocatore Lichess non trovato"],
    [429, "Troppe richieste a Lichess"],
    [500, "Lichess non e disponibile"],
  ])("turns HTTP %i into a visible error", async (status, message) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status })),
    );

    await expect(fetchLichessGames("arcy")).rejects.toThrow(message);
  });
});
