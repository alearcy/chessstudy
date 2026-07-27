import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Chessground } from "@lichess-org/chessground";
import type { Api } from "@lichess-org/chessground/api";
import type { Config } from "@lichess-org/chessground/config";
import type { DrawBrushes, DrawShape } from "@lichess-org/chessground/draw";
import type { Color, Key } from "@lichess-org/chessground/types";
import type { Square } from "chess.js";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Hand,
  MousePointer2,
  Highlighter,
  Eraser,
  RotateCcw,
  Brain,
  Loader2,
  GraduationCap,
  ArrowUpDown,
  CircleCheck,
  Skull,
  Star,
  WholeWord,
  FileDown,
  ImageDown,
  Menu,
} from "lucide-react";
import type { BoardArrow, BoardHighlight } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type BoardMode = "move" | "arrow" | "highlight" | "erase";

interface ChessBoardViewProps {
  fen: string;
  arrows: BoardArrow[];
  highlights: BoardHighlight[];
  /** Evidenziazioni read-only temporanee, non persistite. */
  overlayHighlights?: BoardHighlight[];
  /** Frecce read-only aggiuntive (es. miglior mossa Stockfish), non persistite. */
  extraArrows?: BoardArrow[];
  onAnnotationsChange: (
    arrows: BoardArrow[],
    highlights: BoardHighlight[],
  ) => void;
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
  analysisDepth?: number;
  canAnalyze?: boolean;
  onCancelAnalysis?: () => void;
  /** Se true, l'analisi è in corso automaticamente (non mostra il bottone). */
  autoAnalysis?: boolean;
  /** Modalità lezione (per decidere quali controlli mostrare). */
  lessonMode?: "study" | "analysis";
  /** Casa di destinazione dell'ultima mossa, per badge ed evidenziazione. */
  lastMoveSquare?: Square | null;
  /** Casa di partenza dell'ultima mossa, da evidenziare insieme all'arrivo. */
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
  /** Contenuto mostrato sotto la toolbar e sopra la scacchiera. */
  topPlayerLabel?: ReactNode;
  /** Contenuto mostrato sotto la scacchiera. */
  bottomPlayerLabel?: ReactNode;
  /** Esporta la linea della scacchiera di studio come PGN. */
  onExportPgn?: () => void;
  /** Esporta la posizione corrente annotata come PNG. */
  onExportImage?: () => void;
}

const LAST_MOVE_COLOR = "rgba(56, 189, 248, 0.45)";
const CHECK_COLOR = "rgba(239, 68, 68, 0.65)";
const RED_ANNOTATION_COLOR = "rgb(239,68,68)";
const GREEN_ANNOTATION_COLOR = "rgb(34,197,94)";
const YELLOW_ANNOTATION_COLOR = "rgb(250,204,21)";
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

function boardFen(fen: string): string {
  return fen === "start" ? fen : fen.split(" ")[0];
}

function turnColorFromFen(fen: string): Color {
  return fen.split(" ")[1] === "b" ? "black" : "white";
}

function isKey(value: string): value is Key {
  return /^[a-h][1-8]$/.test(value);
}

function squareClasses({
  lastMoveSquare,
  lastMoveFromSquare,
  kingStatus,
}: {
  lastMoveSquare: Square | null;
  lastMoveFromSquare: Square | null;
  kingStatus: { square: Square; checkmate: boolean } | null;
}): Map<Key, string> {
  const classes = new Map<Key, string>();
  if (lastMoveFromSquare) classes.set(lastMoveFromSquare, "cs-last-move");
  if (lastMoveSquare) classes.set(lastMoveSquare, "cs-last-move");
  if (kingStatus) {
    classes.set(
      kingStatus.square,
      `${classes.get(kingStatus.square) ?? ""} cs-check`.trim(),
    );
  }
  return classes;
}

