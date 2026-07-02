mod commands;
mod commentary;
mod llm;
mod settings;
mod stockfish;

use commands::AppState;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::Manager;

/// Risolve il percorso del binario Stockfish:
/// 1. Variabile d'ambiente `STOCKFISH_PATH`
/// 2. `src-tauri/binaries/stockfish-<target>` (sviluppo)
/// 3. `src-tauri/binaries/stockfish(.exe)` (compatibilità)
/// 4. `stockfish` nel PATH di sistema
fn resolve_stockfish_path(app_handle: &tauri::AppHandle) -> String {
    if let Ok(path) = std::env::var("STOCKFISH_PATH") {
        if Path::new(&path).exists() {
            log::info!("using STOCKFISH_PATH: {}", path);
            return path;
        }
    }

    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        let resource_binaries_dir = resource_dir.join("binaries");
        for candidate in stockfish_binary_candidates(&resource_binaries_dir) {
            if candidate.exists() {
                log::info!("using bundled binary: {}", candidate.display());
                return candidate.to_string_lossy().to_string();
            }
        }
    }

    let binaries_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("binaries");
    for candidate in stockfish_binary_candidates(&binaries_dir) {
        if candidate.exists() {
            log::info!("using development binary: {}", candidate.display());
            return candidate.to_string_lossy().to_string();
        }
    }

    log::info!("using system stockfish from PATH");
    "stockfish".to_string()
}

fn stockfish_binary_candidates(base_dir: &Path) -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        candidates.push(base_dir.join("stockfish-aarch64-apple-darwin"));
    }
    if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
        candidates.push(base_dir.join("stockfish-x86_64-apple-darwin"));
    }
    if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        candidates.push(base_dir.join("stockfish-x86_64-pc-windows-msvc.exe"));
        candidates.push(base_dir.join("stockfish.exe"));
    }

    candidates.push(base_dir.join(if cfg!(windows) {
        "stockfish.exe"
    } else {
        "stockfish"
    }));
    candidates
}

fn resolve_llm_model_path(app_handle: &tauri::AppHandle, configured_path: &str) -> PathBuf {
    if let Ok(path) = std::env::var("LLM_MODEL_PATH") {
        let path = PathBuf::from(path);
        if path.exists() {
            log::info!("using LLM_MODEL_PATH: {}", path.display());
            return path;
        }
    }

    let configured = PathBuf::from(configured_path);
    if configured.is_absolute() && configured.exists() {
        log::info!("using configured LLM model: {}", configured.display());
        return configured;
    }

    let development_candidate = Path::new(env!("CARGO_MANIFEST_DIR")).join(configured_path);
    if cfg!(debug_assertions) && development_candidate.exists() {
        log::info!(
            "using development LLM model: {}",
            development_candidate.display()
        );
        return development_candidate;
    }

    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        let candidate = resource_dir.join(configured_path);
        if candidate.exists() {
            log::info!("using bundled LLM model: {}", candidate.display());
            return candidate;
        }
    }

    log::info!(
        "using development LLM model fallback: {}",
        development_candidate.display()
    );
    development_candidate
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
            let binary_path = resolve_stockfish_path(app.handle());
            let engine =
                stockfish::Engine::new(&binary_path).expect("failed to start stockfish engine");

            // Load app settings from disk.
            let app_settings = settings::load_settings(app.handle());
            let llm_model_path = resolve_llm_model_path(
                app.handle(),
                &settings::normalize_llm_model_path(app_settings.llm_model_path.clone()),
            );
            log::info!(
                "embedded LLM settings loaded: model_path={}",
                llm_model_path.display()
            );
            let llm = match llm::LocalLlmClient::new(&llm_model_path) {
                Ok(client) => Some(client),
                Err(error) => {
                    log::error!(
                        "failed to load embedded LLM from {}: {:#}",
                        llm_model_path.display(),
                        error
                    );
                    None
                }
            };

            app.manage(AppState {
                engine: Mutex::new(engine),
                llm: Mutex::new(llm),
                settings: Mutex::new(app_settings),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::analyze_position,
            commands::stockfish_path,
            commands::set_settings,
            commands::get_settings,
            commands::generate_commentary,
            commands::generate_batch_commentary,
            commands::generate_game_analysis,
            commands::llm_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
