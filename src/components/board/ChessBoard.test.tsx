import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
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

function renderBoard(
  lessonMode: "study" | "analysis",
  options: {
    top?: ReactNode;
    bottom?: ReactNode;
    onConvertToStudy?: () => void;
    converting?: boolean;
  } = {},
) {
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
      topPlayerLabel={options.top}
      bottomPlayerLabel={options.bottom}
      onConvertToStudy={options.onConvertToStudy}
      converting={options.converting}
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

describe("ChessBoardView player labels", () => {
  it("mostra il giocatore superiore dopo la toolbar e prima della scacchiera", () => {
    const view = renderBoard("analysis", {
      top: <span data-testid="top-player">Nero</span>,
    });

    const toolbarButton = view.getByTitle("Inverti orientamento scacchiera");
    const topPlayer = view.getByTestId("top-player");
    const board = view.container.querySelector(".cs-board-shell");

    expect(board).not.toBeNull();
    expect(
      toolbarButton.compareDocumentPosition(topPlayer) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      topPlayer.compareDocumentPosition(board!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("ChessBoardView conversione in studio", () => {
  it("apre la conferma senza convertire e permette di annullare", () => {
    const onConvertToStudy = vi.fn();
    const view = renderBoard("analysis", { onConvertToStudy });

    fireEvent.click(
      view.getByTitle("Converti questa analisi in una lezione di studio"),
    );

    expect(onConvertToStudy).not.toHaveBeenCalled();
    expect(
      view.getByRole("heading", { name: "Converti in lezione di studio" }),
    ).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: "Annulla" }));

    expect(onConvertToStudy).not.toHaveBeenCalled();
    expect(
      view.queryByRole("heading", { name: "Converti in lezione di studio" }),
    ).toBeNull();
  });

  it("avvia la conversione soltanto dopo la conferma", () => {
    const onConvertToStudy = vi.fn();
    const view = renderBoard("analysis", { onConvertToStudy });

    fireEvent.click(
      view.getByTitle("Converti questa analisi in una lezione di studio"),
    );
    fireEvent.click(view.getByRole("button", { name: "Converti" }));

    expect(onConvertToStudy).toHaveBeenCalledTimes(1);
  });
});
