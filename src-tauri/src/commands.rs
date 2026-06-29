use crate::commentary::{
    CommentaryInput, CommentaryResult, GameAnalysisInput, GameAnalysisMove, GameAnalysisResult,
};
use crate::llm::LocalLlmClient;
use crate::settings::{
    normalize_llm_base_url, normalize_llm_model, normalize_stockfish_depth,
    normalize_stockfish_threads, AppSettings,
};
use crate::stockfish::{AnalysisResult, Engine as SfEngine};
use std::sync::Mutex;
use tauri::State;

/// Stato condiviso dell'applicazione.
pub struct AppState {
    pub engine: Mutex<SfEngine>,
    pub settings: Mutex<AppSettings>,
}

/// Analizza una posizione FEN con Stockfish nativo a profondità fissa.
#[tauri::command]
pub fn analyze_position(
    state: State<'_, AppState>,
    fen: String,
    depth: u32,
    threads: Option<u32>,
) -> Result<AnalysisResult, String> {
    let engine = state
        .engine
        .lock()
        .map_err(|e| format!("mutex poison: {}", e))?;
    engine
        .analyze(
            &fen,
            normalize_stockfish_depth(Some(depth)),
            normalize_stockfish_threads(threads),
        )
        .map_err(|e| format!("analysis error: {}", e))
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

// ── Comandi Settings ───────────────────────────────────────────────────────────

/// Argomenti per `set_settings`.
#[derive(serde::Deserialize)]
pub struct SetSettingsArgs {
    pub api_key: Option<Option<String>>,
    pub model: Option<String>,
    pub llm_base_url: Option<String>,
    pub llm_model: Option<String>,
    pub stockfish_depth: Option<u32>,
    pub stockfish_threads: Option<u32>,
}

/// Stato restituito da `get_settings` (non espone la key raw).
#[derive(serde::Serialize)]
pub struct SettingsInfo {
    pub api_key_configured: bool,
    pub model: String,
    pub llm_base_url: String,
    pub llm_model: String,
    pub stockfish_depth: u32,
    pub stockfish_threads: u32,
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
        api_key: args.api_key.unwrap_or(previous.api_key),
        model: args.model.or_else(|| previous.model.clone()),
        llm_base_url: Some(normalize_llm_base_url(
            args.llm_base_url.or(previous.llm_base_url.clone()),
        )),
        llm_model: Some(normalize_llm_model(
            args.llm_model.or(previous.llm_model.clone()),
        )),
        stockfish_depth: Some(normalize_stockfish_depth(
            args.stockfish_depth.or(previous.stockfish_depth),
        )),
        stockfish_threads: Some(normalize_stockfish_threads(
            args.stockfish_threads.or(previous.stockfish_threads),
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
        api_key_configured: new_settings.api_key.is_some(),
        model: new_settings.model.unwrap_or_default(),
        llm_base_url: normalize_llm_base_url(new_settings.llm_base_url),
        llm_model: normalize_llm_model(new_settings.llm_model),
        stockfish_depth: normalize_stockfish_depth(new_settings.stockfish_depth),
        stockfish_threads: normalize_stockfish_threads(new_settings.stockfish_threads),
    })
}

/// Legge lo stato delle impostazioni.
#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> SettingsInfo {
    let guard = state.settings.lock().ok();
    let settings = guard.as_ref();
    let api_key_configured = settings
        .and_then(|s| s.api_key.as_ref())
        .map(|k| !k.is_empty())
        .unwrap_or(false);
    let model = settings.and_then(|s| s.model.clone()).unwrap_or_default();
    let llm_base_url = normalize_llm_base_url(settings.and_then(|s| s.llm_base_url.clone()));
    let llm_model = normalize_llm_model(settings.and_then(|s| s.llm_model.clone()));
    let stockfish_depth = normalize_stockfish_depth(settings.and_then(|s| s.stockfish_depth));
    let stockfish_threads = normalize_stockfish_threads(settings.and_then(|s| s.stockfish_threads));

    SettingsInfo {
        api_key_configured,
        model,
        llm_base_url,
        llm_model,
        stockfish_depth,
        stockfish_threads,
    }
}

