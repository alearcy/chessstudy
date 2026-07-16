import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";

import {
  classifyMoveAtIndex,
  type EvaluatedMove,
  type EvaluationPosition,
} from "@/services/moveAnnotationService";

function evaluatedGame(): {
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

describe("classifyMoveAtIndex", () => {
  it("identifica una mossa migliore dalla scelta UCI della posizione precedente", () => {
    const { start, moves } = evaluatedGame();

    expect(classifyMoveAtIndex(start, moves, 0)).toMatchObject({
      cpLoss: -20,
      isBestMove: true,
      badge: { label: "!!", color: "rgb(59,130,246)" },
    });
  });

  it("calcola la perdita dal punto di vista del Nero e identifica un errore grave", () => {
    const { start, moves } = evaluatedGame();

    expect(classifyMoveAtIndex(start, moves, 1)).toMatchObject({
      cpLoss: 380,
      isBestMove: false,
      badge: { label: "??", color: "rgb(220,38,38)" },
    });
  });

  it("non classifica la mossa quando manca una delle valutazioni", () => {
    const { start, moves } = evaluatedGame();
    moves[0].evalCp = null;

    expect(classifyMoveAtIndex(start, moves, 0)).toMatchObject({
      cpLoss: null,
      badge: null,
    });
  });
});
