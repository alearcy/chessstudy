import { createStableId, toJson } from "@/lib/dataUtils";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { supabase } from "@/lib/supabase/client";
import {
  boardFromRow,
  boardPayload,
  type BoardRow,
} from "@/repositories/supabaseMappers";
import { requireData, throwIfError } from "@/repositories/repositoryError";
import type { Board } from "@/types";

const DEFAULT_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export async function getBoardsByLesson(lessonId: number): Promise<Board[]> {
  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .eq("lesson_id", lessonId)
    .order("board_order", { ascending: true });
  throwIfError(error);
  return ((data ?? []) as BoardRow[]).map(boardFromRow);
}

export async function getBoard(id: number): Promise<Board | undefined> {
  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwIfError(error);
  return data ? boardFromRow(data as BoardRow) : undefined;
}

export async function createBoard(
  lessonId: number,
  data: Partial<Board> & { title?: string; fen?: string } = {},
): Promise<number> {
  const { count, error: countError } = await supabase
    .from("boards")
    .select("id", { count: "exact", head: true })
    .eq("lesson_id", lessonId);
  throwIfError(countError);
  const now = new Date();
  const payload = {
    ...boardPayload({
      ...data,
      uid: data.uid ?? createStableId(),
      title: data.title || `Scacchiera ${(count ?? 0) + 1}`,
      fen: data.fen ?? DEFAULT_FEN,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
    }),
    lesson_id: lessonId,
    board_order: count ?? 0,
  };
  const response = await supabase
    .from("boards")
    .insert(payload)
    .select("id")
    .single();
  return requireData(response.data as { id: number } | null, response.error, "Creazione scacchiera fallita.").id;
}

export async function updateBoard(
  id: number,
  data: Partial<Pick<Board, "title" | "fen" | "notes" | "arrows" | "highlights" | "evalCp" | "evalMate" | "evalDepth" | "evalBestMoveUci" | "whiteName" | "blackName" | "headers" | "gameAnalysis" | "openingReport" | "openingEco" | "openingName" | "openingFamily">>,
): Promise<void> {
  const payload: TablesUpdate<"boards"> = { updated_at: new Date().toISOString() };
  if ("title" in data) payload.title = data.title;
  if ("fen" in data) payload.fen = data.fen;
  if ("notes" in data) payload.notes = data.notes;
  if ("arrows" in data) payload.arrows = toJson(data.arrows);
  if ("highlights" in data) payload.highlights = toJson(data.highlights);
  if ("evalCp" in data) payload.eval_cp = data.evalCp;
  if ("evalMate" in data) payload.eval_mate = data.evalMate;
  if ("evalDepth" in data) payload.eval_depth = data.evalDepth;
  if ("evalBestMoveUci" in data) payload.eval_best_move_uci = data.evalBestMoveUci;
  if ("whiteName" in data) payload.white_name = data.whiteName;
  if ("blackName" in data) payload.black_name = data.blackName;
  if ("headers" in data) payload.headers = toJson(data.headers);
  if ("gameAnalysis" in data) payload.game_analysis = data.gameAnalysis;
  if ("openingReport" in data) {
    payload.opening_report = data.openingReport ? toJson(data.openingReport) : null;
  }
  if ("openingEco" in data) payload.opening_eco = data.openingEco;
  if ("openingName" in data) payload.opening_name = data.openingName;
  if ("openingFamily" in data) payload.opening_family = data.openingFamily;
  const { error } = await supabase.from("boards").update(payload).eq("id", id);
  throwIfError(error);
}

export async function deleteBoard(id: number): Promise<void> {
  const { error } = await supabase.from("boards").delete().eq("id", id);
  throwIfError(error);
}
