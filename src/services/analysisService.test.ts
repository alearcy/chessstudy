import { describe, expect, it } from "vitest";

import { evalScore, formatEval, moveClassification } from "@/services/analysisService";

describe("analysisService eval helpers", () => {
  it("formats centipawn and mate evaluations for display", () => {
    expect(formatEval(120, null)).toBe("+1.2");
    expect(formatEval(-35, null)).toBe("-0.3");
    expect(formatEval(null, 3)).toBe("M3");
    expect(formatEval(null, -5)).toBe("-M5");
  });

  it("classifies move quality from centipawn loss", () => {
    expect(moveClassification(10)).toMatchObject({ label: "!" });
    expect(moveClassification(80)).toMatchObject({ label: "?!" });
    expect(moveClassification(180)).toMatchObject({ label: "?" });
    expect(moveClassification(350)).toMatchObject({ label: "??" });
  });

  it("makes a shorter forced mate substantially better than a longer one", () => {
    expect(evalScore(null, 1) - evalScore(null, 5)).toBeGreaterThanOrEqual(300);
    expect(evalScore(null, -5) - evalScore(null, -1)).toBeGreaterThanOrEqual(300);
  });
});
