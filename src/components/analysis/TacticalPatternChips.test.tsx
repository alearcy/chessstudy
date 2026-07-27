import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TacticalPatternChips from "@/components/analysis/TacticalPatternChips";
import { tacticalPatternKey } from "@/lib/tacticalPatterns";
import type { TacticalPattern } from "@/types";

const patterns: TacticalPattern[] = [
  {
    type: "fork",
    actor: "cavallo",
    victims: ["torre", "donna"],
    squares: ["d5", "c7", "f6"],
    description: "Forchetta di cavallo.",
  },
  {
    type: "skewer",
    actor: "alfiere",
    victims: ["Re", "torre"],
    squares: ["b5", "e8", "f7"],
    description: "Infilata di alfiere.",
  },
];

afterEach(cleanup);

describe("TacticalPatternChips", () => {
  it("starts with named, unpressed chips and selects one pattern", () => {
    const onSelectedKeyChange = vi.fn();
    const view = render(
      <TacticalPatternChips
        patterns={patterns}
        selectedKey={null}
        onSelectedKeyChange={onSelectedKeyChange}
      />,
    );

    const forkButton = view.getByRole("button", { name: "Forchetta" });
    expect(forkButton.getAttribute("aria-pressed")).toBe("false");
    expect(
      view.getByRole("button", { name: "Infilata" }).getAttribute("aria-pressed"),
    ).toBe("false");

    fireEvent.click(forkButton);
    expect(onSelectedKeyChange).toHaveBeenCalledWith(
      tacticalPatternKey(patterns[0]),
    );
  });

  it("replaces the active tactic and toggles it off on a second click", () => {
    const onSelectedKeyChange = vi.fn();
    const activeKey = tacticalPatternKey(patterns[0]);
    const view = render(
      <TacticalPatternChips
        patterns={patterns}
        selectedKey={activeKey}
        onSelectedKeyChange={onSelectedKeyChange}
      />,
    );

    expect(
      view.getByRole("button", { name: "Forchetta" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(view.getByRole("button", { name: "Infilata" }));
    expect(onSelectedKeyChange).toHaveBeenLastCalledWith(
      tacticalPatternKey(patterns[1]),
    );

    fireEvent.click(view.getByRole("button", { name: "Forchetta" }));
    expect(onSelectedKeyChange).toHaveBeenLastCalledWith(null);
  });
});
