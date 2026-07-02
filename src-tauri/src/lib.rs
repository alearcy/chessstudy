mod commands;
mod settings;
mod stockfish;

use commands::AppState;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::Manager;

fn is_usable_stockfish_binary(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }
    if let Ok(metadata) = path.metadata() {
        if metadata.len() < 1024 {
            return false;
        }
    }
    true
}

/// Risolve il percorso del binario Stockfish:
/// 1. Variabile d'ambiente `STOCKFISH_PATH`
/// 2. `src-tauri/binaries/stockfish-<target>` (sviluppo)
/// 3. `src-tauri/binaries/stockfish(.exe)` (compatibilità)
/// 4. `stockfish` nel PATH di sistema
fn resolve_stockfish_path(app_handle: &tauri::AppHandle) -> String {
    if let Ok(path) = std::env::var("STOCKFISH_PATH") {
        if is_usable_stockfish_binary(Path::new(&path)) {
            log::info!("using STOCKFISH_PATH: {}", path);
            return path;
        } else {
            log::warn!("ignoring invalid STOCKFISH_PATH: {}", path);
        }
    }

    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        let resource_binaries_dir = resource_dir.join("binaries");
        for candidate in stockfish_binary_candidates(&resource_binaries_dir) {
            if is_usable_stockfish_binary(&candidate) {
                log::info!("using bundled binary: {}", candidate.display());
                return candidate.to_string_lossy().to_string();
            } else if candidate.exists() {
                log::warn!("ignoring invalid bundled binary: {}", candidate.display());
            }
        }
    }

    let binaries_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("binaries");
    for candidate in stockfish_binary_candidates(&binaries_dir) {
        if is_usable_stockfish_binary(&candidate) {
            log::info!("using development binary: {}", candidate.display());
            return candidate.to_string_lossy().to_string();
        } else if candidate.exists() {
            log::warn!("ignoring invalid development binary: {}", candidate.display());
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
            let engine = match stockfish::Engine::new(&binary_path) {
                Ok(engine) => Some(engine),
                Err(error) => {
                    log::error!("failed to start stockfish engine at {}: {:#}", binary_path, error);
                    None
                }
            };

            // Load app settings from disk.
            let app_settings = settings::load_settings(app.handle());

            app.manage(AppState {
                engine: Mutex::new(engine),
                settings: Mutex::new(app_settings),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::analyze_position,
            commands::stockfish_path,
            commands::set_settings,
            commands::get_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
