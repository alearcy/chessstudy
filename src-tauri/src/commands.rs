use crate::commentary::{CommentaryInput, CommentaryResult, GameAnalysisInput, GameAnalysisMove, GameAnalysisResult};
use crate::llm::OpenRouterClient;
use crate::settings::OpenRouterSettings;
use crate::stockfish::{AnalysisResult, Engine as SfEngine};
use std::sync::Mutex;
use tauri::State;

/// Stato condiviso dell'applicazione.
pub struct AppState {
    pub engine: Mutex<SfEngine>,
    pub settings: Mutex<OpenRouterSettings>,
}

/// Analizza una posizione FEN con Stockfish nativo a profondità fissa.
#[tauri::command]
pub fn analyze_position(
    state: State<'_, AppState>,
    fen: String,
    depth: u32,
) -> Result<AnalysisResult, String> {
    let engine = state.engine.lock().map_err(|e| format!("mutex poison: {}", e))?;
    engine.analyze(&fen, depth).map_err(|e| format!("analysis error: {}", e))
}

/// Restituisce il percorso del binario Stockfish (per diagnostica).
#[tauri::command]
pub fn stockfish_path(state: State<'_, AppState>) -> String {
    state
        .engine
        .lock()
        .map(|e| e.binary_path().to_string())
        .unwrap_or_else(|_| "unknown".to_string())
}

// ── Comandi Settings OpenRouter ────────────────────────────────────────────────

/// Argomenti per `set_settings`.
#[derive(serde::Deserialize)]
pub struct SetSettingsArgs {
    pub api_key: Option<String>,
    pub model: Option<String>,
}

/// Stato restituito da `get_settings` (non espone la key raw).
#[derive(serde::Serialize)]
pub struct SettingsInfo {
    pub api_key_configured: bool,
    pub model: String,
}

/// Salva le impostazioni OpenRouter.
#[tauri::command]
pub fn set_settings(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    args: SetSettingsArgs,
) -> Result<SettingsInfo, String> {
    let new_settings = OpenRouterSettings {
        api_key: args.api_key,
        model: args.model.or_else(|| {
            state.settings.lock().ok().and_then(|s| s.model.clone())
        }),
    };

    crate::settings::save_settings(&app, &new_settings)
        .map_err(|e| format!("save error: {}", e))?;

    let mut guard = state.settings.lock().map_err(|e| format!("mutex poison: {}", e))?;
    *guard = new_settings.clone();

    Ok(SettingsInfo {
        api_key_configured: new_settings.api_key.is_some(),
        model: new_settings.model.unwrap_or_else(|| "openai/gpt-4o-mini".to_string()),
    })
}

/// Legge lo stato delle impostazioni (senza esporre la API key).
#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> SettingsInfo {
    let guard = state.settings.lock().ok();
    let settings = guard.as_ref();
    let api_key_configured = settings
        .and_then(|s| s.api_key.as_ref())
        .map(|k| !k.is_empty())
        .unwrap_or(false);
    let model = settings
        .and_then(|s| s.model.clone())
        .unwrap_or_else(|| "openai/gpt-4o-mini".to_string());

    SettingsInfo { api_key_configured, model }
}

