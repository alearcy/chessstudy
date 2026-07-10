import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchChessComArchives,
  fetchChessComGames,
  parseChessComArchives,
  parseChessComGames,
} from "@/services/chessComService";

const SAMPLE_PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.07.09"]
[White "Opponent"]
[Black "AleArcy"]
[Result "1-0"]
[TimeControl "900+10"]
[ECOUrl "https://www.chess.com/openings/Philidor-Defense"]

1. e4 e5 2. Nf3 Nc6 1-0`;

function gamesPayload() {
  return JSON.stringify({
    games: [
      {
        url: "https://www.chess.com/game/live/123456",
        pgn: SAMPLE_PGN,
        time_control: "900+10",
        end_time: 1_783_603_200,
        uuid: "game-uuid",
        time_class: "rapid",
        rules: "chess",
        white: { rating: 1510, result: "win", username: "Opponent" },
        black: { rating: 1495, result: "resigned", username: "AleArcy" },
      },
      {
        url: "https://www.chess.com/game/live/variant",
        pgn: SAMPLE_PGN,
        time_control: "300",
        end_time: 1_783_603_200,
        uuid: "variant-uuid",
        time_class: "blitz",
        rules: "chess960",
        white: { rating: 1500, result: "win", username: "AleArcy" },
        black: { rating: 1500, result: "resigned", username: "Opponent" },
      },
    ],
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseChessComArchives", () => {
  it("validates and sorts monthly archives from newest to oldest", () => {
    const archives = parseChessComArchives(
      JSON.stringify({
        archives: [
          "https://api.chess.com/pub/player/alearcy/games/2025/06",
          "https://api.chess.com/pub/player/alearcy/games/2026/07",
        ],
      }),
      "AleArcy",
    );

    expect(archives).toEqual([
      {
        url: "https://api.chess.com/pub/player/alearcy/games/2026/07",
        year: 2026,
        month: 7,
        label: "luglio 2026",
      },
      {
        url: "https://api.chess.com/pub/player/alearcy/games/2025/06",
        year: 2025,
        month: 6,
        label: "giugno 2025",
      },
    ]);
  });

  it("rejects malformed or untrusted archive URLs", () => {
    expect(() => parseChessComArchives("not-json", "alearcy")).toThrow(
      "Risposta Chess.com non valida",
    );
    expect(() =>
      parseChessComArchives(
        JSON.stringify({ archives: ["https://example.com/steal"] }),
        "alearcy",
      ),
    ).toThrow("URL archivio Chess.com non valido");
  });
});

describe("parseChessComGames", () => {
  it("maps standard games and excludes unsupported variants", () => {
    const games = parseChessComGames(gamesPayload(), "alearcy");

    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      id: "game-uuid",
      pgn: SAMPLE_PGN,
      whiteName: "Opponent",
      blackName: "AleArcy",
      whiteRating: 1510,
      blackRating: 1495,
      result: "1-0",
      userColor: "black",
      speed: "rapid",
      timeControl: "15+10",
      opening: "Philidor Defense",
      url: "https://www.chess.com/game/live/123456",
    });
  });
});

describe("Chess.com requests", () => {
  it("loads the configured player's archive list", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ archives: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchChessComArchives(" Ale Arcy ")).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.chess.com/pub/player/Ale%20Arcy/games/archives",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });

  it("loads games only from a validated monthly archive URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ games: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const archiveUrl = "https://api.chess.com/pub/player/alearcy/games/2026/07";

    await expect(fetchChessComGames(archiveUrl, "alearcy")).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      archiveUrl,
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });

  it.each([
    [404, "Giocatore Chess.com non trovato"],
    [429, "Troppe richieste a Chess.com"],
    [500, "Chess.com non e disponibile"],
  ])("turns archive HTTP %i into a visible error", async (status, message) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status })),
    );

    await expect(fetchChessComArchives("alearcy")).rejects.toThrow(message);
  });
});
