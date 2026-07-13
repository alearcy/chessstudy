import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import LessonsPage from "@/pages/LessonsPage";

const { getAllLessonsMock, getAppSettingsMock, setLessonFavoriteMock } = vi.hoisted(() => ({
  getAllLessonsMock: vi.fn(),
  getAppSettingsMock: vi.fn(),
  setLessonFavoriteMock: vi.fn(),
}));

vi.mock("@/services/lessonService", () => ({
  getAllLessons: getAllLessonsMock,
  createLesson: vi.fn(),
  updateLesson: vi.fn(),
  deleteLesson: vi.fn(),
  setLessonFavorite: setLessonFavoriteMock,
}));

vi.mock("@/services/settingsService", () => ({
  getAppSettings: getAppSettingsMock,
}));

vi.mock("@/components/board/ImportPgnDialog", () => ({ default: () => null }));
vi.mock("@/components/board/ImportLichessDialog", () => ({ default: () => null }));
vi.mock("@/components/board/ImportChessComDialog", () => ({
  default: ({ open, username }: { open: boolean; username: string }) =>
    open ? <div>Modale Chess.com per {username}</div> : null,
}));

afterEach(() => {
  cleanup();
  getAllLessonsMock.mockReset();
  getAppSettingsMock.mockReset();
  setLessonFavoriteMock.mockReset();
});

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

describe("LessonsPage platform imports", () => {
  it("opens Chess.com with the username currently saved in settings", async () => {
    getAllLessonsMock.mockResolvedValue([]);
    getAppSettingsMock.mockResolvedValue({
      stockfish_depth: 15,
      stockfish_threads: 1,
      lichess_username: "lichess-user",
      chesscom_username: "chess-user",
    });

    const view = render(
      <MemoryRouter>
        <LessonsPage />
      </MemoryRouter>,
    );

    fireEvent.click(view.getByRole("button", { name: /Chess\.com/i }));

    expect(await view.findByText("Modale Chess.com per chess-user")).toBeTruthy();
    expect(getAppSettingsMock).toHaveBeenCalledOnce();
  });

  it("offers settings when the Chess.com username is missing", async () => {
    getAllLessonsMock.mockResolvedValue([]);
    getAppSettingsMock.mockResolvedValue({
      stockfish_depth: 15,
      stockfish_threads: 1,
      lichess_username: "lichess-user",
      chesscom_username: "",
    });
    const onOpenSettings = vi.fn();

    const view = render(
      <MemoryRouter>
        <LessonsPage onOpenSettings={onOpenSettings} />
      </MemoryRouter>,
    );

    fireEvent.click(view.getByRole("button", { name: /Chess\.com/i }));
    await waitFor(() => {
      expect(view.getByText(/Configura lo username Chess\.com/i)).toBeTruthy();
    });
    fireEvent.click(view.getByRole("button", { name: "Apri impostazioni" }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });
});

describe("LessonsPage imported game favorites", () => {
  it("uses a heart only for imported games and toggles it without navigating", async () => {
    const importedGame = {
      id: 1,
      title: "Partita importata",
      description: "",
      mode: "analysis" as const,
      createdAt: new Date("2026-07-13"),
      isFavorite: false,
    };
    const studyLesson = {
      id: 2,
      title: "Lezione di studio",
      description: "",
      mode: "study" as const,
      createdAt: new Date("2026-07-12"),
    };
    getAllLessonsMock
      .mockResolvedValueOnce([importedGame, studyLesson])
      .mockResolvedValueOnce([{ ...importedGame, isFavorite: true }, studyLesson]);
    setLessonFavoriteMock.mockResolvedValue(undefined);

    const view = render(
      <MemoryRouter>
        <LessonsPage />
        <LocationProbe />
      </MemoryRouter>,
    );

    const addFavorite = await view.findByRole("button", {
      name: "Aggiungi ai preferiti: Partita importata",
    });
    expect(
      view.queryByRole("button", { name: /preferiti: Lezione di studio/ }),
    ).toBeNull();

    fireEvent.click(addFavorite);

    await waitFor(() => {
      expect(setLessonFavoriteMock).toHaveBeenCalledWith(1, true);
      expect(view.getByTestId("location").textContent).toBe("/");
      expect(
        view.getByRole("button", {
          name: "Rimuovi dai preferiti: Partita importata",
        }),
      ).toBeTruthy();
    });
  });

  it("filters the list to favorite imported games", async () => {
    getAllLessonsMock.mockResolvedValue([
      {
        id: 1,
        title: "Partita preferita",
        description: "",
        mode: "analysis",
        createdAt: new Date("2026-07-13"),
        isFavorite: true,
      },
      {
        id: 2,
        title: "Partita non preferita",
        description: "",
        mode: "analysis",
        createdAt: new Date("2026-07-12"),
        isFavorite: false,
      },
      {
        id: 3,
        title: "Lezione di studio",
        description: "",
        mode: "study",
        createdAt: new Date("2026-07-11"),
        isFavorite: true,
      },
    ]);

    const view = render(
      <MemoryRouter>
        <LessonsPage />
      </MemoryRouter>,
    );

    await view.findByText("Partita non preferita");
    fireEvent.click(view.getByRole("button", { name: "Solo preferite" }));

    expect(view.getByText("Partita preferita")).toBeTruthy();
    expect(view.queryByText("Partita non preferita")).toBeNull();
    expect(view.queryByText("Lezione di studio")).toBeNull();
  });

  it("shows a dedicated empty state when there are no favorite games", async () => {
    getAllLessonsMock.mockResolvedValue([
      {
        id: 1,
        title: "Partita non preferita",
        description: "",
        mode: "analysis",
        createdAt: new Date("2026-07-13"),
        isFavorite: false,
      },
    ]);

    const view = render(
      <MemoryRouter>
        <LessonsPage />
      </MemoryRouter>,
    );

    await view.findByText("Partita non preferita");
    fireEvent.click(view.getByRole("button", { name: "Solo preferite" }));

    expect(view.getByText("Nessuna partita preferita")).toBeTruthy();
  });
});
