use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub data_dir: String,
}

fn config_root() -> PathBuf {
    if cfg!(target_os = "windows") {
        let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
        PathBuf::from(appdata).join("MN360")
    } else {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        PathBuf::from(home).join(".config").join("MN360")
    }
}

fn default_data_dir() -> PathBuf {
    if cfg!(target_os = "windows") {
        let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
        PathBuf::from(appdata).join("MN360").join("data")
    } else {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        PathBuf::from(home)
            .join(".local")
            .join("share")
            .join("MN360")
            .join("data")
    }
}

pub fn settings_file() -> PathBuf {
    config_root().join("settings.json")
}

/// Đọc cấu hình thư mục dữ liệu; nếu chưa có thì tạo mặc định (không phải OneDrive).
pub fn load_settings() -> AppSettings {
    let path = settings_file();
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(settings) = serde_json::from_str::<AppSettings>(&content) {
            return settings;
        }
    }
    let default = AppSettings {
        data_dir: default_data_dir().to_string_lossy().to_string(),
    };
    let _ = save_settings(&default);
    default
}

pub fn save_settings(settings: &AppSettings) -> std::io::Result<()> {
    let root = config_root();
    fs::create_dir_all(&root)?;
    fs::write(settings_file(), serde_json::to_string_pretty(settings)?)
}

pub fn database_file_path() -> PathBuf {
    let settings = load_settings();
    let dir = PathBuf::from(&settings.data_dir);
    let _ = fs::create_dir_all(&dir);
    dir.join("mn360.db")
}

pub fn database_url() -> String {
    format!("sqlite:{}", database_file_path().to_string_lossy())
}
