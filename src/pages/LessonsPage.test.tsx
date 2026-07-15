import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import LessonsPage from "@/pages/LessonsPage";

const {
  getLessonsPageMock,
  ensureDefaultProfileMock,
  getAppSettingsMock,
  setLessonFavoriteMock,
} = vi.hoisted(() => ({
  getLessonsPageMock: vi.fn(),
  ensureDefaultProfileMock: vi.fn(() => Promise.resolve({ id: 1 })),
  getAppSettingsMock: vi.fn(),
  setLessonFavoriteMock: vi.fn(),
}));

vi.mock("@/services/lessonService", () => ({
  getLessonsPage: getLessonsPageMock,
  createLesson: vi.fn(),
  updateLesson: vi.fn(),
  deleteLesson: vi.fn(),
  setLessonFavorite: setLessonFavoriteMock,
}));

vi.mock("@/services/profileService", () => ({
  ensureDefaultProfile: ensureDefaultProfileMock,
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
  getLessonsPageMock.mockReset();
  ensureDefaultProfileMock.mockClear();
  getAppSettingsMock.mockReset();
  setLessonFavoriteMock.mockReset();
});

function pageResult(items: unknown[]) {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 20,
    pageCount: items.length === 0 ? 0 : 1,
  };
}

describe("LessonsPage database queries", () => {
  it("renders compact two-row cards without the page title", async () => {
    getLessonsPageMock.mockResolvedValue(pageResult([{
      id: 1,
      title: "Partita importata",
      description: "Descrizione non mostrata nella lista",
      mode: "analysis",
      createdAt: new Date(2026, 6, 13),
      sourceLabel: "Lichess",
    }]));

    const view = render(
      <MemoryRouter>
        <LessonsPage />
      </MemoryRouter>,
    );

    const title = await view.findByText("Partita importata");
    expect(view.queryByRole("heading", { name: "Lezioni" })).toBeNull();
    expect(view.queryByText("Descrizione non mostrata nella lista")).toBeNull();

    const card = title.closest('[data-slot="card"]');
    const header = title.closest('[data-slot="card-header"]');
    const content = card?.querySelector('[data-slot="card-content"]');
    expect(card?.className).toContain("gap-0");
    expect(card?.className).toContain("py-3");
    expect(header).toBeTruthy();
    expect(content).toBeTruthy();
    expect(within(header as HTMLElement).getByTitle("Modifica")).toBeTruthy();
    expect(within(header as HTMLElement).getByTitle("Elimina")).toBeTruthy();
    expect(within(content as HTMLElement).getByText("13 luglio 2026")).toBeTruthy();
    expect(within(content as HTMLElement).getByText("Lichess")).toBeTruthy();
  });

  it("reloads the restored profile after the global backup event", async () => {
    getLessonsPageMock.mockResolvedValue(pageResult([]));
    render(
      <MemoryRouter>
        <LessonsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getLessonsPageMock).toHaveBeenCalledOnce());
    window.dispatchEvent(new Event("chessstudy:database-backup-restored"));
    await waitFor(() => {
      expect(ensureDefaultProfileMock).toHaveBeenCalledTimes(2);
      expect(getLessonsPageMock.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it("queries the repository for search and navigates paginated results", async () => {
    getLessonsPageMock
      .mockResolvedValueOnce({
        items: [{
          id: 1,
          title: "Prima pagina",
          description: "",
          mode: "study",
          createdAt: new Date("2026-07-15"),
        }],
        total: 21,
        page: 1,
        pageSize: 20,
        pageCount: 2,
      })
      .mockResolvedValueOnce({
        items: [{
          id: 21,
          title: "Seconda pagina",
          description: "",
          mode: "study",
          createdAt: new Date("2026-07-01"),
        }],
        total: 21,
        page: 2,
        pageSize: 20,
        pageCount: 2,
      })
      .mockResolvedValueOnce({
        items: [],
        total: 1,
        page: 1,
        pageSize: 20,
        pageCount: 1,
      });

    const view = render(
      <MemoryRouter>
        <LessonsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getLessonsPageMock).toHaveBeenCalledWith(expect.objectContaining({
        profileId: 1,
        page: 1,
        pageSize: 20,
      }));
    });

    await view.findByText("Pagina 1 di 2");
    fireEvent.click(view.getByRole("button", { name: "Successiva" }));
    await waitFor(() => {
      expect(getLessonsPageMock).toHaveBeenLastCalledWith(expect.objectContaining({
        page: 2,
      }));
    });

    fireEvent.change(view.getByPlaceholderText("Cerca titolo, giocatore, evento o ECO"), {
      target: { value: "Kasparov" },
    });

    await waitFor(() => {
      expect(getLessonsPageMock).toHaveBeenLastCalledWith(expect.objectContaining({
        query: "Kasparov",
        page: 1,
      }));
    });
  });
});

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

describe("LessonsPage platform imports", () => {
  it("opens Chess.com with the username currently saved in settings", async () => {
    getLessonsPageMock.mockResolvedValue(pageResult([]));
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
    getLessonsPageMock.mockResolvedValue(pageResult([]));
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
    getLessonsPageMock
      .mockResolvedValueOnce(pageResult([importedGame, studyLesson]))
      .mockResolvedValueOnce(pageResult([{ ...importedGame, isFavorite: true }, studyLesson]));
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
    const allLessons = [
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
    ];
    getLessonsPageMock
      .mockResolvedValueOnce(pageResult(allLessons))
      .mockResolvedValueOnce(pageResult([allLessons[0]]))
      .mockResolvedValueOnce(pageResult(allLessons));

    const view = render(
      <MemoryRouter>
        <LessonsPage />
      </MemoryRouter>,
    );

    await view.findByText("Partita non preferita");
    fireEvent.click(view.getByRole("button", { name: "Preferite" }));

    await waitFor(() => {
      expect(view.getByText("Partita preferita")).toBeTruthy();
      expect(view.queryByText("Partita non preferita")).toBeNull();
      expect(view.queryByText("Lezione di studio")).toBeNull();
    });

    fireEvent.click(view.getByRole("button", { name: "Preferite" }));

    await waitFor(() => {
      expect(view.getByText("Partita non preferita")).toBeTruthy();
      expect(view.getByText("Lezione di studio")).toBeTruthy();
    });
  });

  it("shows a dedicated empty state when there are no favorite games", async () => {
    getLessonsPageMock
      .mockResolvedValueOnce(pageResult([
      {
        id: 1,
        title: "Partita non preferita",
        description: "",
        mode: "analysis",
        createdAt: new Date("2026-07-13"),
        isFavorite: false,
      },
      ]))
      .mockResolvedValueOnce(pageResult([]));

    const view = render(
      <MemoryRouter>
        <LessonsPage />
      </MemoryRouter>,
    );

    await view.findByText("Partita non preferita");
    fireEvent.click(view.getByRole("button", { name: "Preferite" }));

    expect(await view.findByText("Nessuna partita preferita")).toBeTruthy();
  });
});
