import { useCallback, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { Square } from "react-chessboard/dist/chessboard/types";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function useChessBoard(initialFen: string = START_FEN) {
  const game = useRef(new Chess(initialFen));
  const [fen, setFen] = useState(initialFen);
  const [history, setHistory] = useState<string[]>([initialFen]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const syncState = useCallback(() => {
    setFen(game.current.fen());
  }, []);

  const makeMove = useCallback(
    (from: Square, to: Square): string | null => {
      try {
        const move = game.current.move({ from, to, promotion: "q" });
        if (move) {
          const newFen = game.current.fen();
          setFen(newFen);
          setHistory((prev) => {
            const trimmed = prev.slice(0, historyIndex + 1);
            return [...trimmed, newFen];
          });
          setHistoryIndex((prev) => prev + 1);
          return newFen;
        }
        return null;
      } catch {
        return null;
      }
    },
    [historyIndex]
  );

  const undo = useCallback(() => {
    game.current.undo();
    syncState();
    setHistoryIndex((prev) => Math.max(0, prev - 1));
  }, [syncState]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextFen = history[historyIndex + 1];
      game.current.load(nextFen);
      syncState();
      setHistoryIndex((prev) => prev + 1);
    }
  }, [history, historyIndex, syncState]);

  const reset = useCallback(() => {
    game.current.reset();
    syncState();
    setHistory([START_FEN]);
    setHistoryIndex(0);
  }, [syncState]);

  const setPosition = useCallback(
    (newFen: string) => {
      game.current.load(newFen);
      syncState();
      setHistory([newFen]);
      setHistoryIndex(0);
    },
    [syncState]
  );

  return {
    game,
    fen,
    turn: game.current.turn(),
    isGameOver: game.current.isGameOver(),
    isCheck: game.current.isCheck(),
    history,
    historyIndex,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    makeMove,
    undo,
    redo,
    reset,
    setPosition,
  };
}
