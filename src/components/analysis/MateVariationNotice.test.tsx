import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MateVariationNotice from "@/components/analysis/MateVariationNotice";

afterEach(cleanup);

describe("MateVariationNotice", () => {
  it("shows the mate sequence progress and returns to the game", () => {
    const onClose = vi.fn();
    const view = render(
      <MateVariationNotice
        mateIn={3}
        state={{ phase: "ready", current: 2, total: 5 }}
        onClose={onClose}
      />,
    );

    expect(view.getByText("Matto in 3")).toBeTruthy();
    expect(view.getByText("Mossa 2 di 5")).toBeTruthy();
    expect(view.getByText("Sequenza di matto")).toBeTruthy();

    fireEvent.click(
      view.getByRole("button", { name: "Torna alla partita" }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("exposes an unavailable sequence as an error state", () => {
    const view = render(
      <MateVariationNotice
        mateIn={2}
        state={{ phase: "unavailable" }}
        onClose={() => undefined}
      />,
    );

    expect(view.getByText("Sequenza non disponibile")).toBeTruthy();
    expect(
      view.getByTestId("mate-variation-notice").getAttribute(
        "data-mate-line-state",
      ),
    ).toBe("unavailable");
  });
});
