import { useState, useCallback, useMemo, useRef } from "react";
import { Chessboard } from "react-chessboard";
import type { Arrow, SquareHandlerArgs } from "react-chessboard";
import type { ReactNode } from "react";
import type { Square } from "chess.js";
import { Button } from "@/components/ui/button";
import {
  Hand,
  MousePointer2,
  Highlighter,
  Undo2,
  Redo2,
  RotateCcw,
  X,
  Brain,
  Sparkles,
  Loader2,
  GraduationCap,
  ArrowUpDown,
} from "lucide-react";
import type { BoardArrow } from "@/types";

type BoardMode = "move" | "arrow" | "highlight";

interface ChessBoardViewProps {
  fen: string;
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
  /** Analisi partita con AI (game-level, una sola chiamata). */
  onGameAnalysis?: () => void;
  gameAnalysisLoading?: boolean;
  /** Casa di destinazione dell'ultima mossa, per badge di classificazione. */
  lastMoveSquare?: Square | null;
  /** Casa di partenza dell'ultima mossa, da evidenziare (giallo). */
  lastMoveFromSquare?: Square | null;
  /** Badge di classificazione (??, ?, ?!) da mostrare sul pezzo mosso. */
  moveBadge?: { label: string; color: string } | null;
  /** Re sotto scacco nella posizione corrente. */
  kingStatus?: { square: Square; checkmate: boolean } | null;
  /** Converte la scacchiera di analisi in una nuova lezione di studio. */
  onConvertToStudy?: () => void;
  converting?: boolean;
  /** Orientamento scacchiera: "white" = bianco sotto. */
  boardOrientation?: "white" | "black";
  /** Callback per toggle orientamento scacchiera. */
  onFlip?: () => void;
}

const HIGHLIGHT_COLOR = "rgba(34, 197, 94, 0.45)";
const LAST_MOVE_COLOR = "rgba(255, 213, 79, 0.55)";
const CHECK_COLOR = "rgba(239, 68, 68, 0.65)";
const ARROW_COLOR = "rgb(255,170,0)";

