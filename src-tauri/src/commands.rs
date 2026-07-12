use crate::settings::{
    normalize_stockfish_depth, normalize_stockfish_multipv, normalize_stockfish_threads,
    normalize_username, AppSettings,
};
use crate::stockfish::{AnalysisResult, Engine as SfEngine};
use std::sync::Mutex;
use tauri::State;

/// Stato condiviso dell'applicazione.
pub struct AppState {
    pub engine: Mutex<Option<SfEngine>>,
    pub settings: Mutex<AppSettings>,
}

/// Analizza una posizione FEN con Stockfish nativo a profondità fissa.
#[tauri::command]
pub fn analyze_position(
    state: State<'_, AppState>,
    fen: String,
    depth: u32,
    threads: Option<u32>,
    multipv: Option<u32>,
) -> Result<AnalysisResult, String> {
    let engine = state
        .engine
        .lock()
        .map_err(|e| format!("mutex poison: {}", e))?;
    let engine = engine
        .as_ref()
        .ok_or_else(|| "Stockfish non disponibile: binario mancante o non valido".to_string())?;
    engine
        .analyze(
            &fen,
            normalize_stockfish_depth(Some(depth)),
            normalize_stockfish_threads(threads),
            normalize_stockfish_multipv(multipv),
        )
        .map_err(|e| format!("analysis error: {}", e))
}

/// Restituisce il percorso del binario Stockfish (per diagnostica).
#[tauri::command]
pub fn stockfish_path(state: State<'_, AppState>) -> String {
    state
        .engine
        .lock()
        .map(|e| {
            e.as_ref()
                .map(|engine| engine.binary_path().to_string())
                .unwrap_or_else(|| "unavailable".to_string())
        })
        .unwrap_or_else(|_| "unknown".to_string())
}

// ── Comandi Settings ───────────────────────────────────────────────────────────

/// Argomenti per `set_settings`.
#[derive(serde::Deserialize)]
pub struct SetSettingsArgs {
    pub stockfish_depth: Option<u32>,
    pub stockfish_threads: Option<u32>,
    pub lichess_username: Option<String>,
    pub chesscom_username: Option<String>,
}

/// Stato restituito da `get_settings` (non espone la key raw).
#[derive(serde::Serialize)]
pub struct SettingsInfo {
    pub stockfish_depth: u32,
    pub stockfish_threads: u32,
    pub lichess_username: String,
    pub chesscom_username: String,
}

/// Salva le impostazioni dell'app.
#[tauri::command]
pub fn set_settings(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    args: SetSettingsArgs,
) -> Result<SettingsInfo, String> {
    let previous = state
        .settings
        .lock()
        .map_err(|e| format!("mutex poison: {}", e))?
        .clone();

    let new_settings = AppSettings {
        stockfish_depth: Some(normalize_stockfish_depth(
            args.stockfish_depth.or(previous.stockfish_depth),
        )),
        stockfish_threads: Some(normalize_stockfish_threads(
            args.stockfish_threads.or(previous.stockfish_threads),
        )),
        lichess_username: Some(normalize_username(
            args.lichess_username.or(previous.lichess_username),
        )),
        chesscom_username: Some(normalize_username(
            args.chesscom_username.or(previous.chesscom_username),
        )),
    };

    crate::settings::save_settings(&app, &new_settings)
        .map_err(|e| format!("save error: {}", e))?;

    let mut guard = state
        .settings
        .lock()
        .map_err(|e| format!("mutex poison: {}", e))?;
    *guard = new_settings.clone();

    Ok(SettingsInfo {
        stockfish_depth: normalize_stockfish_depth(new_settings.stockfish_depth),
        stockfish_threads: normalize_stockfish_threads(new_settings.stockfish_threads),
        lichess_username: normalize_username(new_settings.lichess_username),
        chesscom_username: normalize_username(new_settings.chesscom_username),
    })
}

/// Legge lo stato delle impostazioni.
#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> SettingsInfo {
    let guard = state.settings.lock().ok();
    let settings = guard.as_ref();
    let stockfish_depth = normalize_stockfish_depth(settings.and_then(|s| s.stockfish_depth));
    let stockfish_threads = normalize_stockfish_threads(settings.and_then(|s| s.stockfish_threads));
    let lichess_username = normalize_username(settings.and_then(|s| s.lichess_username.clone()));
    let chesscom_username = normalize_username(settings.and_then(|s| s.chesscom_username.clone()));

    SettingsInfo {
        stockfish_depth,
        stockfish_threads,
        lichess_username,
        chesscom_username,
    }
}
