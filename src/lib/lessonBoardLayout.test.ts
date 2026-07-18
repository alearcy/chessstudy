import { describe, expect, it } from "vitest";

import { lessonBoardLayoutClass } from "@/lib/lessonBoardLayout";

describe("lessonBoardLayoutClass", () => {
  it("uses the same center-column limits for analysis and study", () => {
    const analysis = lessonBoardLayoutClass("analysis");
    const study = lessonBoardLayoutClass("study");

    expect(analysis).toContain("minmax(32.5rem,44.5rem)");
    expect(study).toContain("minmax(32.5rem,44.5rem)");
    expect(analysis).toContain("minmax(36.5rem,48.5rem)");
    expect(study).toContain("minmax(36.5rem,48.5rem)");
  });

  it("keeps desktop columns above the xl breakpoint", () => {
    const study = lessonBoardLayoutClass("study");

    expect(study).toContain("xl:grid-cols-");
    expect(study).toContain("2xl:grid-cols-");
    expect(study).not.toContain("lg:grid-cols-");
  });
});