/// Rimuove la API key (mantiene il model).
#[tauri::command]
pub fn clear_api_key(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<SettingsInfo, String> {
    let model = {
        let guard = state.settings.lock().map_err(|e| format!("mutex poison: {}", e))?;
        guard.model.clone()
    };

    let new_settings = OpenRouterSettings { api_key: None, model };

    crate::settings::save_settings(&app, &new_settings)
        .map_err(|e| format!("save error: {}", e))?;

    let mut guard = state.settings.lock().map_err(|e| format!("mutex poison: {}", e))?;
    *guard = new_settings.clone();

    Ok(SettingsInfo {
        api_key_configured: false,
        model: new_settings.model.unwrap_or_else(|| "openai/gpt-4o-mini".to_string()),
    })
}

// ── Comandi LLM ───────────────────────────────────────────────────────────────

/// Input per generare un commento su una singola mossa.
#[derive(serde::Deserialize)]
pub struct GenerateCommentaryArgs {
    pub fen_before: String,
    pub fen_after: String,
    pub played_san: String,
    pub played_by: String,
    pub white_name: Option<String>,
    pub black_name: Option<String>,
    pub eval_cp: Option<i32>,
    pub eval_mate: Option<i32>,
    pub eval_depth: u32,
    pub after_eval_cp: Option<i32>,
    pub after_eval_mate: Option<i32>,
    pub best_move_san: Option<String>,
}

fn make_client(state: &AppState) -> Result<OpenRouterClient, String> {
    let guard = state.settings.lock().map_err(|e| format!("mutex poison: {}", e))?;
    let api_key = guard
        .api_key
        .as_ref()
        .ok_or_else(|| "API key non configurata".to_string())?;
    let model = guard
        .model
        .clone()
        .unwrap_or_else(|| "openai/gpt-4o-mini".to_string());
    Ok(OpenRouterClient::new(api_key.clone(), model))
}

/// Genera un commento didattico per una mossa usando OpenRouter.
#[tauri::command]
pub async fn generate_commentary(
    state: State<'_, AppState>,
    args: GenerateCommentaryArgs,
) -> Result<CommentaryResult, String> {
    let client = make_client(&state)?;

    let input = CommentaryInput {
        fen_before: args.fen_before,
        fen_after: args.fen_after,
        played_san: args.played_san,
        played_by: args.played_by,
        white_name: args.white_name,
        black_name: args.black_name,
        eval_cp: args.eval_cp,
        eval_mate: args.eval_mate,
        eval_depth: args.eval_depth,
        after_eval_cp: args.after_eval_cp,
        after_eval_mate: args.after_eval_mate,
        best_move_san: args.best_move_san,
    };

    crate::commentary::generate(&client, &input).await.map_err(|e| format!("commentary error: {}", e))
}

/// Input per generare commenti su più mosse.
#[derive(serde::Deserialize)]
pub struct BatchCommentaryArgs {
    pub moves: Vec<GenerateCommentaryArgs>,
}

/// Genera commenti didattici per un batch di mosse.
#[tauri::command]
pub async fn generate_batch_commentary(
    state: State<'_, AppState>,
    args: BatchCommentaryArgs,
) -> Result<Vec<CommentaryResult>, String> {
    let client = make_client(&state)?;

    let inputs: Vec<CommentaryInput> = args
        .moves
        .iter()
        .map(|m| CommentaryInput {
            fen_before: m.fen_before.clone(),
            fen_after: m.fen_after.clone(),
            played_san: m.played_san.clone(),
            played_by: m.played_by.clone(),
            white_name: m.white_name.clone(),
            black_name: m.black_name.clone(),
            eval_cp: m.eval_cp,
            eval_mate: m.eval_mate,
            eval_depth: m.eval_depth,
            after_eval_cp: m.after_eval_cp,
            after_eval_mate: m.after_eval_mate,
            best_move_san: m.best_move_san.clone(),
        })
        .collect();

    crate::commentary::generate_batch(&client, &inputs).await.map_err(|e| format!("batch commentary error: {}", e))
}

// ── Game Analysis ─────────────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameAnalysisArgs {
    pub white_name: Option<String>,
    pub black_name: Option<String>,
    pub result: Option<String>,
    pub moves: Vec<GameAnalysisMoveArg>,
    pub key_swings: Vec<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameAnalysisMoveArg {
    pub move_number: u32,
    pub index: u32,
    pub san: String,
    pub player: String,
    pub eval_before: String,
    pub eval_after: String,
    pub classification: String,
    pub best_san: Option<String>,
}

#[tauri::command]
pub async fn generate_game_analysis(
    state: State<'_, AppState>,
    args: GameAnalysisArgs,
) -> Result<GameAnalysisResult, String> {
    let client = make_client(&state)?;
    let input = GameAnalysisInput {
        white_name: args.white_name.unwrap_or_else(|| "il Bianco".to_string()),
        black_name: args.black_name.unwrap_or_else(|| "il Nero".to_string()),
        result: args.result,
        moves: args.moves.iter().map(|m| GameAnalysisMove {
            move_number: m.move_number,
            index: m.index,
            san_italian: crate::commentary::san_to_italian_public(&m.san),
            player: m.player.clone(),
            eval_before: m.eval_before.clone(),
            eval_after: m.eval_after.clone(),
            classification: m.classification.clone(),
            best_san_italian: m.best_san.as_ref().map(|b| crate::commentary::san_to_italian_public(b)),
        }).collect(),
        key_swings: args.key_swings,
    };
    crate::commentary::analyze_game(&client, &input)
        .await
        .map_err(|e| format!("game analysis error: {}", e))
}

/// Stato dell'LLM (API key configurata?).
#[derive(serde::Serialize)]
pub struct LlmStatus {
    pub ready: bool,
    pub model_available: bool,
}

/// Verifica lo stato dell'LLM.
#[tauri::command]
pub fn llm_status(state: State<'_, AppState>) -> LlmStatus {
    let guard = state.settings.lock().ok();
    let ready = guard
        .as_ref()
        .and_then(|s| s.api_key.as_ref())
        .map(|k| !k.is_empty())
        .unwrap_or(false);
    LlmStatus {
        ready,
        model_available: ready,
    }
}