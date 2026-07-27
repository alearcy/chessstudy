import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SettingsDialog from "@/components/SettingsDialog";

const {
  getAppSettingsMock,
  setAppSettingsMock,
} = vi.hoisted(() => ({
  getAppSettingsMock: vi.fn(),
  setAppSettingsMock: vi.fn(),
}));

vi.mock("@/services/settingsService", () => ({
  getAppSettings: getAppSettingsMock,
  setAppSettings: setAppSettingsMock,
}));

beforeEach(() => {
  getAppSettingsMock.mockResolvedValue({
    lichess_username: "old-lichess",
    chesscom_username: "old-chesscom",
  });
  setAppSettingsMock.mockImplementation((settings) => Promise.resolve(settings));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("SettingsDialog", () => {
  it("does not expose Stockfish depth or CPU controls", async () => {
    const view = render(<SettingsDialog open onOpenChange={vi.fn()} />);

    await waitFor(() => expect(getAppSettingsMock).toHaveBeenCalled());

    expect(view.queryByText("Stockfish")).toBeNull();
    expect(view.queryByText("Profondita")).toBeNull();
    expect(view.queryByText("CPU")).toBeNull();
    expect(view.queryByRole("combobox")).toBeNull();
  });

  it("loads and saves only the game account usernames through Supabase", async () => {
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
        lichess_username: "new-lichess",
        chesscom_username: "new-chesscom",
      });
    });
  });
});
