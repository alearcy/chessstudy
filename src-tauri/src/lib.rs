mod commands;
mod commentary;
mod llm;
mod settings;
mod stockfish;

use commands::AppState;
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

            // Load OpenRouter settings from disk.
            let openrouter_settings = settings::load_settings(app.handle());
            log::info!("OpenRouter settings loaded: api_key_configured={}",
                openrouter_settings.api_key.is_some());

            app.manage(AppState {
                engine: Mutex::new(engine),
                settings: Mutex::new(openrouter_settings),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::analyze_position,
            commands::stockfish_path,
            commands::set_settings,
            commands::get_settings,
            commands::clear_api_key,
            commands::generate_commentary,
            commands::generate_batch_commentary,
            commands::generate_game_analysis,
            commands::llm_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}