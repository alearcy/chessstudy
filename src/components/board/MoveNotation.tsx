import {
  useState,
  useRef,
  useEffect,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, MessageSquare, Pencil, Trash2 } from "lucide-react";
import type { Move } from "@/types";
import type { MoveBadge } from "@/services/analysisService";
import MoveClassBadge from "@/components/analysis/MoveClassBadge";
import { classifyMoveAtIndex } from "@/services/moveAnnotationService";

interface MoveNotationProps {
  moves: Move[];
  currentMoveIndex: number;
  onGoToMove: (index: number) => void;
  startEvalCp?: number | null;
  startEvalMate?: number | null;
  startFen?: string;
  startEvalBestMoveUci?: string | null;
  /** Se true, il componente si estende in altezza riempiendo il contenitore
   *  (scroll interno fluido invece del cap fisso a 520px). */
  fullHeight?: boolean;
  /** Mostra l'indicatore soltanto per le note utente (`Move.comment`). */
  showUserCommentIndicators?: boolean;
  /** Azioni contestuali disponibili soltanto nella modalita Studio. */
  onCommentMove?: (index: number) => void;
  onDeleteMove?: (index: number) => void;
}

interface MoveContextMenu {
  index: number;
  x: number;
  y: number;
}

const WHITE_PIECES: Record<string, string> = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
};

const BLACK_PIECES: Record<string, string> = {
  K: "♚",
  Q: "♛",
  R: "♜",
  B: "♝",
  N: "♞",
};

function formatSan(san: string, isWhite: boolean, useIcons: boolean): ReactNode {
  if (!useIcons) return san;

  const pieces = isWhite ? WHITE_PIECES : BLACK_PIECES;
  let result: ReactNode = san;
  const firstChar = san[0];
  if (pieces[firstChar]) {
    const rest = san.slice(1);
    result = (
      <>
        <span className="text-2xl leading-none">{pieces[firstChar]}</span>
        {rest}
      </>
    );
  }

  if (san.includes("=")) {
    result = (
      <>
        {san.split("=")[0]}=
        <span className="text-2xl leading-none">
          {pieces[san.split("=")[1]] || san.split("=")[1]}
        </span>
      </>
    );
  }

  return result;
}

