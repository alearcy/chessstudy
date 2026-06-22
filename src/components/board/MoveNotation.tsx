import { useState, useRef, useEffect, ReactNode } from "react";
import { Eye, EyeOff, MessageSquare } from "lucide-react";
import type { Move } from "@/types";
import { formatEval, evalScore, moveClassification } from "@/services/analysisService";

interface MoveNotationProps {
  moves: Move[];
  currentMoveIndex: number;
  onGoToMove: (index: number) => void;
  /** Eval della posizione di partenza (Board), per classificare la prima mossa. */
  startEvalCp?: number | null;
  startEvalMate?: number | null;
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
  // If not using icons, return plain text
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
  
  // Handle promotions like e8=Q
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
}: MoveNotationProps) {
  const [useIcons, setUseIcons] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the current move
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

  const pairs: { moveNumber: number; white: { san: ReactNode; index: number; hasComment: boolean; evalCp: number | null; evalMate: number | null; cpLoss: number | null } | null; black: { san: ReactNode; index: number; hasComment: boolean; evalCp: number | null; evalMate: number | null; cpLoss: number | null } | null }[] = [];

  // eval prima della mossa i (POV Bianco): posizione di partenza per i=0,
  // altrimenti eval della posizione dopo la mossa i-1.
  const beforeScoreWhite = (i: number): number => {
    if (i === 0) return evalScore(startEvalCp, startEvalMate);
    return evalScore(moves[i - 1].evalCp ?? null, moves[i - 1].evalMate ?? null);
  };

  for (let i = 0; i < moves.length; i += 2) {
    const moveNumber = Math.floor(i / 2) + 1;
    // Mossa i (bianco): side = bianco. cpLoss = scoreBefore(POVbianco) - scoreAfter(POVbianco).
    const whiteBefore = beforeScoreWhite(i);
    const whiteAfter = evalScore(moves[i].evalCp ?? null, moves[i].evalMate ?? null);
    const whiteLoss = whiteBefore - whiteAfter;
    const white = {
      san: formatSan(moves[i].moveNotation, true, useIcons),
      index: i + 1,
      hasComment: !!moves[i].comment?.trim(),
      evalCp: moves[i].evalCp ?? null,
      evalMate: moves[i].evalMate ?? null,
      cpLoss:
        (moves[i].evalCp != null || moves[i].evalMate != null) &&
        (startEvalCp != null || startEvalMate != null || i > 0)
          ? whiteLoss
          : null,
    };
    // Mossa i+1 (nero): side = nero. Converte eval al POV del nero (nega).
    let black = null;
    if (i + 1 < moves.length) {
      const blackBefore = -beforeScoreWhite(i + 1); // POV nero
      const blackAfter = -evalScore(
        moves[i + 1].evalCp ?? null,
        moves[i + 1].evalMate ?? null
      );
      const blackLoss = blackBefore - blackAfter;
      black = {
        san: formatSan(moves[i + 1].moveNotation, false, useIcons),
        index: i + 2,
        hasComment: !!moves[i + 1].comment?.trim(),
        evalCp: moves[i + 1].evalCp ?? null,
        evalMate: moves[i + 1].evalMate ?? null,
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
    <div className="border rounded-lg bg-card">
      <div className="px-3 py-2 border-b bg-muted/50 flex items-center justify-between">
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
      <div ref={scrollRef} className="max-h-[520px] overflow-y-auto p-2">
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
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      }`}
                    >
                      <span className="flex-1 truncate">{white.san}</span>
                      <EvalBadge
                        cp={white.evalCp}
                        mate={white.evalMate}
                        cpLoss={white.cpLoss}
                        active={currentMoveIndex === white.index}
                      />
                      {white.hasComment && (
                        <MessageSquare className="size-3 shrink-0 opacity-70" />
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
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      }`}
                    >
                      <span className="flex-1 truncate">{black.san}</span>
                      <EvalBadge
                        cp={black.evalCp}
                        mate={black.evalMate}
                        cpLoss={black.cpLoss}
                        active={currentMoveIndex === black.index}
                      />
                      {black.hasComment && (
                        <MessageSquare className="size-3 shrink-0 opacity-70" />
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

/** Badge eval: valore numerico + eventuale sigla classificazione (?? / ? / ?!). */
function EvalBadge({
  cp,
  mate,
  cpLoss,
  active,
}: {
  cp: number | null;
  mate: number | null;
  cpLoss: number | null;
  active: boolean;
}) {
  const hasEval = cp != null || mate != null;
  if (!hasEval) return null;
  const cls = moveClassification(cpLoss);
  return (
    <span className="flex items-center gap-0.5 shrink-0 text-[12px] tabular-nums font-bold">
      <span
        className={`px-1.5 rounded ${
          active ? "bg-primary-foreground/20" : "bg-muted"
        }`}
        title={cls ? `Valutazione: ${cls.label}` : undefined}
      >
        {formatEval(cp, mate)}
      </span>
      {cls && (
        <span
          className={`px-1 rounded ${
            active ? "text-primary-foreground" : "text-white"
          }`}
          style={{
            backgroundColor: active ? "transparent" : cls.color,
            color: active ? "inherit" : "white",
          }}
          title={
            cls.label === "??"
              ? "Pessata"
              : cls.label === "?"
                ? "Errore"
                : "Imprecisione"
          }
        >
          {cls.label}
        </span>
      )}
    </span>
  );
}
