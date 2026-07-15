import { describe, expect, it } from "vitest";

import {
  identifyOpeningReport,
  loadOpeningBook,
  parseOpeningTsv,
} from "@/services/openingBookService";

const TSV = `eco\tname\tpgn
B00\tKing's Pawn Opening\t1. e4
C20\tKing's Pawn Game\t1. e4 e5
C40\tKing's Knight Opening\t1. e4 e5 2. Nf3
C44\tOpen Game: Classical Development\t1. e4 e5 2. Nf3 Nc6
C50\tItalian Game\t1. e4 e5 2. Nf3 Nc6 3. Bc4
`;

describe("openingBookService", () => {
  it("loads the supplied ECO database as lazy TSV modules", async () => {
    const lines = await loadOpeningBook();

    expect(lines.length).toBeGreaterThan(3_000);
    expect(lines.some((line) => line.name.includes("Sicilian Defense"))).toBe(true);
  });

  it("parses TSV records into normalized move lines and opening families", () => {
    const lines = parseOpeningTsv(TSV);

    expect(lines).toHaveLength(5);
    expect(lines[3]).toMatchObject({
      eco: "C44",
      name: "Open Game: Classical Development",
      family: "Open Game",
      movesUci: ["e2e4", "e7e5", "g1f3", "b8c6"],
      movesSan: ["e4", "e5", "Nf3", "Nc6"],
    });
  });

  it("chooses the deepest fully played opening ending on each color", () => {
    const report = identifyOpeningReport(parseOpeningTsv(TSV), {
      gameMovesUci: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"],
      bestMovesUci: [null, null, null, null, null],
    });

    expect(report.whitePlayed?.name).toBe("King's Knight Opening");
    expect(report.blackPlayed?.name).toBe("Open Game: Classical Development");
  });

  it("uses the Stockfish book continuation at the first player deviation", () => {
    const report = identifyOpeningReport(parseOpeningTsv(TSV), {
      gameMovesUci: ["e2e4", "e7e5", "f1c4"],
      bestMovesUci: [null, null, "g1f3"],
    });

    expect(report.whitePlayed?.name).toBe("King's Pawn Opening");
    expect(report.blackPlayed?.name).toBe("King's Pawn Game");
    expect(report.whiteSuggested?.name).toBe("Italian Game");
    expect(report.blackSuggested?.name).toBe("King's Pawn Game");
  });

  it("falls back to the played opening when Stockfish has no book continuation", () => {
    const report = identifyOpeningReport(parseOpeningTsv(TSV), {
      gameMovesUci: ["e2e4", "e7e5", "f1c4"],
      bestMovesUci: [null, null, "d2d3"],
    });

    expect(report.whiteSuggested).toEqual(report.whitePlayed);
  });
});
