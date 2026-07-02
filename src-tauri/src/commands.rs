use crate::commentary::{
    CommentaryInput, CommentaryResult, GameAnalysisInput, GameAnalysisMove, GameAnalysisResult,
    MoveDiagnosis,
};
use crate::llm::LocalLlmClient;
use crate::settings::{
    normalize_llm_model_path, normalize_stockfish_depth, normalize_stockfish_threads, AppSettings,
};
use crate::stockfish::{AnalysisResult, Engine as SfEngine};
use std::sync::Mutex;
use tauri::State;

/// Stato condiviso dell'applicazione.
pub struct AppState {
    pub engine: Mutex<SfEngine>,
    pub llm: Mutex<Option<LocalLlmClient>>,
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
    pub llm_model_path: Option<String>,
    pub stockfish_depth: Option<u32>,
    pub stockfish_threads: Option<u32>,
}

/// Stato restituito da `get_settings` (non espone la key raw).
#[derive(serde::Serialize)]
pub struct SettingsInfo {
    pub llm_model_path: String,
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
        llm_model_path: Some(normalize_llm_model_path(
            args.llm_model_path.or(previous.llm_model_path.clone()),
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
        llm_model_path: normalize_llm_model_path(new_settings.llm_model_path),
        stockfish_depth: normalize_stockfish_depth(new_settings.stockfish_depth),
        stockfish_threads: normalize_stockfish_threads(new_settings.stockfish_threads),
    })
}

/// Legge lo stato delle impostazioni.
#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> SettingsInfo {
    let guard = state.settings.lock().ok();
    let settings = guard.as_ref();
    let llm_model_path = normalize_llm_model_path(settings.and_then(|s| s.llm_model_path.clone()));
    let stockfish_depth = normalize_stockfish_depth(settings.and_then(|s| s.stockfish_depth));
    let stockfish_threads = normalize_stockfish_threads(settings.and_then(|s| s.stockfish_threads));

    SettingsInfo {
        llm_model_path,
        stockfish_depth,
        stockfish_threads,
    }
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

fn with_client<T>(
    state: &AppState,
    f: impl FnOnce(&LocalLlmClient) -> Result<T, anyhow::Error>,
) -> Result<T, String> {
    let guard = state
        .llm
        .lock()
        .map_err(|e| format!("mutex poison: {}", e))?;
    let client = guard
        .as_ref()
        .ok_or_else(|| "LLM locale non disponibile".to_string())?;
    f(client).map_err(|e| e.to_string())
}

/// Genera un commento didattico per una mossa usando un LLM locale.
#[tauri::command]
pub fn generate_commentary(
    state: State<'_, AppState>,
    args: GenerateCommentaryArgs,
) -> Result<CommentaryResult, String> {
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

    with_client(&state, |client| crate::commentary::generate(client, &input))
        .map_err(|e| format!("commentary error: {}", e))
}

/// Input per generare commenti su più mosse.
#[derive(serde::Deserialize)]
pub struct BatchCommentaryArgs {
    pub moves: Vec<GenerateCommentaryArgs>,
}

/// Genera commenti didattici per un batch di mosse.
#[tauri::command]
pub fn generate_batch_commentary(
    state: State<'_, AppState>,
    args: BatchCommentaryArgs,
) -> Result<Vec<CommentaryResult>, String> {
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

    with_client(&state, |client| {
        crate::commentary::generate_batch(client, &inputs)
    })
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
    pub fen_before: String,
    pub fen_after: String,
    pub san: String,
    pub player: String,
    pub eval_before: String,
    pub eval_after: String,
    pub eval_before_cp: Option<i32>,
    pub eval_after_cp: Option<i32>,
    pub eval_drop_cp: i32,
    pub classification: String,
    pub best_san: Option<String>,
    pub best_move_lan: Option<String>,
    pub stockfish_comment: Option<String>,
    pub diagnosis: Option<MoveDiagnosis>,
}

#[tauri::command]
pub fn generate_game_analysis(
    state: State<'_, AppState>,
    args: GameAnalysisArgs,
) -> Result<GameAnalysisResult, String> {
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
                fen_before: m.fen_before.clone(),
                fen_after: m.fen_after.clone(),
                san_italian: crate::commentary::san_to_italian_public(&m.san),
                player: m.player.clone(),
                eval_before: m.eval_before.clone(),
                eval_after: m.eval_after.clone(),
                eval_before_cp: m.eval_before_cp,
                eval_after_cp: m.eval_after_cp,
                eval_drop_cp: m.eval_drop_cp,
                classification: m.classification.clone(),
                best_san_italian: m
                    .best_san
                    .as_ref()
                    .map(|b| crate::commentary::san_to_italian_public(b)),
                best_move_lan: m.best_move_lan.clone(),
                stockfish_comment: m.stockfish_comment.clone(),
                diagnosis: m.diagnosis.clone(),
            })
            .collect(),
        key_swings: args.key_swings,
    };
    match with_client(&state, |client| {
        crate::commentary::analyze_game(client, &input)
    }) {
        Ok(result) => Ok(result),
        Err(error) if error == "LLM locale non disponibile" => Ok(
            crate::commentary::build_stockfish_game_analysis_fallback(&input),
        ),
        Err(error) => Err(error),
    }
    .map_err(|e| format!("game analysis error: {}", e))
}

/// Stato dell'LLM locale.
#[derive(serde::Serialize)]
pub struct LlmStatus {
    pub ready: bool,
    pub model_available: bool,
    pub model_path: String,
}

/// Verifica lo stato dell'LLM.
#[tauri::command]
pub fn llm_status(state: State<'_, AppState>) -> Result<LlmStatus, String> {
    let guard = state
        .llm
        .lock()
        .map_err(|e| format!("mutex poison: {}", e))?;
    let ready = guard.as_ref().is_some_and(LocalLlmClient::is_available);

    Ok(LlmStatus {
        ready,
        model_available: ready,
        model_path: guard
            .as_ref()
            .map(|client| client.model_path().display().to_string())
            .unwrap_or_default(),
    })
}
