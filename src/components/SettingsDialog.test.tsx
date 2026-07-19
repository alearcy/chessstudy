import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SettingsDialog from "@/components/SettingsDialog";

const {
  getAppSettingsMock,
  getStockfishRuntimeInfoMock,
  resetStockfishSettingsCacheMock,
  setAppSettingsMock,
} = vi.hoisted(() => ({
  getAppSettingsMock: vi.fn(),
  getStockfishRuntimeInfoMock: vi.fn(),
  resetStockfishSettingsCacheMock: vi.fn(),
  setAppSettingsMock: vi.fn(),
}));

vi.mock("@/services/settingsService", () => ({
  getAppSettings: getAppSettingsMock,
  setAppSettings: setAppSettingsMock,
}));

vi.mock("@/services/analysisService", () => ({
  getStockfishRuntimeInfo: getStockfishRuntimeInfoMock,
  resetStockfishSettingsCache: resetStockfishSettingsCacheMock,
}));

beforeEach(() => {
  getAppSettingsMock.mockResolvedValue({
    stockfish_depth: 15,
    stockfish_threads: 2,
    lichess_username: "old-lichess",
    chesscom_username: "old-chesscom",
  });
  setAppSettingsMock.mockImplementation((settings) => Promise.resolve(settings));
  getStockfishRuntimeInfoMock.mockReturnValue({
    flavor: "multi",
    threads: 2,
    compatibilityMode: false,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("SettingsDialog", () => {
  it("offers the conservative 2-thread profile on an 8-thread device", async () => {
    vi.spyOn(window.navigator, "hardwareConcurrency", "get").mockReturnValue(8);

    render(<SettingsDialog open onOpenChange={vi.fn()} />);
    await waitFor(() => expect(getAppSettingsMock).toHaveBeenCalled());
    const cpuSelect = document.querySelectorAll("select")[1];
    const values = Array.from(cpuSelect.options, (option) => Number(option.value));

    expect(values).toContain(2);
  });

  it("loads and saves usernames and Stockfish settings through Supabase", async () => {
    const view = render(<SettingsDialog open onOpenChange={vi.fn()} />);

    const lichessInput = await view.findByLabelText("Username Lichess");
    const chesscomInput = view.getByLabelText("Username Chess.com");
    await waitFor(() => {
      expect((lichessInput as HTMLInputElement).value).toBe("old-lichess");
      expect((chesscomInput as HTMLInputElement).value).toBe("old-chesscom");
    });

    fireEvent.change(lichessInput, { target: { value: "new-lichess" } });
    fireEvent.change(chesscomInput, { target: { value: "new-chesscom" } });
    fireEvent.click(view.getByRole("button", { name: "Salva impostazioni" }));

    await waitFor(() => {
      expect(setAppSettingsMock).toHaveBeenCalledWith({
        stockfish_depth: 15,
        stockfish_threads: 2,
        lichess_username: "new-lichess",
        chesscom_username: "new-chesscom",
      });
      expect(resetStockfishSettingsCacheMock).toHaveBeenCalledOnce();
    });
  });

  it("shows compatibility mode and the effective one-thread limit", async () => {
    getStockfishRuntimeInfoMock.mockReturnValue({
      flavor: "single",
      threads: 1,
      compatibilityMode: true,
    });

    const view = render(<SettingsDialog open onOpenChange={vi.fn()} />);

    expect(await view.findByText(/Modalita compatibilita/i)).toBeTruthy();
    expect(view.getByText(/usa 1 thread/i)).toBeTruthy();
  });
});
