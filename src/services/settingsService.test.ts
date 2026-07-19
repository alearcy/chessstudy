import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fromMock,
  eqMock,
  getUserMock,
  maybeSingleMock,
  singleMock,
  upsertMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  eqMock: vi.fn(),
  getUserMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  singleMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: { getUser: getUserMock },
    from: fromMock,
  },
}));

import { getAppSettings, setAppSettings } from "@/services/settingsService";

beforeEach(() => {
  vi.clearAllMocks();
  getUserMock.mockResolvedValue({
    data: { user: { id: "10000000-0000-4000-8000-000000000001" } },
    error: null,
  });
  fromMock.mockReturnValue({
    select: vi.fn(() => ({ eq: eqMock })),
    upsert: upsertMock,
  });
  eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
  upsertMock.mockReturnValue({
    select: vi.fn(() => ({ single: singleMock })),
  });
});

describe("settingsService", () => {
  it("returns conservative defaults when the user has no settings row", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    await expect(getAppSettings()).resolves.toEqual({
      stockfish_depth: 15,
      stockfish_threads: 2,
      lichess_username: "",
      chesscom_username: "",
    });
  });

  it("upserts clamped settings for the authenticated user", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "10000000-0000-4000-8000-000000000001" } },
      error: null,
    });
    singleMock.mockResolvedValue({
      data: {
        stockfish_depth: 30,
        stockfish_threads: 1,
        lichess_username: "lichess-user",
        chesscom_username: "chess-user",
      },
      error: null,
    });

    await setAppSettings({
      stockfish_depth: 99,
      stockfish_threads: 0,
      lichess_username: "  lichess-user  ",
      chesscom_username: " chess-user ",
    });

    expect(upsertMock).toHaveBeenCalledWith({
      user_id: "10000000-0000-4000-8000-000000000001",
      stockfish_depth: 30,
      stockfish_threads: 1,
      lichess_username: "lichess-user",
      chesscom_username: "chess-user",
      updated_at: expect.any(String),
    }, { onConflict: "user_id" });
  });
});
