import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MoveCommentPreview from "@/components/lesson/MoveCommentPreview";
import { tacticalPatternKey } from "@/lib/tacticalPatterns";
import type { Move, TacticalPattern } from "@/types";

const forkExplanation = "Il cavallo crea una forchetta.";

const fork: TacticalPattern = {
  type: "fork",
  actor: "cavallo",
  victims: ["torre", "donna"],
  squares: ["d5", "c7", "f6"],
  description: `Forchetta: ${forkExplanation}`,
};

const move: Move = {
  id: 1,
  boardId: 1,
  moveNotation: "Nd5",
  fen: "after-nd5",
  parentId: null,
  order: 0,
  comment: "",
  analysisComment: `La posizione contiene una tattica:\n• ${fork.description}`,
  arrows: [],
  highlights: [],
  tactics: [fork],
  createdAt: new Date(),
};

afterEach(cleanup);

describe("MoveCommentPreview tactical lines", () => {
  it("places the chip beside the matching tactical explanation", () => {
    const onSelectedTacticKeyChange = vi.fn();
    const view = render(
      <MoveCommentPreview
        currentMove={move}
        historyIndex={1}
        text={move.analysisComment ?? ""}
        tactics={[fork]}
        selectedTacticKey={null}
        onSelectedTacticKeyChange={onSelectedTacticKeyChange}
      />,
    );

    const explanation = view.getByText(forkExplanation);
    const tacticalLine = explanation.closest("[data-tactical-comment]");
    expect(tacticalLine).not.toBeNull();
    expect(
      within(tacticalLine as HTMLElement).getByRole("button", { name: "Forchetta" }),
    ).toBeTruthy();
    expect(tacticalLine?.textContent).toBe(`Forchetta: ${forkExplanation}`);
    expect(tacticalLine?.className).not.toContain("inline-flex");

    fireEvent.click(
      within(tacticalLine as HTMLElement).getByRole("button", { name: "Forchetta" }),
    );
    expect(onSelectedTacticKeyChange).toHaveBeenCalledWith(
      tacticalPatternKey(fork),
    );
  });

  it("does not duplicate the explanation in a separate chip list", () => {
    const view = render(
      <MoveCommentPreview
        currentMove={move}
        historyIndex={1}
        text={move.analysisComment ?? ""}
        tactics={[fork]}
        selectedTacticKey={tacticalPatternKey(fork)}
        onSelectedTacticKeyChange={vi.fn()}
      />,
    );

    expect(view.getAllByText(forkExplanation)).toHaveLength(1);
    expect(view.getByRole("button", { name: "Forchetta" }).getAttribute("aria-pressed"))
      .toBe("true");
  });
});
