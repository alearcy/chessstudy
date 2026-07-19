import { describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    rpc: rpcMock,
  },
}));

import { convertAnalysisToStudy } from "@/services/lessonService";

describe("lesson service Supabase transactions", () => {
  it("delegates analysis conversion to one atomic RPC", async () => {
    rpcMock.mockResolvedValue({ data: 44, error: null });

    await expect(convertAnalysisToStudy(
      {
        id: 10,
        title: "Partita",
        description: "",
        mode: "analysis",
        createdAt: new Date(),
      },
      {
        id: 20,
        lessonId: 10,
        title: "Board",
        fen: "start",
        notes: "",
        arrows: [],
        highlights: [],
        order: 0,
        createdAt: new Date(),
      },
      [],
    )).resolves.toBe(44);

    expect(rpcMock).toHaveBeenCalledWith("convert_analysis_to_study", {
      p_source_lesson_id: 10,
      p_source_board_id: 20,
    });
  });
});
