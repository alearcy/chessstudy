use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenRouterSettings {
    pub api_key: Option<String>,
    pub model: Option<String>,
}

fn settings_path(app_handle: &AppHandle) -> Result<PathBuf> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .context("failed to get app_data_dir")?;
    std::fs::create_dir_all(&dir).ok();
    Ok(dir.join("settings.json"))
}

pub fn load_settings(app_handle: &AppHandle) -> OpenRouterSettings {
    let path = match settings_path(app_handle) {
        Ok(p) => p,
        Err(_) => return OpenRouterSettings { api_key: None, model: None },
    };

    match std::fs::read_to_string(&path) {
        Ok(content) => {
            match serde_json::from_str::<OpenRouterSettings>(&content) {
                Ok(s) => {
                    log::info!("[settings] loaded from {:?}", path);
                    s
                }
                Err(e) => {
                    log::warn!("[settings] failed to parse {:?}: {}", path, e);
                    OpenRouterSettings { api_key: None, model: None }
                }
            }
        }
        Err(_) => {
            log::info!("[settings] no file at {:?}, using defaults", path);
            OpenRouterSettings { api_key: None, model: None }
        }
    }
}

pub fn save_settings(app_handle: &AppHandle, settings: &OpenRouterSettings) -> Result<()> {
    let path = settings_path(app_handle)?;
    let json = serde_json::to_string_pretty(settings)?;
    std::fs::write(&path, json)
        .with_context(|| format!("failed to write settings to {:?}", path))?;
    log::info!("[settings] saved to {:?}", path);
    Ok(())
}