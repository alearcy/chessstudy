import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ChessBoardView from "./ChessBoard";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("mantiene i pezzi entro la scacchiera invertendo rapidamente la navigazione", () => {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  const now = vi.spyOn(performance, "now").mockReturnValue(0);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 800,
    width: 800, height: 800, toJSON: () => ({}),
  });
  const props = {
    arrows: [], highlights: [], onAnnotationsChange: vi.fn(),
    canUndo: true, canRedo: true, onMove: () => true,
    onUndo: vi.fn(), onRedo: vi.fn(), onReset: vi.fn(),
    lessonMode: "analysis" as const,
  };
  const view = render(<ChessBoardView {...props} fen="8/8/8/8/8/8/8/R7 w - - 0 1" />);
  const flush = (time: number) => frames.splice(0).forEach((callback) => callback(time));
  flush(0);

  now.mockReturnValue(100);
  view.rerender(<ChessBoardView {...props} fen="8/8/8/8/8/8/8/7R w - - 0 1" />);
  now.mockReturnValue(110);
  view.rerender(<ChessBoardView {...props} fen="8/8/8/8/8/8/8/R7 w - - 0 1" />);
  now.mockReturnValue(120);
  view.rerender(<ChessBoardView {...props} fen="8/8/8/8/8/8/8/7R w - - 0 1" />);
  now.mockReturnValue(130);
  view.rerender(<ChessBoardView {...props} fen="8/8/8/8/8/8/8/R7 w - - 0 1" />);

  // A queued frame can carry a timestamp older than the latest position update.
  flush(100);
  const rook = view.container.querySelector<HTMLElement>("cg-board piece.rook")!;
  const [x, y] = rook.style.transform.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  expect(x).toBeGreaterThanOrEqual(0);
  expect(x).toBeLessThanOrEqual(700);
  expect(y).toBeGreaterThanOrEqual(0);
  expect(y).toBeLessThanOrEqual(700);
  expect(x).toBe(0);

  // Once queued frames have drained, ordinary navigation is animated again.
  now.mockReturnValue(400);
  view.rerender(<ChessBoardView {...props} fen="8/8/8/8/8/8/8/7R w - - 0 1" />);
  expect(rook.style.transform).toBe("translate(0px,700px)");
  now.mockReturnValue(600);
  flush(600);
  expect(rook.style.transform).toBe("translate(700px,700px)");
});
