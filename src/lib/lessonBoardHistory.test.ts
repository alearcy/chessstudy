import { describe, expect, it } from "vitest";

import { initialHistoryIndexForLessonMode } from "@/lib/lessonBoardHistory";

describe("initialHistoryIndexForLessonMode", () => {
  it("opens Study at the end of the persisted line", () => {
    expect(initialHistoryIndexForLessonMode("study", 6)).toBe(6);
    expect(initialHistoryIndexForLessonMode("study", 0)).toBe(0);
  });

  it("keeps Analysis at the initial position", () => {
    expect(initialHistoryIndexForLessonMode("analysis", 6)).toBe(0);
  });
});
