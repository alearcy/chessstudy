import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ImportChessComDialog from "@/components/board/ImportChessComDialog";

const {
  fetchChessComArchivesMock,
  fetchChessComGamesMock,
  importPgnAsLessonMock,
} = vi.hoisted(() => ({
  fetchChessComArchivesMock: vi.fn(),
  fetchChessComGamesMock: vi.fn(),
  importPgnAsLessonMock: vi.fn(),
}));

vi.mock("@/services/chessComService", () => ({
  fetchChessComArchives: fetchChessComArchivesMock,
  fetchChessComGames: fetchChessComGamesMock,
}));

vi.mock("@/services/pgnService", () => ({
  importPgnAsLesson: importPgnAsLessonMock,
}));

const latestArchive = {
  url: "https://api.chess.com/pub/player/alearcy/games/2026/07",
  year: 2026,
  month: 7,
  label: "luglio 2026",
};
const olderArchive = {
  url: "https://api.chess.com/pub/player/alearcy/games/2026/06",
  year: 2026,
  month: 6,
  label: "giugno 2026",
};
const game = {
  id: "game-uuid",
  pgn: "[White \"Opponent\"]\n[Black \"AleArcy\"]\n\n1. e4 e5",
  whiteName: "Opponent",
  blackName: "AleArcy",
  whiteRating: 1510,
  blackRating: 1495,
  result: "1-0",
  userColor: "black" as const,
  speed: "rapid",
  timeControl: "15+10",
  opening: "Philidor Defense",
  createdAt: new Date("2026-07-09T12:00:00Z"),
  url: "https://www.chess.com/game/live/123456",
};

afterEach(() => {
  cleanup();
  fetchChessComArchivesMock.mockReset();
  fetchChessComGamesMock.mockReset();
  importPgnAsLessonMock.mockReset();
});

describe("ImportChessComDialog", () => {
  it("opens the latest archive, changes month and imports a selected game", async () => {
    fetchChessComArchivesMock.mockResolvedValue([latestArchive, olderArchive]);
    fetchChessComGamesMock.mockResolvedValue([game]);
    importPgnAsLessonMock.mockResolvedValue({ lessonId: 51, boardId: 12 });
    const onOpenChange = vi.fn();
    const onImportedLesson = vi.fn();

    const view = render(
      <ImportChessComDialog
        open
        username="alearcy"
        onOpenChange={onOpenChange}
        onImportedLesson={onImportedLesson}
      />,
    );

    await waitFor(() => {
      expect(fetchChessComGamesMock).toHaveBeenCalledWith(
        latestArchive.url,
        "alearcy",
      );
    });

    fireEvent.change(view.getByLabelText("Mese"), {
      target: { value: olderArchive.url },
    });
    await waitFor(() => {
      expect(fetchChessComGamesMock).toHaveBeenCalledWith(
        olderArchive.url,
        "alearcy",
      );
    });

    fireEvent.click(
      view.getByRole("button", { name: "Importa Opponent contro AleArcy" }),
    );
    await waitFor(() => expect(importPgnAsLessonMock).toHaveBeenCalledWith(game.pgn));
    expect(onImportedLesson).toHaveBeenCalledWith(51, 12);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
