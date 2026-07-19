import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  supabase: { from: fromMock },
}));

import { getLessonsPage } from "@/repositories/lessonRepository";

describe("Supabase lesson repository", () => {
  let builder: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    builder = {};
    for (const method of [
      "select", "eq", "gte", "lt", "textSearch", "order",
    ]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.range = vi.fn(async () => ({
      data: [{
        id: 7,
        uid: "10000000-0000-4000-8000-000000000007",
        title: "Partita Lichess",
        description: "",
        mode: "analysis",
        is_favorite: true,
        created_at: "2026-07-18T10:00:00.000Z",
        updated_at: "2026-07-18T11:00:00.000Z",
        boards: [{ headers: { Site: "https://lichess.org/abc" } }],
      }],
      count: 1,
      error: null,
    }));
    fromMock.mockReset();
    fromMock.mockReturnValue(builder);
  });

  it("applies server-side filters, stable ordering and range pagination", async () => {
    const result = await getLessonsPage({
      kind: "favorites",
      query: "Kasparov B07",
      createdOn: "2026-07-18",
      page: 1,
      pageSize: 20,
    });

    expect(fromMock).toHaveBeenCalledWith("lessons");
    expect(builder.eq).toHaveBeenCalledWith("mode", "analysis");
    expect(builder.eq).toHaveBeenCalledWith("is_favorite", true);
    expect(builder.textSearch).toHaveBeenCalledWith(
      "search_text",
      "kasparov b07",
      { config: "simple", type: "websearch" },
    );
    expect(builder.order).toHaveBeenNthCalledWith(
      1, "created_at", { ascending: false },
    );
    expect(builder.order).toHaveBeenNthCalledWith(
      2, "id", { ascending: false },
    );
    expect(builder.range).toHaveBeenCalledWith(0, 19);
    expect(result).toMatchObject({
      total: 1,
      page: 1,
      pageCount: 1,
      items: [{
        id: 7,
        sourceLabel: "Lichess",
        createdAt: new Date("2026-07-18T10:00:00.000Z"),
      }],
    });
  });
});
