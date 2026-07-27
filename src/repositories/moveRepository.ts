import { createStableId, toJson } from "@/lib/dataUtils";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { supabase } from "@/lib/supabase/client";
import {
  moveFromRow,
  movePayload,
  type MoveRow,
} from "@/repositories/supabaseMappers";
import { requireData, throwIfError } from "@/repositories/repositoryError";
import type { Move } from "@/types";

export async function getMovesByBoard(boardId: number): Promise<Move[]> {
  const { data, error } = await supabase
    .from("moves")
    .select("*")
    .eq("board_id", boardId)
    .order("move_order", { ascending: true });
  throwIfError(error);
  return ((data ?? []) as MoveRow[]).map(moveFromRow);
}

export async function getMove(id: number): Promise<Move | undefined> {
  const { data, error } = await supabase
    .from("moves")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwIfError(error);
  return data ? moveFromRow(data as MoveRow) : undefined;
}

export async function createMove(move: Omit<Move, "id" | "createdAt">): Promise<number> {
  const now = new Date();
  const response = await supabase
    .from("moves")
    .insert({
      ...movePayload({
        ...move,
        uid: move.uid ?? createStableId(),
        createdAt: now,
        updatedAt: now,
      }),
      board_id: move.boardId,
      parent_id: move.parentId,
    })
    .select("id")
    .single();
  return requireData(response.data as { id: number } | null, response.error, "Creazione mossa fallita.").id;
}

export type MoveUpdatePatch = Partial<Pick<Move, "comment" | "analysisComment" | "stockfishComment" | "fen" | "moveNotation" | "arrows" | "highlights" | "tactics" | "evalCp" | "evalMate" | "evalDepth" | "evalBestMoveUci">>;

function buildUpdatePayload(data: MoveUpdatePatch): TablesUpdate<"moves"> {
  const payload: TablesUpdate<"moves"> = { updated_at: new Date().toISOString() };
  if ("comment" in data) payload.comment = data.comment;
  if ("analysisComment" in data) payload.analysis_comment = data.analysisComment;
  if ("stockfishComment" in data) payload.stockfish_comment = data.stockfishComment;
  if ("fen" in data) payload.fen = data.fen;
  if ("moveNotation" in data) payload.move_notation = data.moveNotation;
  if ("arrows" in data) payload.arrows = toJson(data.arrows);
  if ("highlights" in data) payload.highlights = toJson(data.highlights);
  if ("tactics" in data) payload.tactics = toJson(data.tactics);
  if ("evalCp" in data) payload.eval_cp = data.evalCp;
  if ("evalMate" in data) payload.eval_mate = data.evalMate;
  if ("evalDepth" in data) payload.eval_depth = data.evalDepth;
  if ("evalBestMoveUci" in data) payload.eval_best_move_uci = data.evalBestMoveUci;
  return payload;
}

export async function updateMove(
  id: number,
  data: MoveUpdatePatch,
): Promise<void> {
  const { error } = await supabase.from("moves").update(buildUpdatePayload(data)).eq("id", id);
  throwIfError(error);
}

// Aggiorna più mosse con UPDATE parallele a chunk. Upsert non praticabile:
// Postgres valida i NOT NULL (board_id, ...) prima dell'ON CONFLICT, quindi
// un upsert parziale fallirebbe. Con chunk da 20, 87 mosse ≈ 5 "ondate"
// di richieste concorrenti invece di 87 roundtrips sequenziali.
const BATCH_CHUNK_SIZE = 20;

export async function updateMovesBatch(
  updates: Array<{ id: number; data: MoveUpdatePatch }>,
): Promise<void> {
  for (let i = 0; i < updates.length; i += BATCH_CHUNK_SIZE) {
    await Promise.all(
      updates.slice(i, i + BATCH_CHUNK_SIZE).map(async ({ id, data }) => {
        const { error } = await supabase
          .from("moves")
          .update(buildUpdatePayload(data))
          .eq("id", id);
        throwIfError(error);
      })
    );
  }
}

export async function deleteMovesByBoard(boardId: number): Promise<void> {
  const { error } = await supabase.from("moves").delete().eq("board_id", boardId);
  throwIfError(error);
}

export async function deleteMovesFromOrder(boardId: number, threshold: number): Promise<void> {
  const { error } = await supabase
    .from("moves")
    .delete()
    .eq("board_id", boardId)
    .gte("move_order", threshold);
  throwIfError(error);
}
