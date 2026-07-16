import { cleanup, fireEvent, render } from "@testing-library/react";
import { Chess } from "chess.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import GameEvaluationChart from "@/components/analysis/GameEvaluationChart";
import type {
  EvaluatedMove,
  EvaluationPosition,
} from "@/services/moveAnnotationService";

afterEach(cleanup);

function chartGame(): {
  start: EvaluationPosition;
  moves: EvaluatedMove[];
} {
  const game = new Chess();
  const startFen = game.fen();
  const whiteMove = game.move("e4");
  const afterWhite = game.fen();
  const blackMove = game.move("e5");
  const afterBlack = game.fen();

  return {
    start: {
      fen: startFen,
      evalCp: 0,
      evalMate: null,
      evalBestMoveUci: "e2e4",
    },
    moves: [
      {
        moveNotation: whiteMove.san,
        fen: afterWhite,
        evalCp: 20,
        evalMate: null,
        evalBestMoveUci: "e7e6",
      },
      {
        moveNotation: blackMove.san,
        fen: afterBlack,
        evalCp: 400,
        evalMate: null,
        evalBestMoveUci: null,
      },
    ],
  };
}

describe("GameEvaluationChart", () => {
  it("disegna la linea neutra e mostra soltanto migliore ed errore grave", () => {
    const { start, moves } = chartGame();
    const view = render(
      <GameEvaluationChart
        start={start}
        moves={moves}
        currentMoveIndex={1}
        onGoToMove={vi.fn()}
      />,
    );

    expect(view.getByTestId("evaluation-chart").className).toContain("text-white");
    expect(view.getAllByTestId("evaluation-point")).toHaveLength(3);
    expect(view.getAllByTestId("evaluation-line")).toHaveLength(1);
    expect(view.getByTitle("Migliore")).toBeTruthy();
    expect(view.getByText("??")).toBeTruthy();
    expect(view.queryByText("!")).toBeNull();
  });

  it("sincronizza il cursore e naviga mentre il range viene spostato", () => {
    const { start, moves } = chartGame();
    const onGoToMove = vi.fn();
    const view = render(
      <GameEvaluationChart
        start={start}
        moves={moves}
        currentMoveIndex={1}
        onGoToMove={onGoToMove}
      />,
    );

    expect(view.getByTestId("evaluation-cursor").getAttribute("data-index")).toBe("1");

    fireEvent.change(view.getByRole("slider", { name: "Naviga andamento partita" }), {
      target: { value: "2" },
    });

    expect(onGoToMove).toHaveBeenCalledWith(2);
  });

  it("non collega punti separati da una valutazione mancante", () => {
    const { start, moves } = chartGame();
    moves[0].evalCp = null;
    const view = render(
      <GameEvaluationChart
        start={start}
        moves={moves}
        currentMoveIndex={0}
        onGoToMove={vi.fn()}
      />,
    );

    expect(view.getAllByTestId("evaluation-point")).toHaveLength(2);
    expect(view.queryAllByTestId("evaluation-line")).toHaveLength(0);
  });
});
