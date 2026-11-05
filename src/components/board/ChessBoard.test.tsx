import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Config } from "@lichess-org/chessground/config";

import ChessBoardView from "@/components/board/ChessBoard";
import type { BoardArrow, BoardHighlight } from "@/types";

const { apiSetMock, chessgroundMock } = vi.hoisted(() => {
  const apiSetMock = vi.fn();
  return {
    apiSetMock,
    chessgroundMock: vi.fn(() => ({
    state: { animation: {} },
    destroy: vi.fn(),
    selectSquare: vi.fn(),
    set: apiSetMock,
    setAutoShapes: vi.fn(),
    setShapes: vi.fn(),
  })),
  };
});

vi.mock("@lichess-org/chessground", () => ({
  Chessground: chessgroundMock,
}));

afterEach(() => {
  cleanup();
  apiSetMock.mockClear();
  chessgroundMock.mockClear();
});

function renderBoard(
  lessonMode: "study" | "analysis",
  options: {
    top?: ReactNode;
    bottom?: ReactNode;
    toolbarStatus?: ReactNode;
    onConvertToStudy?: () => void;
    converting?: boolean;
    arrows?: BoardArrow[];
    highlights?: BoardHighlight[];
    overlayHighlights?: BoardHighlight[];
    onAnnotationsChange?: (
      arrows: BoardArrow[],
      highlights: BoardHighlight[],
    ) => void;
    onExportPgn?: () => void;
    onExportImage?: () => void;
    onAnalyze?: () => void;
    analyzing?: boolean;
    analysisProgress?: { done: number; total: number } | null;
    lastMoveSquare?: "e4";
    lastMoveFromSquare?: "e2";
  } = {},
) {
  return render(
    <ChessBoardView
      fen="start"
      arrows={options.arrows ?? []}
      highlights={options.highlights ?? []}
      overlayHighlights={options.overlayHighlights ?? []}
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
      toolbarStatus={options.toolbarStatus}
      onConvertToStudy={options.onConvertToStudy}
      converting={options.converting}
      onExportPgn={options.onExportPgn}
      onExportImage={options.onExportImage}
      onAnalyze={options.onAnalyze}
      analyzing={options.analyzing}
      analysisProgress={options.analysisProgress}
      canAnalyze
      analysisDepth={15}
      lastMoveSquare={options.lastMoveSquare}
      lastMoveFromSquare={options.lastMoveFromSquare}
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

function openToolsMenu(view: ReturnType<typeof renderBoard>) {
  const trigger = view.getByRole("button", { name: "Altri strumenti" });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.click(trigger);
}

describe.each(["study", "analysis"] as const)(
  "ChessBoardView in modalità %s",
  (lessonMode) => {
    it("evidenzia in azzurro partenza e arrivo dell'ultima mossa", () => {
      const view = renderBoard(lessonMode, {
        lastMoveFromSquare: "e2",
        lastMoveSquare: "e4",
      });
      const customClasses = lastConfig().highlight?.custom;

      expect(customClasses?.get("e2")).toBe("cs-last-move");
      expect(customClasses?.get("e4")).toBe("cs-last-move");
      expect(view.container.querySelector("style")?.textContent).toContain(
        "rgba(56, 189, 248, 0.45)",
      );
    });

    it("mostra le coordinate fuori di default e le porta dentro al clic", () => {
      const view = renderBoard(lessonMode);
      const boardShell = view.container.querySelector<HTMLElement>(
        ".cs-board-shell",
      )!;

      expect(chessgroundMock).toHaveBeenLastCalledWith(
        expect.any(HTMLDivElement),
        expect.objectContaining({
          coordinatesOnSquares: false,
          ranksPosition: "right",
        }),
      );
      expect(boardShell.dataset.coordinateLayout).toBe("frame");

      openToolsMenu(view);
      fireEvent.click(screen.getByRole("menuitem", { name: "Coordinate dentro" }));

      expect(chessgroundMock).toHaveBeenLastCalledWith(
        expect.any(HTMLDivElement),
        expect.objectContaining({ coordinatesOnSquares: true }),
      );
      expect(boardShell.dataset.coordinateLayout).toBe("squares");
    });
  },
);

describe("ChessBoardView gesture Studio", () => {
  it("mostra i selettori touch e lascia attive le gesture in modalità Muovi", () => {
    const view = renderBoard("study");
    const config = lastConfig();

    expect(config.movable?.color).toBe("both");
    expect(config.draggable?.enabled).toBe(true);
    expect(config.drawable?.enabled).toBe(true);
    expect(view.getByRole("button", { name: "Muovi" }).getAttribute("aria-pressed")).toBe("true");
    expect(view.getByRole("button", { name: "Freccia" }).getAttribute("aria-pressed")).toBe("false");
    expect(view.getByRole("button", { name: "Evidenzia" }).getAttribute("aria-pressed")).toBe("false");
    expect(view.getByRole("button", { name: "Gomma" }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(view.getByRole("button", { name: "Freccia" }));

    expect(apiSetMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        movable: expect.objectContaining({ color: undefined }),
        draggable: expect.objectContaining({ enabled: false }),
      }),
    );
    expect(view.getByRole("button", { name: "Freccia" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("non mostra i selettori touch in Analisi", () => {
    const view = renderBoard("analysis");

    expect(view.queryByRole("button", { name: "Muovi" })).toBeNull();
    expect(view.queryByRole("button", { name: "Freccia" })).toBeNull();
    expect(view.queryByRole("button", { name: "Evidenzia" })).toBeNull();
    expect(view.queryByRole("button", { name: "Gomma" })).toBeNull();
  });

  it("disegna una freccia tramite puntatore touch", () => {
    const onAnnotationsChange = vi.fn<
      (arrows: BoardArrow[], highlights: BoardHighlight[]) => void
    >();
    const view = renderBoard("study", { onAnnotationsChange });

    fireEvent.click(view.getByRole("button", { name: "Freccia" }));
    const surface = view.getByTestId("touch-annotation-surface");
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 800,
      width: 800,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(surface, { clientX: 450, clientY: 650, pointerId: 1 });
    fireEvent.pointerUp(surface, { clientX: 450, clientY: 450, pointerId: 1 });

    expect(onAnnotationsChange).toHaveBeenLastCalledWith(
      [["e2", "e4", "rgb(239,68,68)"]],
      [],
    );
  });

  it("rimuove una freccia ripetendo lo stesso trascinamento touch", () => {
    const onAnnotationsChange = vi.fn<
      (arrows: BoardArrow[], highlights: BoardHighlight[]) => void
    >();
    const view = renderBoard("study", {
      arrows: [["e2", "e4", "rgb(239,68,68)"]],
      onAnnotationsChange,
    });

    fireEvent.click(view.getByRole("button", { name: "Freccia" }));
    const surface = view.getByTestId("touch-annotation-surface");
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 800,
      width: 800,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(surface, { clientX: 450, clientY: 650, pointerId: 3 });
    fireEvent.pointerUp(surface, { clientX: 450, clientY: 450, pointerId: 3 });

    expect(onAnnotationsChange).toHaveBeenLastCalledWith([], []);
  });

  it("evidenzia e rimuove una casa tramite puntatore touch", () => {
    const onAnnotationsChange = vi.fn<
      (arrows: BoardArrow[], highlights: BoardHighlight[]) => void
    >();
    const view = renderBoard("study", { onAnnotationsChange });

    fireEvent.click(view.getByRole("button", { name: "Evidenzia" }));
    const surface = view.getByTestId("touch-annotation-surface");
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 800,
      width: 800,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(surface, { clientX: 50, clientY: 750, pointerId: 2 });
    fireEvent.pointerUp(surface, { clientX: 50, clientY: 750, pointerId: 2 });

    expect(onAnnotationsChange).toHaveBeenLastCalledWith(
      [],
      [["a1", "rgb(250,204,21)"]],
    );
  });

  it("rimuove una casa evidenziata con un altro tocco", () => {
    const onAnnotationsChange = vi.fn<
      (arrows: BoardArrow[], highlights: BoardHighlight[]) => void
    >();
    const view = renderBoard("study", {
      highlights: [["a1", "rgb(250,204,21)"]],
      onAnnotationsChange,
    });

    fireEvent.click(view.getByRole("button", { name: "Evidenzia" }));
    const surface = view.getByTestId("touch-annotation-surface");
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 800,
      width: 800,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(surface, { clientX: 50, clientY: 750, pointerId: 4 });
    fireEvent.pointerUp(surface, { clientX: 50, clientY: 750, pointerId: 4 });

    expect(onAnnotationsChange).toHaveBeenLastCalledWith([], []);
  });

  it("cancella una casa evidenziata con la gomma", () => {
    const onAnnotationsChange = vi.fn<
      (arrows: BoardArrow[], highlights: BoardHighlight[]) => void
    >();
    const view = renderBoard("study", {
      highlights: [["a1", "rgb(250,204,21)"]],
      onAnnotationsChange,
    });

    fireEvent.click(view.getByRole("button", { name: "Gomma" }));
    const surface = view.getByTestId("touch-annotation-surface");
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 800,
      width: 800,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(surface, { clientX: 50, clientY: 750, pointerId: 5 });
    fireEvent.pointerUp(surface, { clientX: 50, clientY: 750, pointerId: 5 });

    expect(onAnnotationsChange).toHaveBeenLastCalledWith([], []);
  });

  it("cancella una freccia con la gomma senza rimuovere le evidenziazioni", () => {
    const onAnnotationsChange = vi.fn<
      (arrows: BoardArrow[], highlights: BoardHighlight[]) => void
    >();
    const highlight: BoardHighlight = ["a1", "rgb(250,204,21)"];
    const view = renderBoard("study", {
      arrows: [["e2", "e4", "rgb(239,68,68)"]],
      highlights: [highlight],
      onAnnotationsChange,
    });

    fireEvent.click(view.getByRole("button", { name: "Gomma" }));
    const surface = view.getByTestId("touch-annotation-surface");
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 800,
      width: 800,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(surface, { clientX: 450, clientY: 650, pointerId: 6 });
    fireEvent.pointerUp(surface, { clientX: 450, clientY: 450, pointerId: 6 });

    expect(onAnnotationsChange).toHaveBeenLastCalledWith([], [highlight]);
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

  it("rende gli highlight temporanei soltanto nel layer automatico", () => {
    renderBoard("analysis", {
      overlayHighlights: [
        ["d5", "#0284c7"],
        ["c7", "#0284c7"],
      ],
    });
    const config = lastConfig();

    expect(config.drawable?.shapes).toEqual([]);
    expect(config.drawable?.autoShapes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ orig: "d5" }),
        expect.objectContaining({ orig: "c7" }),
      ]),
    );
  });
});

describe("ChessBoardView toolbar contestuale", () => {
  it("mantiene uno slot stabile anche quando monta lo stato alternativo", () => {
    const emptyView = renderBoard("analysis");

    expect(
      emptyView.getByTestId("board-toolbar-status").textContent,
    ).toBe("");
    emptyView.unmount();

    const activeView = renderBoard("analysis", {
      toolbarStatus: <span>Se avessi giocato Cc7+</span>,
    });

    expect(
      activeView.getByTestId("board-toolbar-status").textContent,
    ).toBe("Se avessi giocato Cc7+");
  });
});

describe("ChessBoardView esportazione Studio", () => {
  it("mostra le due azioni in Studio e invoca gli handler", () => {
    const onExportPgn = vi.fn();
    const onExportImage = vi.fn();
    const view = renderBoard("study", { onExportPgn, onExportImage });

    openToolsMenu(view);
    fireEvent.click(screen.getByRole("menuitem", { name: "Esporta PGN" }));
    openToolsMenu(view);
    fireEvent.click(screen.getByRole("menuitem", { name: "Esporta immagine" }));

    expect(onExportPgn).toHaveBeenCalledTimes(1);
    expect(onExportImage).toHaveBeenCalledTimes(1);
  });

  it("non espone le azioni in Analisi", () => {
    const view = renderBoard("analysis", {
      onExportPgn: vi.fn(),
      onExportImage: vi.fn(),
    });

    openToolsMenu(view);

    expect(screen.queryByRole("menuitem", { name: "Esporta PGN" })).toBeNull();
    expect(
      screen.queryByRole("menuitem", { name: "Esporta immagine" }),
    ).toBeNull();
  });
});

describe("ChessBoardView analisi Stockfish", () => {
  it.each([
    [0, "Analisi in corso…"],
    [96, "Analisi in corso…"],
    [97, "Finalizzazione analisi…"],
  ])("segnala il lavoro in corso a %i/97 posizioni", (done, message) => {
    const view = renderBoard("analysis", {
      analyzing: true,
      analysisProgress: { done, total: 97 },
    });

    expect(view.getByText(`${done}/97`)).toBeTruthy();
    const status = view.getByRole("status");
    expect(status.textContent).toBe(message);
    expect(status.querySelector("svg")).not.toBeNull();
  });

  it("nasconde il loader quando l'analisi termina o viene annullata", () => {
    const view = renderBoard("analysis", {
      analyzing: false,
      analysisProgress: { done: 97, total: 97 },
    });

    expect(view.queryByRole("status")).toBeNull();
    expect(view.queryByText("97/97")).toBeNull();
  });

  it("non espone l'analisi nelle scacchiere di Studio", () => {
    const view = renderBoard("study", { onAnalyze: vi.fn() });

    openToolsMenu(view);

    expect(screen.queryByRole("menuitem", { name: "Analizza" })).toBeNull();
  });

  it("espone e avvia l'analisi soltanto in modalita Analisi", () => {
    const onAnalyze = vi.fn();
    const view = renderBoard("analysis", { onAnalyze });

    openToolsMenu(view);
    fireEvent.click(screen.getByRole("menuitem", { name: "Analizza" }));

    expect(onAnalyze).toHaveBeenCalledOnce();
  });
});

describe("ChessBoardView player labels", () => {
  it("mostra il giocatore superiore dopo la toolbar e prima della scacchiera", () => {
    const view = renderBoard("analysis", {
      top: <span data-testid="top-player">Nero</span>,
    });

    const toolbarButton = view.getByRole("button", { name: "Altri strumenti" });
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

    openToolsMenu(view);
    fireEvent.click(screen.getByRole("menuitem", { name: "Converti in studio" }));

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

    openToolsMenu(view);
    fireEvent.click(screen.getByRole("menuitem", { name: "Converti in studio" }));
    fireEvent.click(view.getByRole("button", { name: "Converti" }));

    expect(onConvertToStudy).toHaveBeenCalledTimes(1);
  });
});
