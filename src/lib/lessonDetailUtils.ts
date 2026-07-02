import { Chess } from "chess.js";
import type { PieceSymbol, Square } from "chess.js";
import { evalScore, moveClassification } from "@/services/analysisService";
import type { Move } from "@/types";

export function cleanGameAnalysisText(text: string): string {
  return text.replace(/\[([^\]]*?)\]\(#move-\d+\)/g, (_full, content) => {
    const words = content.trim().split(/\s+/);
    return words[0] ?? "";
  });
}

export function sanToSquare(san: string, byBlack: boolean): string | null {
  if (san === "O-O") return byBlack ? "g8" : "g1";
  if (san === "O-O-O") return byBlack ? "c8" : "c1";
  const clean = san.replace(/[+#]$/, "");
  const dest = clean.split("=")[0];
  return dest.slice(-2);
}

export function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

export function getKingStatus(fen: string): { square: Square; checkmate: boolean } | null {
  try {
    const position = new Chess(fen);
    if (!position.isCheck()) return null;
    const checkedColor = position.turn();
    const board = position.board();

    for (const row of board) {
      for (const piece of row) {
        if (piece?.type === "k" && piece.color === checkedColor) {
          return {
            square: piece.square as Square,
            checkmate: position.isCheckmate(),
          };
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function formatEvalForPrompt(cp: number | null, mate: number | null): string {
  if (mate != null) return mate > 0 ? `M${mate}` : `M${mate}`;
  if (cp != null) {
    const pawns = cp / 100;
    return pawns >= 0 ? `+${pawns.toFixed(1)}` : `${pawns.toFixed(1)}`;
  }
  return "?";
}

export function uciToSan(fen: string, uci: string): string | null {
  try {
    const game = new Chess(fen);
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promotion = uci.length > 4 ? (uci[4] as PieceSymbol) : undefined;
    const move = game.move({ from, to, promotion });
    return move?.san ?? null;
  } catch {
    return null;
  }
}

export function computeKeySwings(
  moveList: Move[],
  startCp: number | null,
  startMate: number | null,
  whiteName: string,
  blackName: string
): string[] {
  const swings: Array<{ desc: string; absLoss: number }> = [];
  for (let i = 0; i < moveList.length; i++) {
    const move = moveList[i];
    const beforeCp = i === 0 ? startCp : (moveList[i - 1]?.evalCp ?? null);
    const beforeMate = i === 0 ? startMate : (moveList[i - 1]?.evalMate ?? null);
    const afterCp = move.evalCp ?? null;
    const afterMate = move.evalMate ?? null;
    const beforeScore = evalScore(beforeCp, beforeMate);
    const afterScore = evalScore(afterCp, afterMate);
    const isWhiteMove = i % 2 === 0;
    const cpLoss = isWhiteMove ? beforeScore - afterScore : afterScore - beforeScore;

    const cls = moveClassification(cpLoss);
    if (cls?.label === "!!" || cls?.label === "!" || !cls) continue;
    const playerName = i % 2 === 0 ? whiteName : blackName;
    const clsLabel =
      cls.label === "??" ? "ERRORE GRAVE" :
      cls.label === "?" ? "ERRORE" :
      cls.label === "?!" ? "IMPRECISIONE" : "BUONA";
    swings.push({
      desc: `Mossa ${Math.floor(i / 2) + 1}. ${move.moveNotation} di ${playerName} (${clsLabel})`,
      absLoss: Math.abs(cpLoss),
    });
  }
  swings.sort((a, b) => b.absLoss - a.absLoss);
  return swings.slice(0, 5).map((s) => s.desc);
}
