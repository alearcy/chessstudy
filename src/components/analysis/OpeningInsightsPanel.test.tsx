import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import OpeningInsightsPanel from "@/components/analysis/OpeningInsightsPanel";
import type { OpeningReport } from "@/types";

afterEach(cleanup);

const report: OpeningReport = {
  whitePlayed: {
    eco: "C50",
    name: "Italian Game",
    family: "Italian Game",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4",
  },
  blackPlayed: {
    eco: "C44",
    name: "Open Game: Classical Development",
    family: "Open Game",
    pgn: "1. e4 e5 2. Nf3 Nc6",
  },
  whiteSuggested: null,
  blackSuggested: null,
};

describe("OpeningInsightsPanel", () => {
  it("shows opening results as study actions", () => {
    const onSelect = vi.fn();
    const view = render(
      <OpeningInsightsPanel
        report={report}
        loading={false}
        error={null}
        onRetry={vi.fn()}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(view.getByRole("button", {
      name: "Crea materiale di studio per Italian Game",
    }));
    expect(onSelect).toHaveBeenCalledWith(report.whitePlayed);
    expect(view.getByText("Nessun suggerimento disponibile")).toBeTruthy();
  });

  it("keeps database failures visible and retryable", () => {
    const onRetry = vi.fn();
    const view = render(
      <OpeningInsightsPanel
        report={undefined}
        loading={false}
        error="Database aperture non disponibile."
        onRetry={onRetry}
        onSelect={vi.fn()}
      />,
    );

    fireEvent.click(view.getByRole("button", { name: "Riprova" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