/// Rimuove la vecchia API key eventualmente migrata da versioni precedenti.
#[tauri::command]
pub fn clear_api_key(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<SettingsInfo, String> {
    let (model, llm_base_url, llm_model, stockfish_depth, stockfish_threads) = {
        let guard = state
            .settings
            .lock()
            .map_err(|e| format!("mutex poison: {}", e))?;
        (
            guard.model.clone(),
            guard.llm_base_url.clone(),
            guard.llm_model.clone(),
            guard.stockfish_depth,
            guard.stockfish_threads,
        )
    };

    let new_settings = AppSettings {
        api_key: None,
        model,
        llm_base_url,
        llm_model,
        stockfish_depth,
        stockfish_threads,
    };

    crate::settings::save_settings(&app, &new_settings)
        .map_err(|e| format!("save error: {}", e))?;

    let mut guard = state
        .settings
        .lock()
        .map_err(|e| format!("mutex poison: {}", e))?;
    *guard = new_settings.clone();

    Ok(SettingsInfo {
        api_key_configured: false,
        model: new_settings.model.unwrap_or_default(),
        llm_base_url: normalize_llm_base_url(new_settings.llm_base_url),
        llm_model: normalize_llm_model(new_settings.llm_model),
        stockfish_depth: normalize_stockfish_depth(new_settings.stockfish_depth),
        stockfish_threads: normalize_stockfish_threads(new_settings.stockfish_threads),
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

fn make_client(state: &AppState) -> Result<LocalLlmClient, String> {
    let guard = state
        .settings
        .lock()
        .map_err(|e| format!("mutex poison: {}", e))?;
    let base_url = normalize_llm_base_url(guard.llm_base_url.clone());
    let model = normalize_llm_model(guard.llm_model.clone());
    Ok(LocalLlmClient::new(base_url, model))
}

/// Genera un commento didattico per una mossa usando un LLM locale.
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

    crate::commentary::generate(&client, &input)
        .await
        .map_err(|e| format!("commentary error: {}", e))
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

    crate::commentary::generate_batch(&client, &inputs)
        .await
        .map_err(|e| format!("batch commentary error: {}", e))
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
        moves: args
            .moves
            .iter()
            .map(|m| GameAnalysisMove {
                move_number: m.move_number,
                index: m.index,
                san_italian: crate::commentary::san_to_italian_public(&m.san),
                player: m.player.clone(),
                eval_before: m.eval_before.clone(),
                eval_after: m.eval_after.clone(),
                classification: m.classification.clone(),
                best_san_italian: m
                    .best_san
                    .as_ref()
                    .map(|b| crate::commentary::san_to_italian_public(b)),
            })
            .collect(),
        key_swings: args.key_swings,
    };
    crate::commentary::analyze_game(&client, &input)
        .await
        .map_err(|e| format!("game analysis error: {}", e))
}

/// Stato dell'LLM locale.
#[derive(serde::Serialize)]
pub struct LlmStatus {
    pub ready: bool,
    pub model_available: bool,
    pub base_url: String,
    pub model: String,
}

/// Verifica lo stato dell'LLM.
#[tauri::command]
pub async fn llm_status(state: State<'_, AppState>) -> Result<LlmStatus, String> {
    let (base_url, model) = match state.settings.lock() {
        Ok(settings) => (
            normalize_llm_base_url(settings.llm_base_url.clone()),
            normalize_llm_model(settings.llm_model.clone()),
        ),
        Err(_) => ("".to_string(), "".to_string()),
    };
    let ready = match make_client(&state) {
        Ok(client) => client.is_available().await,
        Err(_) => false,
    };

    Ok(LlmStatus {
        ready,
        model_available: ready,
        base_url,
        model,
    })
}
