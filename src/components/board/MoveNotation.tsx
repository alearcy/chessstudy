import { useState, useRef, useEffect, ReactNode } from "react";
import { Eye, EyeOff, MessageSquare } from "lucide-react";
import type { Move } from "@/types";

interface MoveNotationProps {
  moves: Move[];
  currentMoveIndex: number;
  onGoToMove: (index: number) => void;
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

  const pairs: { moveNumber: number; white: { san: ReactNode; index: number; hasComment: boolean } | null; black: { san: ReactNode; index: number; hasComment: boolean } | null }[] = [];

  for (let i = 0; i < moves.length; i += 2) {
    const moveNumber = Math.floor(i / 2) + 1;
    const white = {
      san: formatSan(moves[i].moveNotation, true, useIcons),
      index: i + 1,
      hasComment: !!moves[i].comment?.trim(),
    };
    const black =
      i + 1 < moves.length
        ? {
            san: formatSan(moves[i + 1].moveNotation, false, useIcons),
            index: i + 2,
            hasComment: !!moves[i + 1].comment?.trim(),
          }
        : null;
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
