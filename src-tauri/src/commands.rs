use crate::commentary::{CommentaryInput, CommentaryResult};
use crate::llm::LlmEngine;
use crate::stockfish::{AnalysisResult, Engine as SfEngine};
use std::sync::Mutex;
use tauri::State;

/// Stato condiviso dell'applicazione.
pub struct AppState {
    pub engine: Mutex<SfEngine>,
    pub llm: Mutex<Option<LlmEngine>>,
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

/// Genera un commento didattico per una mossa usando l'LLM locale.
#[tauri::command]
pub fn generate_commentary(
    state: State<'_, AppState>,
    args: GenerateCommentaryArgs,
) -> Result<CommentaryResult, String> {
    let llm_guard = state.llm.lock().map_err(|e| format!("mutex poison: {}", e))?;
    let llm = llm_guard
        .as_ref()
        .ok_or_else(|| "LLM not available".to_string())?;

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

    crate::commentary::generate(llm, &input).map_err(|e| format!("commentary error: {}", e))
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
    let llm_guard = state.llm.lock().map_err(|e| format!("mutex poison: {}", e))?;
    let llm = llm_guard
        .as_ref()
        .ok_or_else(|| "LLM not available".to_string())?;

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

    crate::commentary::generate_batch(llm, &inputs).map_err(|e| format!("batch commentary error: {}", e))
}

/// Stato dell'LLM: ready, model_available, downloading.
#[derive(serde::Serialize)]
pub struct LlmStatus {
    pub ready: bool,
    pub model_available: bool,
}

/// Verifica lo stato dell'LLM.
#[tauri::command]
pub fn llm_status(state: State<'_, AppState>) -> LlmStatus {
    let llm_guard = state.llm.lock().ok();
    let ready = llm_guard.as_ref().map(|g| g.is_some()).unwrap_or(false);
    LlmStatus {
        ready,
        model_available: ready,
    }
}