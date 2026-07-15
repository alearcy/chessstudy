import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SettingsDialog from "@/components/SettingsDialog";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

afterEach(() => {
  cleanup();
  invokeMock.mockReset();
  vi.restoreAllMocks();
});

describe("SettingsDialog", () => {
  it("offers the conservative 2-thread profile on an 8-thread device", async () => {
    vi.spyOn(window.navigator, "hardwareConcurrency", "get").mockReturnValue(8);
    invokeMock.mockResolvedValue({
      stockfish_depth: 15,
      stockfish_threads: 4,
      lichess_username: "",
      chesscom_username: "",
    });

    const view = render(<SettingsDialog open onOpenChange={vi.fn()} />);
    await view.findByText("Rilevati 8 thread logici.");
    const cpuSelect = document.querySelectorAll("select")[1];
    const values = Array.from(cpuSelect.options, (option) => Number(option.value));

    expect(values).toContain(2);
  });

  it("loads, edits and saves the platform usernames with Stockfish settings", async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === "get_settings") {
        return Promise.resolve({
          stockfish_depth: 15,
          stockfish_threads: 1,
          lichess_username: "old-lichess",
          chesscom_username: "old-chesscom",
        });
      }
      return Promise.resolve({});
    });

    const view = render(
      <SettingsDialog open onOpenChange={vi.fn()} />,
    );

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
      expect(invokeMock).toHaveBeenCalledWith("set_settings", {
        args: {
          stockfish_depth: 15,
          stockfish_threads: 1,
          lichess_username: "new-lichess",
          chesscom_username: "new-chesscom",
        },
      });
    });
  });
});
