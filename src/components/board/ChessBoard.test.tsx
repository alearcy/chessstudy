import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Config } from "@lichess-org/chessground/config";

import ChessBoardView from "@/components/board/ChessBoard";
import type { BoardArrow, BoardHighlight } from "@/types";

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
    highlights?: string[];
    onAnnotationsChange?: (
      arrows: BoardArrow[],
      highlights: BoardHighlight[],
    ) => void;
    onExportPgn?: () => void;
    onExportImage?: () => void;
  } = {},
) {
  return render(
    <ChessBoardView
      fen="start"
      arrows={[]}
      highlights={options.highlights ?? []}
      onAnnotationsChange={options.onAnnotationsChange ?? vi.fn()}
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
      onExportPgn={options.onExportPgn}
      onExportImage={options.onExportImage}
    />,
  );
}

function lastConfig(): Config {
  const calls = chessgroundMock.mock.calls as unknown as [
    HTMLDivElement,
    Config,
  ][];
  return calls.at(-1)![1];
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

describe("ChessBoardView gesture Studio", () => {
  it("abilita movimento e disegno insieme senza selettori di modalità", () => {
    const view = renderBoard("study");
    const config = lastConfig();

    expect(config.movable?.color).toBe("both");
    expect(config.draggable?.enabled).toBe(true);
    expect(config.drawable?.enabled).toBe(true);
    expect(view.queryByRole("button", { name: "Muovi" })).toBeNull();
    expect(view.queryByRole("button", { name: "Frecce" })).toBeNull();
    expect(view.queryByRole("button", { name: "Evidenzia" })).toBeNull();
  });

  it("mantiene movimento e disegno disabilitati in Analisi", () => {
    renderBoard("analysis");
    const config = lastConfig();

    expect(config.movable?.color).toBeUndefined();
    expect(config.draggable?.enabled).toBe(false);
    expect(config.drawable?.enabled).toBe(false);
  });

  it("separa e persiste atomicamente frecce e case con i colori dei modificatori", () => {
    const onAnnotationsChange = vi.fn<
      (arrows: BoardArrow[], highlights: BoardHighlight[]) => void
    >();
    renderBoard("study", {
      highlights: ["a1"],
      onAnnotationsChange,
    });
    const config = lastConfig();

    expect(config.drawable?.shapes).toEqual(
      expect.arrayContaining([{ orig: "a1", brush: "yellow" }]),
    );

    config.drawable?.onChange?.([
      { orig: "e2", dest: "e4", brush: "green" },
      { orig: "d4", brush: "green" },
      { orig: "c3", brush: "red" },
      { orig: "b2", brush: "blue" },
    ]);

    expect(onAnnotationsChange).toHaveBeenCalledWith(
      [["e2", "e4", "rgb(239,68,68)"]],
      [
        ["d4", "rgb(239,68,68)"],
        ["c3", "rgb(34,197,94)"],
        ["b2", "rgb(250,204,21)"],
      ],
    );
  });
});

describe("ChessBoardView esportazione Studio", () => {
  it("mostra le due azioni in Studio e invoca gli handler", () => {
    const onExportPgn = vi.fn();
    const onExportImage = vi.fn();
    const view = renderBoard("study", { onExportPgn, onExportImage });

    fireEvent.click(view.getByTitle("Esporta scacchiera come PGN"));
    fireEvent.click(view.getByTitle("Esporta scacchiera come immagine"));

    expect(onExportPgn).toHaveBeenCalledTimes(1);
    expect(onExportImage).toHaveBeenCalledTimes(1);
  });

  it("non espone le azioni in Analisi", () => {
    const view = renderBoard("analysis", {
      onExportPgn: vi.fn(),
      onExportImage: vi.fn(),
    });

    expect(view.queryByTitle("Esporta scacchiera come PGN")).toBeNull();
    expect(view.queryByTitle("Esporta scacchiera come immagine")).toBeNull();
  });
});

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
