import { useCallback, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { Square } from "react-chessboard/dist/chessboard/types";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function useChessBoard(initialFen: string = START_FEN) {
  const game = useRef(new Chess(initialFen));
  const [fen, setFen] = useState(initialFen);
  const [history, setHistory] = useState<string[]>([initialFen]);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
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
          setHistory((prev) => [
            ...prev.slice(0, historyIndex + 1),
            newFen,
          ]);
          setMoveHistory((prev) => [
            ...prev.slice(0, historyIndex),
            move.san,
          ]);
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
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      game.current.load(history[newIndex]);
      syncState();
      setHistoryIndex(newIndex);
    }
  }, [history, historyIndex, syncState]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      game.current.load(history[newIndex]);
      syncState();
      setHistoryIndex(newIndex);
    }
  }, [history, historyIndex, syncState]);

  const reset = useCallback(() => {
    game.current.load(START_FEN);
    syncState();
    setHistory([START_FEN]);
    setMoveHistory([]);
    setHistoryIndex(0);
  }, [syncState]);

  const setPosition = useCallback(
    (newFen: string) => {
      game.current.load(newFen);
      syncState();
      setHistory([newFen]);
      setMoveHistory([]);
      setHistoryIndex(0);
    },
    [syncState]
  );

  const goToMove = useCallback(
    (index: number) => {
      if (index >= 0 && index < history.length) {
        game.current.load(history[index]);
        syncState();
        setHistoryIndex(index);
      }
    },
    [history, syncState]
  );

  return {
    game,
    fen,
    turn: game.current.turn(),
    isGameOver: game.current.isGameOver(),
    isCheck: game.current.isCheck(),
    history,
    historyIndex,
    moveHistory,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    makeMove,
    undo,
    redo,
    reset,
    setPosition,
    goToMove,
  };
}
