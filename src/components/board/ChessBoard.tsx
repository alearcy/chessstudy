import { useState, useCallback, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import type { Square } from "react-chessboard/dist/chessboard/types";
import type { Arrow } from "react-chessboard/dist/chessboard/types";
import { Button } from "@/components/ui/button";
import { Hand, MousePointer2, Highlighter, Undo2, Redo2, RotateCcw, X } from "lucide-react";
import type { BoardArrow } from "@/types";

type BoardMode = "move" | "arrow" | "highlight";

interface ChessBoardViewProps {
  fen: string;
  boardWidth?: number;
  arrows: BoardArrow[];
  highlights: string[];
  onArrowsChange: (arrows: BoardArrow[]) => void;
  onHighlightsChange: (highlights: string[]) => void;
  onClearArrows: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onMove: (from: Square, to: Square) => boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
}

const HIGHLIGHT_COLOR = "rgba(34, 197, 94, 0.45)";

const DEFAULT_BOARD_WIDTH = 560;

export default function ChessBoardView({
  fen,
  boardWidth = DEFAULT_BOARD_WIDTH,
  arrows,
  highlights,
  onArrowsChange,
  onHighlightsChange,
  onClearArrows,
  canUndo,
  canRedo,
  onMove,
  onUndo,
  onRedo,
  onReset,
}: ChessBoardViewProps) {
  const [mode, setMode] = useState<BoardMode>("move");

  const onPieceDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square) => {
      if (mode !== "move") return false;
      return onMove(sourceSquare, targetSquare);
    },
    [mode, onMove]
  );

  const onSquareClick = useCallback(
    (square: Square) => {
      if (mode !== "highlight") return;
      onHighlightsChange(
        highlights.includes(square)
          ? highlights.filter((s) => s !== square)
          : [...highlights, square]
      );
    },
    [mode, highlights, onHighlightsChange]
  );

  const customSquareStyles = useMemo(
    () =>
      Object.fromEntries(
        highlights.map((square) => [
          square,
          { backgroundColor: HIGHLIGHT_COLOR },
        ])
      ),
    [highlights]
  );

  // react-chessboard vuole Arrow[] ([Square, Square, string?]); il data layer
  // usa BoardArrow ([string, string, string?]). Cast al confine.
  const controlledArrows = arrows as Arrow[];

  const handleArrowsChange = useCallback(
    (next: Arrow[]) => {
      onArrowsChange(next as BoardArrow[]);
    },
    [onArrowsChange]
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

        {mode === "arrow" && (
          <>
            <div className="w-px h-6 bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onClearArrows}
              disabled={arrows.length === 0}
              title="Azzera frecce della posizione corrente"
            >
              <X className="size-4" />
            </Button>
          </>
        )}

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          variant="ghost"
          size="icon-xs"
          disabled={!canUndo}
          onClick={onUndo}
          title="Annulla mossa"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={!canRedo}
          onClick={onRedo}
          title="Ripeti mossa"
        >
          <Redo2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onReset}
          title="Ripristina posizione iniziale"
        >
          <RotateCcw className="size-4" />
        </Button>
      </div>

      {/* react-chessboard v4 ha un wrapper interno `width:100%` con board a larghezza
          fissa: senza questo contenitore il board verrebbe allineato a sinistra
          rispetto al container (e quindi anche rispetto a toolbar e note). */}
      <div style={{ width: boardWidth }} className="flex justify-center">
        <Chessboard
          id="lesson-chessboard"
          position={fen}
          boardWidth={boardWidth}
          arePiecesDraggable={mode === "move"}
          areArrowsAllowed={mode === "arrow"}
          customArrows={controlledArrows}
          customArrowColor="rgb(255,170,0)"
          onArrowsChange={handleArrowsChange}
          customSquareStyles={customSquareStyles}
          onPieceDrop={onPieceDrop}
          onSquareClick={onSquareClick}
          animationDuration={200}
          autoPromoteToQueen
        />
      </div>

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
