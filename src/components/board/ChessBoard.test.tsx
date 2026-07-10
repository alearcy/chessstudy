import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ChessBoardView from "@/components/board/ChessBoard";

const { chessgroundMock } = vi.hoisted(() => ({
  chessgroundMock: vi.fn(() => ({
    destroy: vi.fn(),
    selectSquare: vi.fn(),
    set: vi.fn(),
    setAutoShapes: vi.fn(),
    setShapes: vi.fn(),
  })),
}));

vi.mock("@lichess-org/chessground", () => ({
  Chessground: chessgroundMock,
}));

afterEach(() => {
  cleanup();
  chessgroundMock.mockClear();
});

function renderBoard(lessonMode: "study" | "analysis") {
  return render(
    <ChessBoardView
      fen="start"
      arrows={[]}
      highlights={[]}
      onArrowsChange={vi.fn()}
      onHighlightsChange={vi.fn()}
      onClearArrows={vi.fn()}
      canUndo={false}
      canRedo={false}
      onMove={() => true}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
      onReset={vi.fn()}
      lessonMode={lessonMode}
    />,
  );
}

describe.each(["study", "analysis"] as const)(
  "ChessBoardView in modalità %s",
  (lessonMode) => {
    it("mostra le coordinate fuori di default e le porta dentro al clic", () => {
      const view = renderBoard(lessonMode);

      expect(chessgroundMock).toHaveBeenLastCalledWith(
        expect.any(HTMLDivElement),
        expect.objectContaining({ coordinatesOnSquares: false }),
      );

      fireEvent.click(view.getByTitle("Mostra coordinate dentro le case"));

      expect(chessgroundMock).toHaveBeenLastCalledWith(
        expect.any(HTMLDivElement),
        expect.objectContaining({ coordinatesOnSquares: true }),
      );
    });
  },
);