export default function MoveNotation({
  moves,
  currentMoveIndex,
  onGoToMove,
  startEvalCp = null,
  startEvalMate = null,
  startFen,
  startEvalBestMoveUci = null,
  fullHeight = false,
  showUserCommentIndicators = false,
  onCommentMove,
  onDeleteMove,
}: MoveNotationProps) {
  const [useIcons, setUseIcons] = useState(true);
  const [contextMenu, setContextMenu] = useState<MoveContextMenu | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [contextMenu]);

  const openContextMenu = (
    event: MouseEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (!onCommentMove && !onDeleteMove) return;
    event.preventDefault();
    setContextMenu({
      index,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 168)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 104)),
    });
  };

  useEffect(() => {
    if (scrollRef.current) {
      const activeRow = scrollRef.current.querySelector(
        `[data-move-index="${currentMoveIndex}"]`
      );
      if (activeRow) {
        activeRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [currentMoveIndex]);

  if (moves.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        Nessuna mossa ancora. Gioca una mossa sulla scacchiera.
      </div>
    );
  }

  const startPosition = {
    fen: startFen ?? "",
    evalCp: startEvalCp,
    evalMate: startEvalMate,
    evalBestMoveUci: startEvalBestMoveUci,
  };
  const pairs: { moveNumber: number; white: { san: ReactNode; index: number; hasUserComment: boolean; evalCp: number | null; evalMate: number | null; badge: MoveBadge | null } | null; black: { san: ReactNode; index: number; hasUserComment: boolean; evalCp: number | null; evalMate: number | null; badge: MoveBadge | null } | null }[] = [];

  for (let i = 0; i < moves.length; i += 2) {
    const moveNumber = Math.floor(i / 2) + 1;

    // Mossa i (bianco)
    const whiteAnnotation = classifyMoveAtIndex(startPosition, moves, i);
    const white = {
      san: formatSan(moves[i].moveNotation, true, useIcons),
      index: i + 1,
      hasUserComment: Boolean(moves[i].comment?.trim()),
      evalCp: moves[i].evalCp ?? null,
      evalMate: moves[i].evalMate ?? null,
      badge: whiteAnnotation?.badge ?? null,
    };

    // Mossa i+1 (nero)
    let black = null;
    if (i + 1 < moves.length) {
      const blackAnnotation = classifyMoveAtIndex(startPosition, moves, i + 1);
      black = {
        san: formatSan(moves[i + 1].moveNotation, false, useIcons),
        index: i + 2,
        hasUserComment: Boolean(moves[i + 1].comment?.trim()),
        evalCp: moves[i + 1].evalCp ?? null,
        evalMate: moves[i + 1].evalMate ?? null,
        badge: blackAnnotation?.badge ?? null,
      };
    }
    pairs.push({ moveNumber, white, black });
  }

  return (
    <div
      className={`border rounded-lg bg-card ${
        fullHeight ? "flex flex-1 flex-col min-h-0 self-stretch" : ""
      }`}
    >
      <div className="px-3 py-2 border-b bg-muted/50 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-semibold">Mosse</h3>
        <button
          type="button"
          onClick={() => setUseIcons(!useIcons)}
          className="text-muted-foreground hover:text-foreground p-1 rounded focus:outline-none focus:ring-1 focus:ring-ring"
          title={useIcons ? "Passa a notazione classica" : "Passa a icone pezzi"}
        >
          {useIcons ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        </button>
      </div>
      <div
        ref={scrollRef}
        className={`${
          fullHeight ? "flex-1 min-h-0" : "max-h-[520px]"
        } overflow-y-auto p-2`}
      >
        <table className="w-full text-base">
          <tbody>
            {pairs.map(({ moveNumber, white, black }) => (
              <tr key={moveNumber}>
                <td className="text-muted-foreground text-right pr-2 py-0.5 w-8 select-none">
                  {moveNumber}.
                </td>
                <td className="py-0.5">
                  {white && (
                    <button
                      type="button"
                      data-move-index={white.index}
                      onClick={() => onGoToMove(white.index)}
                      onContextMenu={(event) =>
                        openContextMenu(event, white.index)
                      }
                      className={`flex items-center gap-1 px-2 py-1 rounded font-mono text-left w-full transition-colors ${
                        currentMoveIndex === white.index
                          ? "bg-primary/15 text-foreground"
                          : "hover:bg-accent"
                      }`}
                    >
                      <span className="flex-1 truncate">{white.san}</span>
                      <EvalBadge
                        cp={white.evalCp}
                        mate={white.evalMate}
                        badge={white.badge}
                      />
                      {showUserCommentIndicators && white.hasUserComment && (
                        <span role="img" aria-label="Nota utente presente">
                          <MessageSquare className="size-3 shrink-0 opacity-70" aria-hidden="true" />
                        </span>
                      )}
                    </button>
                  )}
                </td>
                <td className="py-0.5">
                  {black && (
                    <button
                      type="button"
                      data-move-index={black.index}
                      onClick={() => onGoToMove(black.index)}
                      onContextMenu={(event) =>
                        openContextMenu(event, black.index)
                      }
                      className={`flex items-center gap-1 px-2 py-1 rounded font-mono text-left w-full transition-colors ${
                        currentMoveIndex === black.index
                          ? "bg-primary/15 text-foreground"
                          : "hover:bg-accent"
                      }`}
                    >
                      <span className="flex-1 truncate">{black.san}</span>
                      <EvalBadge
                        cp={black.evalCp}
                        mate={black.evalMate}
                        badge={black.badge}
                      />
                      {showUserCommentIndicators && black.hasUserComment && (
                        <span role="img" aria-label="Nota utente presente">
                          <MessageSquare className="size-3 shrink-0 opacity-70" aria-hidden="true" />
                        </span>
                      )}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {contextMenu && createPortal(
        <>
          <button
            type="button"
            aria-label="Chiudi menu mossa"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setContextMenu(null)}
          />
          <div
            role="menu"
            aria-label={`Azioni mossa ${contextMenu.index}`}
            className="fixed z-50 min-w-40 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {onCommentMove && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                onClick={() => {
                  onCommentMove(contextMenu.index);
                  setContextMenu(null);
                }}
              >
                <Pencil className="size-4" aria-hidden="true" />
                Commenta
              </button>
            )}
            {onDeleteMove && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:outline-none"
                onClick={() => {
                  onDeleteMove(contextMenu.index);
                  setContextMenu(null);
                }}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Elimina
              </button>
            )}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

function EvalBadge({
  cp,
  mate,
  badge,
}: {
  cp: number | null;
  mate: number | null;
  badge: MoveBadge | null;
}) {
  const hasEval = cp != null || mate != null;
  if (!hasEval) return null;

  return (
    <span className="flex items-center gap-0.5 shrink-0 text-[12px] tabular-nums font-bold">
      {badge && (
        <MoveClassBadge
          label={badge.label}
          color={badge.color}
        />
      )}
    </span>
  );
}
