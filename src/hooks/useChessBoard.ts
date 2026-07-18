import { useCallback, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { Square } from "chess.js";
import type { BoardArrow, BoardHighlight, Move } from "@/types";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export interface MakeMoveResult {
  san: string;
  fen: string;
  /** Indice (in `moves`) in cui è stata inserita la nuova mossa (placeholder). */
  newMoveIndex: number;
  /** id delle mosse rimosse dallo stato (troncamento linea dopo undo+nuova mossa). */
  truncatedMoveIds: number[];
}

export function useChessBoard(initialFen: string = START_FEN) {
  const game = useRef(new Chess(initialFen));
  const [fen, setFen] = useState(initialFen);
  // history[i] = FEN dopo i primi `i` mosse (history[0] = posizione di partenza).
  const [history, setHistory] = useState<string[]>([initialFen]);
  // moves[i] = mossa che produce history[i+1].
  const [moves, setMoves] = useState<Move[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  // Annotazioni della posizione di partenza (historyIndex === 0).
  const [startArrows, setStartArrows] = useState<BoardArrow[]>([]);
  const [startHighlights, setStartHighlights] = useState<BoardHighlight[]>([]);

  const syncFen = useCallback(() => {
    setFen(game.current.fen());
  }, []);

  /**
   * Carica una posizione di partenza e una sequenza di mosse persistite.
   * Usato dal componente quando cambia la board selezionata.
   */
  const loadSequence = useCallback(
    (
      startFen: string,
      loadedMoves: Move[],
      loadedStartArrows: BoardArrow[] = [],
      loadedStartHighlights: BoardHighlight[] = [],
      initialHistoryIndex = 0
    ) => {
      game.current.load(startFen);
      const fens = [startFen, ...loadedMoves.map((m) => m.fen)];
      const nextHistoryIndex = Math.min(Math.max(initialHistoryIndex, 0), fens.length - 1);
      game.current.load(fens[nextHistoryIndex]);
      setHistory(fens);
      setMoves(loadedMoves);
      setHistoryIndex(nextHistoryIndex);
      setFen(fens[nextHistoryIndex]);
      setStartArrows(loadedStartArrows);
      setStartHighlights(loadedStartHighlights);
    },
    []
  );

  /**
   * Esegue una mossa su chess.js e aggiorna lo stato in memoria con un
   * Move placeholder (id undefined). Ritorna info per la persistenza.
   * Se `historyIndex` non è in fondo, tronca il ramo futuro (UI lineare).
   */
  const makeMove = useCallback(
    (from: Square, to: Square): MakeMoveResult | null => {
      let move;
      try {
        move = game.current.move({ from, to, promotion: "q" });
      } catch {
        return null;
      }
      if (!move) return null;
      const newFen = game.current.fen();
      const truncatedMoveIds = moves
        .slice(historyIndex)
        .map((m) => m.id)
        .filter((id): id is number => id != null);
      const newMoves: Move[] = [
        ...moves.slice(0, historyIndex),
        {
          id: undefined,
          boardId: 0, // placeholder, sostituito da replaceMove
          parentId: null,
          order: historyIndex,
          moveNotation: move.san,
          fen: newFen,
          comment: "",
          arrows: [],
          highlights: [],
          createdAt: new Date(),
        },
      ];
      const newHistory = [...history.slice(0, historyIndex + 1), newFen];
      setHistory(newHistory);
      setMoves(newMoves);
      setHistoryIndex(historyIndex + 1);
      setFen(newFen);
      return {
        san: move.san,
        fen: newFen,
        newMoveIndex: historyIndex,
        truncatedMoveIds,
      };
    },
    [historyIndex, history, moves]
  );

  /** Sostituisce il Move placeholder all'indice dato con il Move persistito. */
  const replaceMove = useCallback((index: number, move: Move) => {
    setMoves((prev) => prev.map((m, i) => (i === index ? move : m)));
  }, []);

  /** Aggiorna il commento di una mossa in memoria (dopo persistenza). */
  const setMoveComment = useCallback((index: number, comment: string) => {
    setMoves((prev) =>
      prev.map((m, i) => (i === index ? { ...m, comment } : m))
    );
  }, []);

  /** Aggiorna il commento di analisi di una mossa in memoria (dopo persistenza). */
  const setMoveAnalysisComment = useCallback((index: number, analysisComment: string | null) => {
    setMoves((prev) =>
      prev.map((m, i) => (i === index ? { ...m, analysisComment } : m))
    );
  }, []);

  const setMoveStockfishComment = useCallback((index: number, stockfishComment: string | null) => {
    setMoves((prev) =>
      prev.map((m, i) => (i === index ? { ...m, stockfishComment } : m))
    );
  }, []);

  const setMoveHighlights = useCallback((index: number, highlights: BoardHighlight[]) => {
    setMoves((prev) =>
      prev.map((m, i) => (i === index ? { ...m, highlights } : m))
    );
  }, []);

  // --- Annotazioni (frecce / evidenziazioni) per la posizione corrente ---

  const currentArrows: BoardArrow[] =
    historyIndex === 0
      ? startArrows
      : (moves[historyIndex - 1]?.arrows ?? []);

  const currentHighlights: BoardHighlight[] =
    historyIndex === 0
      ? startHighlights
      : (moves[historyIndex - 1]?.highlights ?? []);

  /** Imposta le frecce della posizione corrente (in memoria). */
  const setArrows = useCallback(
    (arrows: BoardArrow[]) => {
      if (historyIndex === 0) {
        setStartArrows(arrows);
      } else {
        setMoves((prev) =>
          prev.map((m, i) =>
            i === historyIndex - 1 ? { ...m, arrows } : m
          )
        );
      }
    },
    [historyIndex]
  );

  /** Imposta le evidenziazioni della posizione corrente (in memoria). */
  const setHighlights = useCallback(
    (highlights: BoardHighlight[]) => {
      if (historyIndex === 0) {
        setStartHighlights(highlights);
      } else {
        setMoves((prev) =>
          prev.map((m, i) =>
            i === historyIndex - 1 ? { ...m, highlights } : m
          )
        );
      }
    },
    [historyIndex]
  );

  const goToMove = useCallback(
    (index: number) => {
      if (index < 0 || index >= history.length) return;
      game.current.load(history[index]);
      setHistoryIndex(index);
      syncFen();
    },
    [history, syncFen]
  );

  /**
   * Tronca la linea dalla mossa `moveIndex` (indice 0-based nell'array moves)
   * e mantiene la posizione corrente quando appartiene ancora al tratto salvo.
   */
  const truncateMovesFrom = useCallback(
    (moveIndex: number) => {
      const threshold = Math.min(Math.max(moveIndex, 0), moves.length);
      const nextMoves = moves.slice(0, threshold);
      const nextHistory = history.slice(0, threshold + 1);
      const nextHistoryIndex = Math.min(historyIndex, threshold);
      const nextFen = nextHistory[nextHistoryIndex];
      if (!nextFen) return;

      game.current.load(nextFen);
      setMoves(nextMoves);
      setHistory(nextHistory);
      setHistoryIndex(nextHistoryIndex);
      setFen(nextFen);
    },
    [history, historyIndex, moves],
  );

  const undo = useCallback(() => {
    if (historyIndex > 0) goToMove(historyIndex - 1);
  }, [historyIndex, goToMove]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) goToMove(historyIndex + 1);
  }, [historyIndex, history.length, goToMove]);

  const reset = useCallback((startFen: string = START_FEN) => {
    game.current.load(startFen);
    setHistory([startFen]);
    setMoves([]);
    setHistoryIndex(0);
    setFen(startFen);
  }, []);

  // Compatibilità: imposta solo il FEN di partenza, senza storia.
  const setPosition = useCallback(
    (newFen: string) => {
      loadSequence(newFen, []);
    },
    [loadSequence]
  );

  const currentMove = historyIndex > 0 ? moves[historyIndex - 1] ?? null : null;

  return {
    game,
    fen,
    turn: game.current.turn(),
    isGameOver: game.current.isGameOver(),
    isCheck: game.current.isCheck(),
    history,
    moves,
    historyIndex,
    currentMove,
    currentArrows,
    currentHighlights,
    startArrows,
    startHighlights,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    makeMove,
    replaceMove,
    setMoveComment,
    setMoveAnalysisComment,
    setMoveStockfishComment,
    setMoveHighlights,
    setArrows,
    setHighlights,
    undo,
    redo,
    reset,
    setPosition,
    loadSequence,
    goToMove,
    truncateMovesFrom,
  };
}
