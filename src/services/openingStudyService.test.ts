import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

import {
  OpeningDestinationConflict,
  addOpeningToStudy,
  createOpeningStudy,
} from "@/services/openingStudyService";
import type { OpeningReference } from "@/types";

const sicilian: OpeningReference = {
  eco: "B20",
  name: "Sicilian Defense",
  family: "Sicilian Defense",
  pgn: "1. e4 c5",
};

function studiesQuery(data: unknown[]) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockResolvedValue({ data, error: null });
  return builder;
}

describe("opening study remote persistence", () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it("creates lesson, board and complete line with one RPC", async () => {
    fromMock.mockReturnValue(studiesQuery([]));
    rpcMock.mockResolvedValue({
      data: { lesson_id: 10, board_id: 20 },
      error: null,
    });

    await expect(createOpeningStudy(sicilian, {
      title: "Siciliana",
      conflict: "error",
    })).resolves.toEqual({ lessonId: 10, boardId: 20 });

    const [, args] = rpcMock.mock.calls[0];
    expect(rpcMock).toHaveBeenCalledWith("save_lesson_tree", expect.any(Object));
    expect(args.p_moves).toHaveLength(2);
    expect(args.p_moves.map((move: { move_notation: string }) => move.move_notation))
      .toEqual(["e4", "c5"]);
  });

  it("surfaces an explicit conflict without writing", async () => {
    fromMock.mockReturnValue(studiesQuery([{
      id: 10,
      uid: "10000000-0000-4000-8000-000000000010",
      title: "Siciliana",
      description: "",
      mode: "study",
      is_favorite: false,
      boards: [],
    }]));

    await expect(createOpeningStudy(sicilian, {
      title: "Siciliana",
      conflict: "error",
    })).rejects.toMatchObject({
      kind: "lesson",
      suggestedName: "Siciliana (2)",
    } satisfies Partial<OpeningDestinationConflict>);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("replaces a conflicting board atomically after confirmation", async () => {
    fromMock.mockReturnValue(studiesQuery([{
      id: 10,
      uid: "10000000-0000-4000-8000-000000000010",
      title: "Siciliana",
      description: "",
      mode: "study",
      is_favorite: false,
      boards: [{
        id: 20,
        uid: "20000000-0000-4000-8000-000000000020",
        title: "Sicilian Defense",
        board_order: 0,
        opening_family: "Sicilian Defense",
      }],
    }]));
    rpcMock.mockResolvedValue({
      data: { lesson_id: 10, board_id: 20 },
      error: null,
    });

    await addOpeningToStudy(sicilian, {
      lessonId: 10,
      conflict: "overwrite",
    });

    expect(rpcMock).toHaveBeenCalledWith("save_board_line", expect.objectContaining({
      p_lesson_id: 10,
      p_board_id: 20,
    }));
  });
});
