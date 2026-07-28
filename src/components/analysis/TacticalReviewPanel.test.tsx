import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TacticalReviewPanel from "@/components/analysis/TacticalReviewPanel";
import type { TacticalReview } from "@/lib/tacticalReview";

afterEach(cleanup);

const review: TacticalReview = {
  moments: [
    { moveIndex: 4, state: "missed", tacticKey: "missed:fork:c7,d5,f6" },
    { moveIndex: 1, state: "conceded", tacticKey: "conceded:skewer:a4,e8,h3" },
    { moveIndex: 0, state: "found", tacticKey: "found:fork:c7,d5,f6" },
  ],
  summary: {
    training: 2,
    positives: 1,
  },
};

describe("TacticalReviewPanel", () => {
  it("naviga i momenti nell'ordine ricevuto e comunica l'avanzamento", () => {
    const onSelectMoment = vi.fn();
    const view = render(
      <TacticalReviewPanel
        review={review}
        onSelectMoment={onSelectMoment}
      />,
    );

    expect(view.getByText("Da allenare").nextSibling?.textContent).toBe(
      "2 tattiche",
    );
    expect(view.getByText("Cose fatte bene").nextSibling?.textContent).toBe(
      "1 tattica",
    );
    expect(view.getByText("3 momenti")).toBeTruthy();

    const nextButton = view.getByRole("button", {
      name: "Prossimo momento importante",
    });
    fireEvent.click(nextButton);
    expect(onSelectMoment).toHaveBeenLastCalledWith(4, review.moments[0].tacticKey);
    expect(view.getByText("1 di 3")).toBeTruthy();

    fireEvent.click(nextButton);
    expect(onSelectMoment).toHaveBeenLastCalledWith(1, review.moments[1].tacticKey);
    expect(view.getByText("2 di 3")).toBeTruthy();
  });

  it("non mostra un pannello vuoto", () => {
    const view = render(
      <TacticalReviewPanel
        review={{
          moments: [],
          summary: { training: 0, positives: 0 },
        }}
        onSelectMoment={vi.fn()}
      />,
    );

    expect(view.container.firstChild).toBeNull();
  });
});
