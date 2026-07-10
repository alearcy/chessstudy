import { Chess } from "chess.js";
import type { PieceSymbol, Square } from "chess.js";

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
