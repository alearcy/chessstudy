import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import LessonsPage from "@/pages/LessonsPage";

const { getAllLessonsMock, getAppSettingsMock } = vi.hoisted(() => ({
  getAllLessonsMock: vi.fn(),
  getAppSettingsMock: vi.fn(),
}));

vi.mock("@/services/lessonService", () => ({
  getAllLessons: getAllLessonsMock,
  createLesson: vi.fn(),
  updateLesson: vi.fn(),
  deleteLesson: vi.fn(),
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
});

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
