use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    #[serde(default)]
    pub stockfish_depth: Option<u32>,
    #[serde(default)]
    pub stockfish_threads: Option<u32>,
    #[serde(default)]
    pub lichess_username: Option<String>,
    #[serde(default)]
    pub chesscom_username: Option<String>,
}

pub const DEFAULT_STOCKFISH_DEPTH: u32 = 15;
pub const DEFAULT_STOCKFISH_THREADS: u32 = 1;

pub fn normalize_stockfish_depth(depth: Option<u32>) -> u32 {
    depth.unwrap_or(DEFAULT_STOCKFISH_DEPTH).clamp(1, 30)
}

pub fn normalize_stockfish_threads(threads: Option<u32>) -> u32 {
    threads.unwrap_or(DEFAULT_STOCKFISH_THREADS).clamp(1, 32)
}

pub fn normalize_username(username: Option<String>) -> String {
    username.unwrap_or_default().trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::normalize_username;

    #[test]
    fn username_settings_are_trimmed_and_default_to_empty() {
        assert_eq!(normalize_username(Some("  arcy  ".to_string())), "arcy");
        assert_eq!(normalize_username(None), "");
    }
}

fn empty_settings() -> AppSettings {
    AppSettings {
        stockfish_depth: Some(DEFAULT_STOCKFISH_DEPTH),
        stockfish_threads: Some(DEFAULT_STOCKFISH_THREADS),
        lichess_username: Some(String::new()),
        chesscom_username: Some(String::new()),
    }
}

fn settings_path(app_handle: &AppHandle) -> Result<PathBuf> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .context("failed to get app_data_dir")?;
    std::fs::create_dir_all(&dir).ok();
    Ok(dir.join("settings.json"))
}

pub fn load_settings(app_handle: &AppHandle) -> AppSettings {
    let path = match settings_path(app_handle) {
        Ok(p) => p,
        Err(_) => return empty_settings(),
    };

    match std::fs::read_to_string(&path) {
        Ok(content) => match serde_json::from_str::<AppSettings>(&content) {
            Ok(s) => {
                log::info!("[settings] loaded from {:?}", path);
                s
            }
            Err(e) => {
                log::warn!("[settings] failed to parse {:?}: {}", path, e);
                empty_settings()
            }
        },
        Err(_) => {
            log::info!("[settings] no file at {:?}, using defaults", path);
            empty_settings()
        }
    }
}

pub fn save_settings(app_handle: &AppHandle, settings: &AppSettings) -> Result<()> {
    let path = settings_path(app_handle)?;
    let json = serde_json::to_string_pretty(settings)?;
    std::fs::write(&path, json)
        .with_context(|| format!("failed to write settings to {:?}", path))?;
    log::info!("[settings] saved to {:?}", path);
    Ok(())
}
