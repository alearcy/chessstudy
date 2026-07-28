import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TacticalVariationNotice from "@/components/analysis/TacticalVariationNotice";

afterEach(cleanup);

describe("TacticalVariationNotice", () => {
  it("identifies the alternative position and returns to the game", () => {
    const onClose = vi.fn();
    const view = render(
      <TacticalVariationNotice moveSan="Nd5" onClose={onClose} />,
    );

    expect(view.getByText("Se avessi giocato")).toBeTruthy();
    expect(view.getByText("Nd5")).toBeTruthy();
    expect(view.getByText("Posizione alternativa")).toBeTruthy();

    fireEvent.click(
      view.getByRole("button", { name: "Torna alla partita" }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });
});
