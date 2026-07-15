import { useState, useRef, useEffect, ReactNode } from "react";
import { CircleCheck, Eye, EyeOff, MessageSquare, Star } from "lucide-react";
import { Chess } from "chess.js";
import type { Move } from "@/types";
import { evalScore, moveClassification, sanMovesMatch } from "@/services/analysisService";

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
}: MoveNotationProps) {
  const [useIcons, setUseIcons] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const isMoveBest = (moveIndex: number, fenBefore: string, bestUciBefore: string | null | undefined): boolean => {
    if (!bestUciBefore) return false;
    try {
      const chess = new Chess(fenBefore);
      const result = chess.move(bestUciBefore);
      return sanMovesMatch(moves[moveIndex].moveNotation, result.san);
    } catch {
      return false;
    }
  };

  const pairs: { moveNumber: number; white: { san: ReactNode; index: number; hasUserComment: boolean; evalCp: number | null; evalMate: number | null; cpLoss: number | null; isBestMove: boolean } | null; black: { san: ReactNode; index: number; hasUserComment: boolean; evalCp: number | null; evalMate: number | null; cpLoss: number | null; isBestMove: boolean } | null }[] = [];

  for (let i = 0; i < moves.length; i += 2) {
    const moveNumber = Math.floor(i / 2) + 1;

    // Mossa i (bianco)
    const whiteBefore = i === 0
      ? evalScore(startEvalCp, startEvalMate)
      : evalScore(moves[i - 1].evalCp ?? null, moves[i - 1].evalMate ?? null);
    const whiteAfter = evalScore(moves[i].evalCp ?? null, moves[i].evalMate ?? null);
    const whiteLoss = whiteBefore - whiteAfter;
    const white = {
      san: formatSan(moves[i].moveNotation, true, useIcons),
      index: i + 1,
      hasUserComment: Boolean(moves[i].comment?.trim()),
      evalCp: moves[i].evalCp ?? null,
      evalMate: moves[i].evalMate ?? null,
      isBestMove: i === 0
        ? isMoveBest(i, startFen ?? "", startEvalBestMoveUci)
        : isMoveBest(i, moves[i - 1].fen, moves[i - 1].evalBestMoveUci),
      cpLoss:
        (moves[i].evalCp != null || moves[i].evalMate != null) &&
        (startEvalCp != null || startEvalMate != null ||
         (i > 0 && (moves[i - 1].evalCp != null || moves[i - 1].evalMate != null)))
          ? whiteLoss
          : null,
    };

    // Mossa i+1 (nero)
    let black = null;
    if (i + 1 < moves.length) {
      const blackBefore = i === 0
        ? -evalScore(startEvalCp, startEvalMate)
        : -evalScore(moves[i].evalCp ?? null, moves[i].evalMate ?? null);
      const blackAfter = -evalScore(
        moves[i + 1].evalCp ?? null,
        moves[i + 1].evalMate ?? null
      );
      const blackLoss = blackBefore - blackAfter;
      black = {
        san: formatSan(moves[i + 1].moveNotation, false, useIcons),
        index: i + 2,
        hasUserComment: Boolean(moves[i + 1].comment?.trim()),
        evalCp: moves[i + 1].evalCp ?? null,
        evalMate: moves[i + 1].evalMate ?? null,
        isBestMove: isMoveBest(i + 1, moves[i].fen, moves[i].evalBestMoveUci),
        cpLoss:
          (moves[i + 1].evalCp != null || moves[i + 1].evalMate != null) &&
          (moves[i].evalCp != null || moves[i].evalMate != null)
            ? blackLoss
            : null,
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
                        cpLoss={white.cpLoss}
                        isBestMove={white.isBestMove}
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
                        cpLoss={black.cpLoss}
                        isBestMove={black.isBestMove}
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
    </div>
  );
}

function EvalBadge({
  cp,
  mate,
  cpLoss,
  isBestMove,
}: {
  cp: number | null;
  mate: number | null;
  cpLoss: number | null;
  isBestMove: boolean;
}) {
  const hasEval = cp != null || mate != null;
  if (!hasEval) return null;
  const cls = moveClassification(cpLoss, isBestMove);

  const badgeTitles: Record<string, string> = {
    "!!": "Migliore",
    "!": "Buona",
    "?!": "Imprecisa",
    "?": "Errore",
    "??": "Errore grave",
  };

  return (
    <span className="flex items-center gap-0.5 shrink-0 text-[12px] tabular-nums font-bold">
      {cls && (
        <MoveClassBadge
          label={cls.label}
          color={cls.color}
          title={badgeTitles[cls.label] ?? `Valutazione: ${cls.label}`}
        />
      )}
    </span>
  );
}

function MoveClassBadge({
  label,
  color,
  title,
}: {
  label: string;
  color: string;
  title: string;
}) {
  if (label === "!!") {
    return (
      <span title={title}>
        <Star className="size-3.5 text-blue-500 fill-blue-500" />
      </span>
    );
  }
  if (label === "!") {
    return (
      <span title={title}>
        <CircleCheck className="size-3.5 text-green-500" />
      </span>
    );
  }

  return (
    <span
      className="px-1 rounded text-white"
      style={{ backgroundColor: color, color: "white" }}
      title={title}
    >
      {label}
    </span>
  );
}
