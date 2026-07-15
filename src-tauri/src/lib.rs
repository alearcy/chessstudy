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
fn resolve_stockfish_path(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    if let Ok(path) = std::env::var("STOCKFISH_PATH") {
        let path = PathBuf::from(path);
        if is_usable_stockfish_binary(&path) {
            return Some(path);
        }
        log::warn!("ignoring invalid STOCKFISH_PATH: {}", path.display());
    }

    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        let resource_binaries_dir = resource_dir.join("binaries");
        for candidate in stockfish_binary_candidates(&resource_binaries_dir) {
            if is_usable_stockfish_binary(&candidate) {
                return Some(candidate);
            }
        }
    }

    let manifest_binaries_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries");
    for candidate in stockfish_binary_candidates(&manifest_binaries_dir) {
        if is_usable_stockfish_binary(&candidate) {
            return Some(candidate);
        }
    }

    None
}

fn stockfish_binary_candidates(base_dir: &Path) -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        candidates.push(base_dir.join("stockfish-aarch64-apple-darwin"));
        candidates.push(base_dir.join("stockfish-macos-m1-apple-silicon"));
        candidates.push(base_dir.join("stockfish-src").join("stockfish-macos-m1-apple-silicon"));
    }
    if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
        candidates.push(base_dir.join("stockfish-x86_64-apple-darwin"));
    }
    if cfg!(target_os = "windows") {
        candidates.push(base_dir.join("stockfish-x86_64-pc-windows-msvc.exe"));
        candidates.push(base_dir.join("stockfish.exe"));
    }
    if cfg!(target_os = "linux") {
        candidates.push(base_dir.join("stockfish-x86_64-unknown-linux-gnu"));
        candidates.push(base_dir.join("stockfish"));
    }

    candidates.push(base_dir.join("stockfish"));
    candidates
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
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
            let engine = match binary_path {
                Some(path) => {
                    let path_display = path.display().to_string();
                    match stockfish::Engine::new(&path_display) {
                        Ok(engine) => Some(engine),
                        Err(error) => {
                            log::error!("failed to start stockfish engine at {}: {:#}", path_display, error);
                            None
                        }
                    }
                }
                None => {
                    log::warn!("no usable stockfish binary found; native analysis disabled");
                    None
                }
            };

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
