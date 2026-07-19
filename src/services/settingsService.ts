import { supabase } from "@/lib/supabase/client";
import { requireData, throwIfError } from "@/repositories/repositoryError";

export interface AppSettingsInfo {
  stockfish_depth: number;
  stockfish_threads: number;
  lichess_username: string;
  chesscom_username: string;
}

export type AppSettingsUpdate = AppSettingsInfo;

export const DEFAULT_APP_SETTINGS: AppSettingsInfo = {
  stockfish_depth: 15,
  stockfish_threads: 2,
  lichess_username: "",
  chesscom_username: "",
};

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

function normalizeSettings(settings: AppSettingsUpdate): AppSettingsInfo {
  return {
    stockfish_depth: clampInteger(settings.stockfish_depth, 1, 30),
    stockfish_threads: clampInteger(settings.stockfish_threads, 1, 32),
    lichess_username: settings.lichess_username.trim(),
    chesscom_username: settings.chesscom_username.trim(),
  };
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Sessione non disponibile.");
  return data.user.id;
}

export async function getAppSettings(): Promise<AppSettingsInfo> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("user_settings")
    .select("stockfish_depth, stockfish_threads, lichess_username, chesscom_username")
    .eq("user_id", userId)
    .maybeSingle();
  throwIfError(error);
  return data ? normalizeSettings(data) : { ...DEFAULT_APP_SETTINGS };
}

export async function setAppSettings(
  args: AppSettingsUpdate,
): Promise<AppSettingsInfo> {
  const userId = await requireUserId();
  const settings = normalizeSettings(args);
  const response = await supabase
    .from("user_settings")
    .upsert({
      user_id: userId,
      ...settings,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select("stockfish_depth, stockfish_threads, lichess_username, chesscom_username")
    .single();
  return normalizeSettings(requireData(
    response.data,
    response.error,
    "Salvataggio impostazioni fallito.",
  ));
}
