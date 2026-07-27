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

  it("uses the same move-sidebar widths for analysis and study", () => {
    const analysis = lessonBoardLayoutClass("analysis");
    const study = lessonBoardLayoutClass("study");

    expect(analysis).toContain("_20rem]");
    expect(study).toContain("_20rem]");
    expect(analysis).toContain("_22rem]");
    expect(study).toContain("_22rem]");
  });

  it("uses dedicated three-column tracks for tablet landscape", () => {
    const analysis = lessonBoardLayoutClass("analysis");
    const study = lessonBoardLayoutClass("study");

    expect(analysis).toContain(
      "tablet-landscape:grid-cols-[9rem_minmax(25rem,34rem)_17rem]",
    );
    expect(study).toContain(
      "tablet-landscape:grid-cols-[10rem_minmax(25rem,34rem)_17rem]",
    );
  });

  it("expands the sidebars on wider tablet landscape viewports", () => {
    const analysis = lessonBoardLayoutClass("analysis");
    const study = lessonBoardLayoutClass("study");

    expect(analysis).toContain(
      "tablet-landscape-wide:grid-cols-[12rem_minmax(25rem,34rem)_20rem]",
    );
    expect(study).toContain(
      "tablet-landscape-wide:grid-cols-[12rem_minmax(25rem,34rem)_20rem]",
    );
  });

  it("keeps the wider desktop tracks at xl and 2xl", () => {
    const study = lessonBoardLayoutClass("study");

    expect(study).toContain("tablet-landscape:grid-cols-");
    expect(study).toContain("xl:grid-cols-");
    expect(study).toContain("2xl:grid-cols-");
  });
});
