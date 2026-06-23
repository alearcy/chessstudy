import { useState, useCallback, useMemo, useRef } from "react";
import { Chessboard } from "react-chessboard";
import type { Square, CustomSquareProps } from "react-chessboard/dist/chessboard/types";
import type { Arrow } from "react-chessboard/dist/chessboard/types";
import { Button } from "@/components/ui/button";
import { Hand, MousePointer2, Highlighter, Undo2, Redo2, RotateCcw, X, Brain, Sparkles, Loader2, GraduationCap } from "lucide-react";
import type { BoardArrow } from "@/types";

type BoardMode = "move" | "arrow" | "highlight";

interface ChessBoardViewProps {
  fen: string;
  boardWidth?: number;
  arrows: BoardArrow[];
  highlights: string[];
  /** Frecce read-only aggiuntive (es. miglior mossa Stockfish), non persistite. */
  extraArrows?: BoardArrow[];
  onArrowsChange: (arrows: BoardArrow[]) => void;
  onHighlightsChange: (highlights: string[]) => void;
  onClearArrows: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onMove: (from: Square, to: Square) => boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  /** Analisi Stockfish: handler + stato. */
  onAnalyze?: () => void;
  analyzing?: boolean;
  analysisProgress?: { done: number; total: number } | null;
  canAnalyze?: boolean;
  onCancelAnalysis?: () => void;
  /** Se true, l'analisi è in corso automaticamente (non mostra il bottone). */
  autoAnalysis?: boolean;
  /** Modalità lezione (per decidere quali controlli mostrare). */
  lessonMode?: "study" | "analysis";
  /** Toggle AI (LLM) — solo in modalità analysis. */
  aiEnabled?: boolean;
  onAiToggle?: () => void;
  aiLoading?: boolean;
  llmAvailable?: boolean;
  isTauri?: boolean;
  /** Casa di destinazione dell'ultima mossa, per badge di classificazione. */
  lastMoveSquare?: Square | null;
  /** Badge di classificazione (??, ?, ?!) da mostrare sul pezzo mosso. */
  moveBadge?: { label: string; color: string } | null;
  /** Converte la scacchiera di analisi in una nuova lezione di studio. */
  onConvertToStudy?: () => void;
  converting?: boolean;
}

const HIGHLIGHT_COLOR = "rgba(34, 197, 94, 0.45)";

const DEFAULT_BOARD_WIDTH = 560;

export default function ChessBoardView({
  fen,
  boardWidth = DEFAULT_BOARD_WIDTH,
  arrows,
  highlights,
  extraArrows = [],
  lastMoveSquare = null,
  moveBadge = null,
  onArrowsChange,
  onHighlightsChange,
  onClearArrows,
  canUndo,
  canRedo,
  onMove,
  onUndo,
  onRedo,
  onReset,
  onAnalyze,
  analyzing = false,
  analysisProgress = null,
  canAnalyze = false,
  onCancelAnalysis,
  autoAnalysis: _autoAnalysis = false, // prop mantenuto per compatibilità
  lessonMode,
  aiEnabled = false,
  onAiToggle,
  aiLoading = false,
  llmAvailable = false,
  isTauri = false,
  onConvertToStudy,
  converting = false,
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
  // Le extraArrows (analisi) sono merged solo per il display (read-only).
  const controlledArrows = [...arrows, ...extraArrows] as Arrow[];

  // Custom square: aggiunge badge di classificazione sul pezzo mosso.
  // Usiamo un ref per mantenere l'identity del componente stabile (evita
  // unmount/remount di tutte le case a ogni cambio di posizione).
  const badgeDataRef = useRef({ square: lastMoveSquare, badge: moveBadge });
  badgeDataRef.current = { square: lastMoveSquare, badge: moveBadge };

  const CustomSquare = useCallback(
    ({ children, ref, square, squareColor: _squareColor, style }: CustomSquareProps) => {
      const { square: badgeSquare, badge } = badgeDataRef.current;
      const showBadge = square === badgeSquare && badge;
      return (
        <div ref={ref} style={{ ...style, position: "relative" }}>
          {children}
          {showBadge && (
            <span
              className="absolute bottom-0 right-0 text-[14px] font-bold px-1.5 rounded leading-none mb-0.5 mr-0.5"
              style={{
                backgroundColor: badge!.color,
                color: "white",
                textShadow: "0 0 3px rgba(0,0,0,0.6)",
                zIndex: 10,
              }}
            >
              {badge!.label}
            </span>
          )}
        </div>
      );
    },
    []
  );

  const handleArrowsChange = useCallback(
    (next: Arrow[]) => {
      onArrowsChange(next as BoardArrow[]);
    },
    [onArrowsChange]
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-1 flex-wrap justify-center">
        {lessonMode !== "analysis" && (
          <>
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
          </>
        )}

        {lessonMode !== "analysis" && (
          <Button
            variant={analyzing ? "default" : "ghost"}
            size="icon-xs"
            disabled={!onAnalyze || (!analyzing && !canAnalyze)}
            onClick={analyzing ? onCancelAnalysis : onAnalyze}
            title={
              analyzing
                ? "Annulla analisi"
                : canAnalyze
                  ? "Analizza partita con Stockfish 18"
                  : "Nessuna posizione da analizzare"
            }
          >
            <Brain className="size-4" />
          </Button>
        )}

        {lessonMode === "analysis" && (
          <>
            <div className="w-px h-6 bg-border mx-1" />
            <Button
              variant={aiEnabled ? "default" : "ghost"}
              size="icon-xs"
              disabled={aiLoading || analyzing}
              onClick={onAiToggle}
              title={
                analyzing
                  ? "Analisi Stockfish in corso..."
                  : aiLoading
                    ? "L'AI sta generando commenti..."
                    : aiEnabled
                      ? "Disattiva commenti AI"
                      : llmAvailable && isTauri
                        ? "Attiva commenti AI (LLM nativo)"
                        : "Attiva commenti AI (analisi rule-based)"
              }
            >
              {aiLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={!onConvertToStudy || converting}
              onClick={onConvertToStudy}
              title="Converti questa analisi in una lezione di studio"
            >
              {converting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <GraduationCap className="size-4" />
              )}
            </Button>
          </>
        )}

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

      {analyzing && analysisProgress && (
        <div className="w-full max-w-[480px] flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${
                  analysisProgress.total
                    ? (analysisProgress.done / analysisProgress.total) * 100
                    : 0
                }%`,
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {analysisProgress.done}/{analysisProgress.total}
          </span>
        </div>
      )}

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
          customSquare={CustomSquare}
          onArrowsChange={handleArrowsChange}
          customSquareStyles={customSquareStyles}
          onPieceDrop={onPieceDrop}
          onSquareClick={onSquareClick}
          animationDuration={200}
          autoPromoteToQueen
        />
      </div>

      {lessonMode !== "analysis" && mode === "arrow" && (
        <p className="text-xs text-muted-foreground">
          Tasto destro + trascina per disegnare una freccia
        </p>
      )}
      {lessonMode !== "analysis" && mode === "highlight" && (
        <p className="text-xs text-muted-foreground">
          Clicca su una casa per evidenziarla o rimuovere l&apos;evidenziazione
        </p>
      )}
    </div>
  );
}
