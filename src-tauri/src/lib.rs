mod commands;
mod commentary;
mod llm;
mod stockfish;

use commands::AppState;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

/// Risolve il percorso del binario Stockfish:
/// 1. Variabile d'ambiente `STOCKFISH_PATH`
/// 2. `src-tauri/binaries/stockfish` (sviluppo)
/// 3. `stockfish` nel PATH di sistema
fn resolve_stockfish_path() -> String {
    if let Ok(path) = std::env::var("STOCKFISH_PATH") {
        if std::path::Path::new(&path).exists() {
            log::info!("using STOCKFISH_PATH: {}", path);
            return path;
        }
    }

    let dev_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("binaries/stockfish");
    if dev_path.exists() {
        log::info!("using development binary: {}", dev_path.display());
        return dev_path.to_string_lossy().to_string();
    }

    log::info!("using system stockfish from PATH");
    "stockfish".to_string()
}

/// Risolve il percorso del modello LLM (Gemma 4 E2B Q4_K_S).
/// Cerca in:
/// 1. Variabile d'ambiente `LLM_MODEL_PATH`
/// 2. `<project_root>/models/gemma-4-e2b-it-Q4_K_S.gguf`
/// 3. `app_data_dir()/models/gemma-4-e2b-it-Q4_K_S.gguf`
fn resolve_model_path(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    if let Ok(path) = std::env::var("LLM_MODEL_PATH") {
        let p = PathBuf::from(&path);
        if p.exists() {
            log::info!("using LLM_MODEL_PATH: {}", p.display());
            return Some(p);
        }
    }

    // Root di progetto (relativa a CARGO_MANIFEST_DIR = src-tauri/).
    // Cerca qualunque .gguf nella cartella models/.
    if let Some(project_root) = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).parent() {
        let models_dir = project_root.join("models");
        if let Ok(entries) = std::fs::read_dir(&models_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("gguf") {
                    log::info!("using project model: {}", path.display());
                    return Some(path);
                }
            }
        }
    }

    // App data directory.
    let app_data = app_handle
        .path()
        .app_data_dir()
        .ok()?;
    let model_path = app_data.join("models").join("gemma-4-e2b-it-Q4_K_S.gguf");
    if model_path.exists() {
        log::info!("using model from app_data: {}", model_path.display());
        return Some(model_path);
    }

    log::warn!("LLM model not found. Place a .gguf file in <project_root>/models/ or set LLM_MODEL_PATH.");
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Init Stockfish engine.
            let binary_path = resolve_stockfish_path();
            let engine = stockfish::Engine::new(&binary_path)
                .expect("failed to start stockfish engine");

            // Init LLM engine (opzionale: se il modello non esiste, parte senza).
            let llm = resolve_model_path(app.handle())
                .and_then(|path| {
                    match llm::LlmEngine::load(&path) {
                        Ok(eng) => {
                            log::info!("LLM engine initialized");
                            Some(eng)
                        }
                        Err(e) => {
                            log::warn!("failed to load LLM model: {}. Using fallback.", e);
                            None
                        }
                    }
                });

            app.manage(AppState {
                engine: Mutex::new(engine),
                llm: Mutex::new(llm),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::analyze_position,
            commands::stockfish_path,
            commands::generate_commentary,
            commands::generate_batch_commentary,
            commands::llm_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}