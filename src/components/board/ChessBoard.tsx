import { useState, useCallback, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import type { Square } from "react-chessboard/dist/chessboard/types";
import { useChessBoard } from "@/hooks/useChessBoard";
import { Button } from "@/components/ui/button";
import { Hand, MousePointer2, Highlighter, Undo2, Redo2, RotateCcw } from "lucide-react";

type BoardMode = "move" | "arrow" | "highlight";

interface ChessBoardViewProps {
  fen?: string;
  boardWidth?: number;
  onPositionChange?: (fen: string) => void;
}

const HIGHLIGHT_COLOR = "rgba(34, 197, 94, 0.45)";

const DEFAULT_BOARD_WIDTH = 560;

export default function ChessBoardView({
  fen: initialFen,
  boardWidth = DEFAULT_BOARD_WIDTH,
  onPositionChange,
}: ChessBoardViewProps) {
  const {
    fen,
    canUndo,
    canRedo,
    makeMove,
    undo,
    redo,
    reset,
  } = useChessBoard(initialFen);

  const [mode, setMode] = useState<BoardMode>("move");
  const [highlights, setHighlights] = useState<Square[]>([]);

  const onPieceDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square) => {
      if (mode !== "move") return false;
      const newFen = makeMove(sourceSquare, targetSquare);
      if (newFen && onPositionChange) onPositionChange(newFen);
      return !!newFen;
    },
    [mode, makeMove, onPositionChange]
  );

  const onSquareClick = useCallback(
    (square: Square) => {
      if (mode !== "highlight") return;
      setHighlights((prev) =>
        prev.includes(square)
          ? prev.filter((s) => s !== square)
          : [...prev, square]
      );
    },
    [mode]
  );

  const customSquareStyles = useMemo(
    () =>
      Object.fromEntries(
        highlights.map((square) => [square, { backgroundColor: HIGHLIGHT_COLOR }])
      ),
    [highlights]
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-1 flex-wrap justify-center">
        <Button
          variant={mode === "move" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("move")}
          title="Modalità spostamento pezzi"
        >
          <Hand className="size-4" />
          <span className="hidden sm:inline ml-1">Muovi</span>
        </Button>
        <Button
          variant={mode === "arrow" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("arrow")}
          title="Modalità disegno frecce (tasto destro)"
        >
          <MousePointer2 className="size-4" />
          <span className="hidden sm:inline ml-1">Frecce</span>
        </Button>
        <Button
          variant={mode === "highlight" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("highlight")}
          title="Modalità evidenziazione case (click sinistro)"
        >
          <Highlighter className="size-4" />
          <span className="hidden sm:inline ml-1">Evidenzia</span>
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          variant="ghost"
          size="icon-xs"
          disabled={!canUndo}
          onClick={undo}
          title="Annulla mossa"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={!canRedo}
          onClick={redo}
          title="Ripeti mossa"
        >
          <Redo2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={reset}
          title="Ripristina posizione iniziale"
        >
          <RotateCcw className="size-4" />
        </Button>
      </div>

      <Chessboard
        id="lesson-chessboard"
        position={fen}
        boardWidth={boardWidth}
        arePiecesDraggable={mode === "move"}
        areArrowsAllowed={mode === "arrow"}
        customSquareStyles={customSquareStyles}
        onPieceDrop={onPieceDrop}
        onSquareClick={onSquareClick}
        animationDuration={200}
        autoPromoteToQueen
      />

      {mode === "arrow" && (
        <p className="text-xs text-muted-foreground">
          Tasto destro + trascina per disegnare una freccia
        </p>
      )}
      {mode === "highlight" && (
        <p className="text-xs text-muted-foreground">
          Clicca su una casa per evidenziarla o rimuovere l&apos;evidenziazione
        </p>
      )}
    </div>
  );
}