function colorToBrushKey(color: string, prefix: string, index: number): string {
  return `${prefix}-${index}-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
}

function arrowsToShapes(arrows: BoardArrow[], prefix: string): DrawShape[] {
  return arrows.flatMap(([from, to, color], index) =>
    isKey(from) && isKey(to)
      ? [
          {
            orig: from,
            dest: to,
            brush: color ? colorToBrushKey(color, prefix, index) : "green",
          },
        ]
      : [],
  );
}

function highlightParts(highlight: BoardHighlight): [string, string | undefined] {
  return typeof highlight === "string"
    ? [highlight, undefined]
    : [highlight[0], highlight[1]];
}

function highlightsToShapes(
  highlights: BoardHighlight[],
  prefix = "highlight",
): DrawShape[] {
  return highlights.flatMap((highlight, index) => {
    const [square, color] = highlightParts(highlight);
    if (!isKey(square)) return [];
    return [
      {
        orig: square,
        brush: color
          ? colorToBrushKey(color, prefix, index)
          : "yellow",
      },
    ];
  });
}

function annotationBrushes(
  arrows: BoardArrow[],
  highlights: BoardHighlight[],
  extraArrows: BoardArrow[],
  overlayHighlights: BoardHighlight[],
): DrawBrushes {
  const brushes: DrawBrushes = {
    // Chessground usa green senza modificatori, red con Shift/Ctrl e blue
    // con Alt/Meta. I colori vengono rimappati sulle gesture richieste.
    green: { key: "green", color: RED_ANNOTATION_COLOR, opacity: 1, lineWidth: 10 },
    red: { key: "red", color: GREEN_ANNOTATION_COLOR, opacity: 1, lineWidth: 10 },
    blue: { key: "blue", color: YELLOW_ANNOTATION_COLOR, opacity: 1, lineWidth: 10 },
    yellow: { key: "yellow", color: YELLOW_ANNOTATION_COLOR, opacity: 1, lineWidth: 10 },
  };
  arrows.forEach(([from, to, color], index) => {
    if (!isKey(from) || !isKey(to) || !color) return;
    const key = colorToBrushKey(color, "user", index);
    brushes[key] = { key, color, opacity: 1, lineWidth: 10 };
  });
  extraArrows.forEach(([from, to, color], index) => {
    if (!isKey(from) || !isKey(to) || !color) return;
    const key = colorToBrushKey(color, "auto", index);
    brushes[key] = { key, color, opacity: 1, lineWidth: 10 };
  });
  highlights.forEach((highlight, index) => {
    const [square, color] = highlightParts(highlight);
    if (!isKey(square) || !color) return;
    const key = colorToBrushKey(color, "highlight", index);
    brushes[key] = { key, color, opacity: 1, lineWidth: 10 };
  });
  overlayHighlights.forEach((highlight, index) => {
    const [square, color] = highlightParts(highlight);
    if (!isKey(square) || !color) return;
    const key = colorToBrushKey(color, "overlay", index);
    brushes[key] = { key, color, opacity: 1, lineWidth: 10 };
  });
  return brushes;
}

function shapesToAnnotations(
  shapes: DrawShape[],
  brushes: DrawBrushes,
): [BoardArrow[], BoardHighlight[]] {
  const arrows: BoardArrow[] = [];
  const highlights: BoardHighlight[] = [];
  for (const shape of shapes) {
    const brush = shape.brush ? brushes[shape.brush] : null;
    const color = brush?.color ?? RED_ANNOTATION_COLOR;
    if (shape.dest) {
      arrows.push([shape.orig, shape.dest, color]);
    } else {
      highlights.push([shape.orig, color]);
    }
  }
  return [arrows, highlights];
}

function visibleSquares(orientation: "white" | "black"): Square[] {
  const ranks = orientation === "white" ? [...RANKS].reverse() : [...RANKS];
  const files = orientation === "white" ? FILES : [...FILES].reverse();
  return ranks.flatMap((rank) => files.map((file) => `${file}${rank}` as Square));
}

function squareAtPointer(
  clientX: number,
  clientY: number,
  bounds: DOMRect,
  orientation: "white" | "black",
): Square | null {
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  const column = Math.floor(((clientX - bounds.left) / bounds.width) * 8);
  const row = Math.floor(((clientY - bounds.top) / bounds.height) * 8);
  if (column < 0 || column > 7 || row < 0 || row > 7) return null;
  return visibleSquares(orientation)[row * 8 + column] ?? null;
}

function chessgroundConfig({
  fen,
  mode,
  lessonMode,
  boardOrientation,
  squareClassMap,
  userShapes,
  autoShapes,
  brushes,
  onMove,
  onInvalidMove,
  onShapesChange,
  coordinatesOnSquares,
}: {
  fen: string;
  mode: BoardMode;
  lessonMode?: "study" | "analysis";
  boardOrientation: "white" | "black";
  squareClassMap: Map<Key, string>;
  userShapes: DrawShape[];
  autoShapes: DrawShape[];
  brushes: DrawBrushes;
  onMove: (from: Square, to: Square) => boolean;
  onInvalidMove: () => void;
  onShapesChange: (shapes: DrawShape[]) => void;
  coordinatesOnSquares: boolean;
}): Config {
  const canEdit = lessonMode !== "analysis";
  const canMove = canEdit && mode === "move";
  return {
    fen: boardFen(fen),
    orientation: boardOrientation,
    turnColor: turnColorFromFen(fen),
    coordinates: true,
    coordinatesOnSquares,
    ranksPosition: "right",
    disableContextMenu: true,
    animation: { enabled: true, duration: 200 },
    highlight: {
      lastMove: false,
      check: false,
      custom: squareClassMap,
    },
    movable: {
      free: true,
      color: canMove ? "both" : undefined,
      showDests: false,
      events: {
        after: (orig, dest) => {
          if (!onMove(orig as Square, dest as Square)) {
            queueMicrotask(onInvalidMove);
          }
        },
      },
    },
    selectable: { enabled: canMove },
    draggable: { enabled: canMove, showGhost: true },
    drawable: {
      enabled: canEdit,
      visible: true,
      eraseOnMovablePieceClick: false,
      defaultSnapToValidMove: false,
      shapes: userShapes,
      autoShapes,
      brushes,
      onChange: onShapesChange,
    },
  };
}

export default function ChessBoardView({
  fen,
  arrows,
  highlights,
  overlayHighlights = [],
  extraArrows = [],
  lastMoveSquare = null,
  lastMoveFromSquare = null,
  moveBadge = null,
  kingStatus = null,
  onAnnotationsChange,
  onMove,
  onReset,
  onAnalyze,
  analyzing = false,
  analysisProgress = null,
  analysisDepth: _analysisDepth,
  canAnalyze = false,
  onCancelAnalysis,
  autoAnalysis: _autoAnalysis = false, // prop mantenuto per compatibilità
  lessonMode,
  onConvertToStudy,
  converting = false,
  boardOrientation = "white",
  onFlip,
  topPlayerLabel,
  bottomPlayerLabel,
  onExportPgn,
  onExportImage,
}: ChessBoardViewProps) {
  const [mode, setMode] = useState<BoardMode>("move");
  const [coordinatesOnSquares, setCoordinatesOnSquares] = useState(false);
  const [convertConfirmOpen, setConvertConfirmOpen] = useState(false);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<Api | null>(null);
  const annotationStartRef = useRef<{
    pointerId: number;
    square: Square;
  } | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const brushes = useMemo(
    () => annotationBrushes(arrows, highlights, extraArrows, overlayHighlights),
    [arrows, highlights, extraArrows, overlayHighlights],
  );
  const userShapes = useMemo(
    () => [
      ...arrowsToShapes(arrows, "user"),
      ...highlightsToShapes(highlights),
    ],
    [arrows, highlights],
  );
  const autoShapes = useMemo(
    () => [
      ...arrowsToShapes(extraArrows, "auto"),
      ...highlightsToShapes(overlayHighlights, "overlay"),
    ],
    [extraArrows, overlayHighlights],
  );
  const squareClassMap = useMemo(
    () =>
      squareClasses({
        lastMoveSquare,
        lastMoveFromSquare,
        kingStatus,
      }),
    [lastMoveSquare, lastMoveFromSquare, kingStatus],
  );
  const overlaySquares = useMemo(
    () => visibleSquares(boardOrientation),
    [boardOrientation],
  );

  const handleShapesChange = useCallback(
    (shapes: DrawShape[]) => {
      const [nextArrows, nextHighlights] = shapesToAnnotations(shapes, brushes);
      onAnnotationsChange(nextArrows, nextHighlights);
    },
    [brushes, onAnnotationsChange],
  );

  const handleAnnotationPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (mode === "move" || event.button !== 0) return;
      const square = squareAtPointer(
        event.clientX,
        event.clientY,
        event.currentTarget.getBoundingClientRect(),
        boardOrientation,
      );
      if (!square) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      annotationStartRef.current = { pointerId: event.pointerId, square };
    },
    [boardOrientation, mode],
  );

  const handleAnnotationPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const start = annotationStartRef.current;
      annotationStartRef.current = null;
      if (!start || start.pointerId !== event.pointerId || mode === "move") {
        return;
      }
      const end = squareAtPointer(
        event.clientX,
        event.clientY,
        event.currentTarget.getBoundingClientRect(),
        boardOrientation,
      );
      if (!end) return;
      event.preventDefault();

      if (mode === "erase") {
        if (start.square === end) {
          const nextHighlights = highlights.filter(
            (highlight) => highlightParts(highlight)[0] !== end,
          );
          onAnnotationsChange(arrows, nextHighlights);
          return;
        }
        const nextArrows = arrows.filter(
          ([from, to]) => from !== start.square || to !== end,
        );
        onAnnotationsChange(nextArrows, highlights);
        return;
      }

      if (mode === "arrow") {
        if (start.square === end) return;
        const alreadyDrawn = arrows.some(
          ([from, to]) => from === start.square && to === end,
        );
        const nextArrows = alreadyDrawn
          ? arrows.filter(
              ([from, to]) => from !== start.square || to !== end,
            )
          : [...arrows, [start.square, end, RED_ANNOTATION_COLOR] as BoardArrow];
        onAnnotationsChange(nextArrows, highlights);
        return;
      }

      if (start.square !== end) return;
      const alreadyHighlighted = highlights.some(
        (highlight) => highlightParts(highlight)[0] === end,
      );
      const nextHighlights = alreadyHighlighted
        ? highlights.filter(
            (highlight) => highlightParts(highlight)[0] !== end,
          )
        : [...highlights, [end, YELLOW_ANNOTATION_COLOR] as BoardHighlight];
      onAnnotationsChange(arrows, nextHighlights);
    },
    [arrows, boardOrientation, highlights, mode, onAnnotationsChange],
  );

  const config = useMemo(
    () =>
      chessgroundConfig({
        fen,
        mode,
        lessonMode,
        boardOrientation,
        squareClassMap,
        userShapes,
        autoShapes,
        brushes,
        onMove: (from, to) => onMoveRef.current(from, to),
        onInvalidMove: () => apiRef.current?.set({ fen: boardFen(fen) }),
        onShapesChange: handleShapesChange,
        coordinatesOnSquares,
      }),
    [
      fen,
      mode,
      lessonMode,
      boardOrientation,
      squareClassMap,
      userShapes,
      autoShapes,
      brushes,
      handleShapesChange,
      coordinatesOnSquares,
    ],
  );

  useEffect(() => {
    if (!boardRef.current) return;
    boardRef.current.replaceChildren();
    const api = Chessground(boardRef.current, config);
    apiRef.current = api;
    return () => {
      api.destroy();
      boardRef.current?.replaceChildren();
      apiRef.current = null;
    };
  }, [coordinatesOnSquares]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    api.set(config);
    api.setShapes(userShapes);
    api.setAutoShapes(autoShapes);
  }, [config, userShapes, autoShapes]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full max-w-full flex-nowrap items-center overflow-x-auto">
        <div className="flex shrink-0 items-center gap-1">
          {lessonMode === "study" && (
            <>
              <Button
                variant={mode === "move" ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={mode === "move"}
                onClick={() => setMode("move")}
              >
                <Hand className="size-4" />
                Muovi
              </Button>
              <Button
                variant={mode === "arrow" ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={mode === "arrow"}
                onClick={() => setMode("arrow")}
              >
                <MousePointer2 className="size-4" />
                Freccia
              </Button>
              <Button
                variant={mode === "highlight" ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={mode === "highlight"}
                onClick={() => setMode("highlight")}
              >
                <Highlighter className="size-4" />
                Evidenzia
              </Button>
              <Button
                variant={mode === "erase" ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={mode === "erase"}
                onClick={() => setMode("erase")}
              >
                <Eraser className="size-4" />
                Gomma
              </Button>
            </>
          )}
        </div>
        <div className="flex-1" />
        <div className="w-10 shrink-0 flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Altri strumenti"
                className="bg-transparent hover:bg-transparent focus-visible:ring-0 dark:hover:bg-transparent"
              >
                <Menu className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              {lessonMode === "study" && (
                <>
                  <DropdownMenuItem
                    disabled={!onExportPgn}
                    onClick={onExportPgn}
                  >
                    <FileDown className="size-4" />
                    Esporta PGN
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!onExportImage}
                    onClick={onExportImage}
                  >
                    <ImageDown className="size-4" />
                    Esporta immagine
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              {lessonMode === "analysis" && (
                <>
                  <DropdownMenuItem
                    disabled={!onAnalyze || (!analyzing && !canAnalyze)}
                    onClick={analyzing ? onCancelAnalysis : onAnalyze}
                  >
                    {analyzing ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Brain className="size-4" />
                    )}
                    {analyzing ? "Annulla analisi" : "Analizza"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!onConvertToStudy || converting}
                    onClick={() => setConvertConfirmOpen(true)}
                  >
                    {converting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <GraduationCap className="size-4" />
                    )}
                    Converti in studio
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              <DropdownMenuItem
                onClick={() => setCoordinatesOnSquares((current) => !current)}
              >
                <WholeWord className="size-4" />
                {coordinatesOnSquares
                  ? "Coordinate fuori"
                  : "Coordinate dentro"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onReset}>
                <RotateCcw className="size-4" />
                Ripristina posizione iniziale
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onFlip}>
                <ArrowUpDown className="size-4" />
                Inverti orientamento
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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

      {topPlayerLabel}

      <div className="flex w-full justify-center">
        <div
          className="cs-board-shell aspect-square w-full"
          data-coordinate-layout={coordinatesOnSquares ? "squares" : "frame"}
        >
          <div className="cs-board-surface">
            <div ref={boardRef} className="cs-chessground h-full w-full" />
            {lessonMode === "study" && mode !== "move" && (
              <div
                data-testid="touch-annotation-surface"
                className="absolute inset-0 z-20 touch-none"
                onPointerDown={handleAnnotationPointerDown}
                onPointerUp={handleAnnotationPointerUp}
                onPointerCancel={() => {
                  annotationStartRef.current = null;
                }}
                aria-hidden="true"
              />
            )}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-8 grid-rows-8">
              {overlaySquares.map((square) => {
                const showBadge = square === lastMoveSquare && moveBadge;
                const showCheckmateBadge =
                  kingStatus?.checkmate && square === kingStatus.square;
                return (
                  <div key={square} className="relative">
                    {showBadge && (
                      <span
                        className="absolute -bottom-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full text-[13px] font-bold leading-none shadow-sm"
                        style={{
                          backgroundColor: moveBadge!.color,
                          color: "white",
                          textShadow: "0 0 3px rgba(0,0,0,0.6)",
                          zIndex: 10,
                        }}
                      >
                        {moveBadge!.label === "!!" ? (
                          <Star className="size-3.5 fill-current" />
                        ) : moveBadge!.label === "!" ? (
                          <CircleCheck className="size-3.5" />
                        ) : (
                          moveBadge!.label
                        )}
                      </span>
                    )}
                    {showCheckmateBadge && (
                      <span
                        className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm"
                        style={{
                          zIndex: 11,
                        }}
                        title="Scacco matto"
                      >
                        <Skull className="size-4" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {bottomPlayerLabel}

      <Dialog
        open={convertConfirmOpen}
        onOpenChange={(open) => {
          if (!converting) setConvertConfirmOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Converti in lezione di studio</DialogTitle>
            <DialogDescription>
              Verrà creata una nuova lezione di studio copiando soltanto le
              mosse. Commenti e suggerimenti Stockfish non verranno inclusi;
              l&apos;analisi originale resterà invariata. Vuoi continuare?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={converting}
              onClick={() => setConvertConfirmOpen(false)}
            >
              Annulla
            </Button>
            <Button
              disabled={converting || !onConvertToStudy}
              onClick={() => {
                void onConvertToStudy?.();
              }}
            >
              {converting ? "Conversione..." : "Converti"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        .cs-board-shell {
          position: relative;
        }
        .cs-board-shell[data-coordinate-layout="frame"] {
          background: var(--muted);
          box-shadow: inset 0 0 0 1px var(--border);
        }
        .cs-board-surface {
          position: absolute;
          inset: 0;
        }
        .cs-board-shell[data-coordinate-layout="frame"] .cs-board-surface {
          right: 18px;
          bottom: 18px;
        }
        .cs-chessground {
          position: absolute;
          inset: 0;
        }
        .cs-chessground .cg-wrap {
          width: 100%;
          height: 100%;
        }
        .cs-board-shell[data-coordinate-layout="frame"] .cs-chessground coords {
          color: var(--foreground);
          font-family: inherit;
          font-size: 12px;
          font-weight: 600;
          line-height: 1;
          opacity: 1;
        }
        .cs-board-shell[data-coordinate-layout="frame"] .cs-chessground coords.ranks {
          top: 0;
          left: 100%;
          width: 18px;
          height: 100%;
        }
        .cs-board-shell[data-coordinate-layout="frame"] .cs-chessground coords.files {
          bottom: -18px;
          left: 0;
          width: 100%;
          height: 18px;
        }
        .cs-board-shell[data-coordinate-layout="frame"] .cs-chessground coords coord {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cs-board-shell[data-coordinate-layout="frame"] .cs-chessground coords.ranks coord {
          transform: none;
        }
        .cs-board-shell[data-coordinate-layout="frame"] .cs-chessground.orientation-white coords coord,
        .cs-board-shell[data-coordinate-layout="frame"] .cs-chessground.orientation-black coords coord {
          color: var(--foreground);
        }
        cg-board square.cs-last-move {
          background-color: ${LAST_MOVE_COLOR};
        }
        cg-board square.cs-check {
          background-color: ${CHECK_COLOR};
        }
      `}</style>
    </div>
  );
}
