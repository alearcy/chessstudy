import db from "@/db/database";
import { createStableId } from "@/db/recordMetadata";
import type { Move } from "@/types";

/** Normalizza una mossa letta dal DB garantendo i campi arrows/highlights/eval. */
function normalizeMove(m: Move): Move {
  return {
    ...m,
    comment: m.comment ?? "",
    analysisComment: m.analysisComment ?? null,
    stockfishComment: m.stockfishComment ?? null,
    arrows: m.arrows ?? [],
    highlights: m.highlights ?? [],
    evalCp: m.evalCp ?? null,
    evalMate: m.evalMate ?? null,
    evalDepth: m.evalDepth ?? 0,
    evalBestMoveUci: m.evalBestMoveUci ?? null,
  };
}

/**
 * Restituisce tutte le mosse di una scacchiera ordinate per `order`
 * (path lineare). Le varianti (più figli con stesso `parentId`) non sono
 * ancora gestite a livello UI — vedi docs/tech-debt/move-history-not-persisted.md.
 */
export async function getMovesByBoard(boardId: number): Promise<Move[]> {
  const moves = await db.moves.where("boardId").equals(boardId).sortBy("order");
  return moves.map(normalizeMove);
}

export async function getMove(id: number): Promise<Move | undefined> {
  return db.moves.get(id);
}

export async function createMove(move: Omit<Move, "id" | "createdAt">): Promise<number> {
  const id = await db.moves.add({
    ...move,
    uid: move.uid ?? createStableId(),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Move);
  return id as number;
}

export async function updateMove(
  id: number,
  data: Partial<Pick<Move, "comment" | "analysisComment" | "stockfishComment" | "fen" | "moveNotation" | "arrows" | "highlights" | "evalCp" | "evalMate" | "evalDepth" | "evalBestMoveUci">>
): Promise<void> {
  await db.moves.update(id, { ...data, updatedAt: new Date() });
}

/** Cancella tutte le mosse di una scacchiera (usato da reset / eliminazione board). */
export async function deleteMovesByBoard(boardId: number): Promise<void> {
  await db.moves.where("boardId").equals(boardId).delete();
}

/** Cancella le mosse di una scacchiera con `order` >= threshold (troncamento linea). */
export async function deleteMovesFromOrder(
  boardId: number,
  threshold: number
): Promise<void> {
  const toDelete = await db.moves
    .where("boardId")
    .equals(boardId)
    .filter((m) => m.order >= threshold)
    .primaryKeys();
  await db.moves.bulkDelete(toDelete);
}

/** Aggiorna la valutazione Stockfish di una mossa (persistenza eval). */
export async function updateMoveEval(
  id: number,
  data: Partial<Pick<Move, "evalCp" | "evalMate" | "evalDepth" | "evalBestMoveUci">>
): Promise<void> {
  await db.moves.update(id, { ...data, updatedAt: new Date() });
}
