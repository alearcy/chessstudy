import { describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

import { duplicateBoard, reorderStudyBoards } from "@/services/boardService";

describe("board service Supabase transactions", () => {
  it("delegates study board duplication to one atomic RPC", async () => {
    rpcMock.mockResolvedValue({ data: 42, error: null });

    await expect(duplicateBoard(7)).resolves.toBe(42);

    expect(rpcMock).toHaveBeenCalledWith("duplicate_study_board", {
      p_source_board_id: 7,
    });
  });

  it("returns a user-facing error when the RPC has no result", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await expect(duplicateBoard(7)).rejects.toThrow(
      "Duplicazione scacchiera fallita.",
    );
  });

  it("delegates study board reorder to one atomic RPC", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await expect(reorderStudyBoards(3, [8, 9, 7])).resolves.toBeUndefined();

    expect(rpcMock).toHaveBeenCalledWith("reorder_study_boards", {
      p_lesson_id: 3,
      p_board_ids: [8, 9, 7],
    });
  });

  it("returns a user-facing error when board reorder fails", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "ordine non valido" },
    });

    await expect(reorderStudyBoards(3, [8, 9, 7])).rejects.toThrow(
      "Riordino scacchiere fallito.",
    );
  });
});
