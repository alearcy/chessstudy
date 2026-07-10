import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ImportLichessDialog from "@/components/board/ImportLichessDialog";

const { fetchLichessGamesMock, importPgnAsLessonMock } = vi.hoisted(() => ({
  fetchLichessGamesMock: vi.fn(),
  importPgnAsLessonMock: vi.fn(),
}));

vi.mock("@/services/lichessService", () => ({
  fetchLichessGames: fetchLichessGamesMock,
}));

vi.mock("@/services/pgnService", () => ({
  importPgnAsLesson: importPgnAsLessonMock,
}));

const game = {
  id: "abc123",
  pgn: "[White \"Arcy\"]\n[Black \"Opponent\"]\n\n1. e4 e5",
  whiteName: "Arcy",
  blackName: "Opponent",
  whiteRating: 1500,
  blackRating: 1490,
  result: "1-0",
  userColor: "white" as const,
  speed: "rapid",
  timeControl: "10+5",
  opening: "King's Pawn Game",
  createdAt: new Date("2026-07-10T12:00:00Z"),
  url: "https://lichess.org/abc123",
};

afterEach(() => {
  cleanup();
  fetchLichessGamesMock.mockReset();
  importPgnAsLessonMock.mockReset();
});

describe("ImportLichessDialog", () => {
  it("loads the configured player's games and imports the selected PGN", async () => {
    fetchLichessGamesMock.mockResolvedValue([game]);
    importPgnAsLessonMock.mockResolvedValue({ lessonId: 42, boardId: 9 });
    const onOpenChange = vi.fn();
    const onImportedLesson = vi.fn();

    const view = render(
      <ImportLichessDialog
        open
        username="arcy"
        onOpenChange={onOpenChange}
        onImportedLesson={onImportedLesson}
      />,
    );

    await waitFor(() => expect(fetchLichessGamesMock).toHaveBeenCalledWith("arcy"));
    expect(view.getByText("Arcy")).toBeTruthy();
    expect(view.getByText("Opponent")).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: "Importa Arcy contro Opponent" }));

    await waitFor(() => expect(importPgnAsLessonMock).toHaveBeenCalledWith(game.pgn));
    expect(onImportedLesson).toHaveBeenCalledWith(42, 9);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows fetch failures and lets the user retry", async () => {
    fetchLichessGamesMock
      .mockRejectedValueOnce(new Error("Giocatore Lichess non trovato."))
      .mockResolvedValueOnce([]);

    const view = render(
      <ImportLichessDialog
        open
        username="missing"
        onOpenChange={vi.fn()}
        onImportedLesson={vi.fn()}
      />,
    );

    expect(await view.findByText("Giocatore Lichess non trovato.")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Riprova" }));

    await waitFor(() => expect(fetchLichessGamesMock).toHaveBeenCalledTimes(2));
    expect(await view.findByText("Nessuna partita trovata.")).toBeTruthy();
  });
});
