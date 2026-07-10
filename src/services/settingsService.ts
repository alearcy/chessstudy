export interface AppSettingsInfo {
  stockfish_depth: number;
  stockfish_threads: number;
  lichess_username: string;
  chesscom_username: string;
}

export interface AppSettingsUpdate {
  stockfish_depth: number;
  stockfish_threads: number;
  lichess_username: string;
  chesscom_username: string;
}

export async function getAppSettings(): Promise<AppSettingsInfo> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<AppSettingsInfo>("get_settings");
}

export async function setAppSettings(
  args: AppSettingsUpdate,
): Promise<AppSettingsInfo> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<AppSettingsInfo>("set_settings", { args });
}
