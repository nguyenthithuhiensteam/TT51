use crate::config;
use chrono::Local;
use std::fs;
use std::path::PathBuf;

/// Sao lưu tệp SQLite hiện tại sang thư mục chỉ định, đặt tên theo thời điểm sao lưu.
#[tauri::command]
pub fn backup_database(backup_dir: String) -> Result<String, String> {
    let db_path = config::database_file_path();
    if !db_path.exists() {
        return Err("Chưa có cơ sở dữ liệu để sao lưu.".into());
    }
    let dir = PathBuf::from(&backup_dir);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let timestamp = Local::now().format("%Y%m%d_%H%M%S");
    let file_name = format!("mn360_backup_{timestamp}.db");
    let dest = dir.join(&file_name);
    fs::copy(&db_path, &dest).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}

/// Khôi phục dữ liệu từ một bản sao lưu, có kiểm tra định dạng SQLite và tự sao lưu
/// bản hiện tại trước khi ghi đè để tránh mất dữ liệu nếu khôi phục sai tệp.
#[tauri::command]
pub fn restore_database(backup_path: String) -> Result<String, String> {
    let src = PathBuf::from(&backup_path);
    if !src.exists() {
        return Err("Không tìm thấy tệp sao lưu.".into());
    }
    let header = fs::read(&src).map_err(|e| e.to_string())?;
    if header.len() < 16 || &header[0..15] != b"SQLite format 3" {
        return Err("Tệp không đúng định dạng cơ sở dữ liệu SQLite.".into());
    }
    let db_path = config::database_file_path();
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    if db_path.exists() {
        let safety = db_path.with_extension("db.before_restore");
        fs::copy(&db_path, &safety).map_err(|e| e.to_string())?;
    }
    fs::copy(&src, &db_path).map_err(|e| e.to_string())?;
    Ok(db_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn list_backups(backup_dir: String) -> Result<Vec<String>, String> {
    let dir = PathBuf::from(&backup_dir);
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut files: Vec<String> = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry
                .path()
                .extension()
                .map(|ext| ext == "db")
                .unwrap_or(false)
        })
        .map(|entry| entry.path().to_string_lossy().to_string())
        .collect();
    files.sort();
    files.reverse();
    Ok(files)
}
