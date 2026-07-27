import { supabase } from "@/lib/supabase/client";
import { requireData, throwIfError } from "@/repositories/repositoryError";

export interface AppSettingsInfo {
  lichess_username: string;
  chesscom_username: string;
}

export type AppSettingsUpdate = AppSettingsInfo;

export const DEFAULT_APP_SETTINGS: AppSettingsInfo = {
  lichess_username: "",
  chesscom_username: "",
};

function normalizeSettings(settings: AppSettingsUpdate): AppSettingsInfo {
  return {
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
    .select("lichess_username, chesscom_username")
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
    .select("lichess_username, chesscom_username")
    .single();
  return normalizeSettings(requireData(
    response.data,
    response.error,
    "Salvataggio impostazioni fallito.",
  ));
}