export default function ChessBoardView({
  fen,
  arrows,
  highlights,
  extraArrows = [],
  lastMoveSquare = null,
  lastMoveFromSquare = null,
  moveBadge = null,
  kingStatus = null,
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
  onGameAnalysis,
  gameAnalysisLoading = false,
  onConvertToStudy,
  converting = false,
  boardOrientation = "white",
  onFlip,
}: ChessBoardViewProps) {
  const [mode, setMode] = useState<BoardMode>("move");

  const customSquareStyles = useMemo(
    () => ({
      ...(lastMoveFromSquare
        ? { [lastMoveFromSquare]: { backgroundColor: LAST_MOVE_COLOR } }
        : {}),
      ...Object.fromEntries(
        highlights.map((square) => [
          square,
          { backgroundColor: HIGHLIGHT_COLOR },
        ]),
      ),
      ...(kingStatus
        ? { [kingStatus.square]: { backgroundColor: CHECK_COLOR } }
        : {}),
    }),
    [highlights, lastMoveFromSquare, kingStatus],
  );

  // react-chessboard v5 vuole Arrow[] ({ startSquare, endSquare, color }).
  // Il data layer usa BoardArrow ([string, string, string?]). Cast al confine.
  // Le extraArrows (analisi) sono merged solo per il display (read-only).
  const controlledArrows: Arrow[] = useMemo(
    () =>
      [...arrows, ...extraArrows].map(([from, to, color]) => ({
        startSquare: from,
        endSquare: to,
        color: color ?? ARROW_COLOR,
      })),
    [arrows, extraArrows],
  );

  // Custom square: aggiunge badge di classificazione sul pezzo mosso.
  // Usiamo un ref per mantenere l'identity del componente stabile (evita
  // unmount/remount di tutte le case a ogni cambio di posizione).
  const badgeDataRef = useRef({ square: lastMoveSquare, badge: moveBadge });
  badgeDataRef.current = { square: lastMoveSquare, badge: moveBadge };
  const kingStatusRef = useRef(kingStatus);
  kingStatusRef.current = kingStatus;
  const squareStylesRef = useRef(customSquareStyles);
  squareStylesRef.current = customSquareStyles;

  const emojiLabels = useMemo(() => new Set(["⭐", "✅", "☠️"]), []);

  const CustomSquare = useCallback(
    ({ square, children }: SquareHandlerArgs & { children?: ReactNode }) => {
      const { square: badgeSquare, badge } = badgeDataRef.current;
      const checkmateSquare = kingStatusRef.current?.checkmate
        ? kingStatusRef.current.square
        : null;
      const showBadge = square === badgeSquare && badge;
      const showCheckmateBadge = square === checkmateSquare;
      const isEmoji = badge ? emojiLabels.has(badge.label) : false;
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
            ...squareStylesRef.current[square],
          }}
        >
          {children}
          {showBadge && (
            <span
              className="absolute bottom-0 right-0 text-[14px] font-bold leading-none mb-0.5 mr-0.5"
              style={
                isEmoji
                  ? { zIndex: 10 }
                  : {
                      backgroundColor: badge!.color,
                      color: "white",
                      textShadow: "0 0 3px rgba(0,0,0,0.6)",
                      zIndex: 10,
                      padding: "0 0.375rem",
                      borderRadius: "0.25rem",
                    }
              }
            >
              {badge!.label}
            </span>
          )}
          {showCheckmateBadge && (
            <span
              className="absolute top-0 right-0 text-[16px] leading-none mt-0.5 mr-0.5"
              style={{
                zIndex: 11,
                textShadow: "0 0 3px rgba(0,0,0,0.7)",
              }}
            >
              ☠️
            </span>
          )}
        </div>
      );
    },
    [emojiLabels],
  );

  const handleArrowsChange = useCallback(
    ({ arrows: next }: { arrows: Arrow[] }) => {
      onArrowsChange(
        next.map((a) => [a.startSquare, a.endSquare, a.color] as BoardArrow),
      );
    },
    [onArrowsChange],
  );

  const handlePieceDrop = useCallback(
    ({
      sourceSquare,
      targetSquare,
    }: {
      sourceSquare: string;
      targetSquare: string | null;
    }) => {
      if (mode !== "move" || !targetSquare) return false;
      return onMove(sourceSquare as Square, targetSquare as Square);
    },
    [mode, onMove],
  );

  const handleSquareClick = useCallback(
    ({ square }: SquareHandlerArgs) => {
      if (mode !== "highlight") return;
      onHighlightsChange(
        highlights.includes(square)
          ? highlights.filter((s) => s !== square)
          : [...highlights, square],
      );
    },
    [mode, highlights, onHighlightsChange],
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
              variant="ghost"
              size="sm"
              disabled={gameAnalysisLoading || analyzing}
              onClick={onGameAnalysis}
              title={
                gameAnalysisLoading
                  ? "L'AI sta analizzando la partita..."
                  : "Analizza la partita con l'AI"
              }
            >
              {gameAnalysisLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              <span className="hidden sm:inline ml-1">Analisi partita</span>
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
          onClick={onFlip}
          title="Inverti orientamento scacchiera"
        >
          <ArrowUpDown className="size-4" />
        </Button>
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

      {/* react-chessboard v5 riempie il parent (`width:100% height:100%`):
          il layout chiamante decide la larghezza disponibile. */}
      <div className="flex w-full justify-center">
        <div className="aspect-square w-full">
          <Chessboard
            options={{
              id: "lesson-chessboard",
              position: fen,
              boardOrientation,
              allowDragging:
                lessonMode === "analysis" ? false : mode === "move",
              allowDrawingArrows: mode === "arrow",
              arrows: controlledArrows,
              squareStyles: customSquareStyles,
              squareRenderer: CustomSquare,
              onArrowsChange: handleArrowsChange,
              onPieceDrop: handlePieceDrop,
              onSquareClick: handleSquareClick,
              animationDurationInMs: 200,
            }}
          />
        </div>
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
