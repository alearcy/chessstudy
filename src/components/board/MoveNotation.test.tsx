import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MoveNotation from "@/components/board/MoveNotation";
import type { Move } from "@/types";

afterEach(cleanup);

const moves: Move[] = [
  {
    id: 1,
    boardId: 1,
    moveNotation: "e4",
    fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    parentId: null,
    order: 0,
    comment: "",
    stockfishComment: "Buona mossa.",
    analysisComment: "Controlla il centro.",
    arrows: [],
    highlights: [],
    createdAt: new Date(),
  },
  {
    id: 2,
    boardId: 1,
    moveNotation: "e5",
    fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    parentId: 1,
    order: 1,
    comment: "Ricordare questa idea.",
    stockfishComment: "Mossa migliore.",
    arrows: [],
    highlights: [],
    createdAt: new Date(),
  },
];

describe("MoveNotation comment indicators", () => {
  it("hides message icons when user-comment indicators are disabled", () => {
    const view = render(
      <MoveNotation
        moves={moves}
        currentMoveIndex={0}
        onGoToMove={vi.fn()}
      />,
    );

    expect(view.queryByLabelText("Nota utente presente")).toBeNull();
    expect(view.container.querySelector(".lucide-message-square")).toBeNull();
  });

  it("shows one message icon only for the move with a user note", () => {
    const view = render(
      <MoveNotation
        moves={moves}
        currentMoveIndex={0}
        onGoToMove={vi.fn()}
        showUserCommentIndicators
      />,
    );

    expect(view.getAllByLabelText("Nota utente presente")).toHaveLength(1);
  });
});

describe("MoveNotation context menu", () => {
  it("does not expose move actions unless handlers are provided", () => {
    const view = render(
      <MoveNotation
        moves={moves}
        currentMoveIndex={0}
        onGoToMove={vi.fn()}
      />,
    );

    fireEvent.contextMenu(view.getByText("e4").closest("button")!);

    expect(view.queryByRole("menu")).toBeNull();
  });

  it("opens on right click and dispatches comment and delete actions", () => {
    const onCommentMove = vi.fn();
    const onDeleteMove = vi.fn();
    const view = render(
      <MoveNotation
        moves={moves}
        currentMoveIndex={0}
        onGoToMove={vi.fn()}
        onCommentMove={onCommentMove}
        onDeleteMove={onDeleteMove}
      />,
    );

    fireEvent.contextMenu(view.getByText("e4").closest("button")!, {
      clientX: 120,
      clientY: 80,
    });

    expect(view.getByRole("menu")).toBeTruthy();
    fireEvent.click(view.getByRole("menuitem", { name: "Commenta" }));
    expect(onCommentMove).toHaveBeenCalledWith(1);
    expect(view.queryByRole("menu")).toBeNull();

    fireEvent.contextMenu(view.getByText("e5").closest("button")!);
    fireEvent.click(view.getByRole("menuitem", { name: "Elimina" }));
    expect(onDeleteMove).toHaveBeenCalledWith(2);
    expect(view.queryByRole("menu")).toBeNull();
  });
});
