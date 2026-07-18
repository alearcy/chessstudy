import { DEFAULT_POSITION } from "chess.js";
import { describe, expect, it, vi } from "vitest";

import {
  buildStudyPgn,
  createStudyBoardPng,
  studyExportFilename,
} from "@/services/studyExportService";
import type { Move } from "@/types";

function move(
  order: number,
  moveNotation: string,
  fen: string,
  comment = "",
): Move {
  return {
    boardId: 1,
    parentId: null,
    order,
    moveNotation,
    fen,
    comment,
    arrows: [],
    highlights: [],
    createdAt: new Date("2026-07-18T00:00:00Z"),
  };
}

describe("buildStudyPgn", () => {
  it("serializza la linea persistita con intestazioni e commenti utente", () => {
    const pgn = buildStudyPgn({
      initialFen: DEFAULT_POSITION,
      lessonTitle: "Finali essenziali",
      boardTitle: "Opposizione",
      headers: { White: "Bianco", Black: "Nero", Result: "*" },
      moves: [
        move(
          0,
          "e4",
          "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
          "Occupa il centro",
        ),
        move(
          1,
          "e5",
          "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        ),
      ],
    });

    expect(pgn).toContain('[Event "Finali essenziali"]');
    expect(pgn).toContain('[Board "Opposizione"]');
    expect(pgn).toContain('[White "Bianco"]');
    expect(pgn).toContain("1. e4 {Occupa il centro} e5 *");
  });

  it("mantiene FEN e SetUp per una posizione iniziale personalizzata", () => {
    const initialFen = "8/8/8/8/8/8/4K3/6k1 w - - 0 1";

    const pgn = buildStudyPgn({
      initialFen,
      lessonTitle: "Studio",
      boardTitle: "Finale",
      moves: [],
    });

    expect(pgn).toContain('[SetUp "1"]');
    expect(pgn).toContain(`[FEN "${initialFen}"]`);
  });
});

describe("studyExportFilename", () => {
  it("normalizza i titoli e include studio e scacchiera", () => {
    expect(
      studyExportFilename("Finali: Re & Pedoni", "Scacchiera #1", "pgn"),
    ).toBe("finali-re-pedoni-scacchiera-1.pgn");
  });
});

describe("createStudyBoardPng", () => {
  it("disegna posizione, frecce ed evidenziazioni rispettando l'orientamento", async () => {
    const context = {
      beginPath: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      lineTo: vi.fn(),
      moveTo: vi.fn(),
      stroke: vi.fn(),
      strokeText: vi.fn(),
      arc: vi.fn(),
      set fillStyle(_value: string) {},
      set font(_value: string) {},
      set lineCap(_value: CanvasLineCap) {},
      set lineJoin(_value: CanvasLineJoin) {},
      set lineWidth(_value: number) {},
      set strokeStyle(_value: string) {},
      set textAlign(_value: CanvasTextAlign) {},
      set textBaseline(_value: CanvasTextBaseline) {},
    } as unknown as CanvasRenderingContext2D;
    const blob = new Blob(["png"], { type: "image/png" });
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn((callback: BlobCallback) => callback(blob)),
    } as unknown as HTMLCanvasElement;

    const result = await createStudyBoardPng(
      {
        fen: DEFAULT_POSITION,
        arrows: [["a1", "a8", "rgb(239,68,68)"]],
        highlights: [["h8", "rgb(34,197,94)"]],
        orientation: "black",
        size: 800,
      },
      () => canvas,
    );

    expect(result).toBe(blob);
    expect(canvas.width).toBe(800);
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 100, 100);
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 800, 800);
    expect(context.moveTo).toHaveBeenCalledWith(750, 50);
    expect(context.lineTo).toHaveBeenCalledWith(750, 750);
    expect(context.fillText).toHaveBeenCalledWith("♖", 50, 50);
  });
});
