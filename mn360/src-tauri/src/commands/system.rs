use crate::config;
use std::fs;
use std::path::PathBuf;

#[tauri::command]
pub fn get_db_url() -> String {
    config::database_url()
}

#[tauri::command]
pub fn get_data_dir() -> String {
    config::load_settings().data_dir
}

/// Sao chép một tệp bất kỳ (do người dùng chọn qua hộp thoại) vào thư mục đính kèm
/// trong thư mục dữ liệu của ứng dụng, trả về đường dẫn tuyệt đối và tên tệp.
#[tauri::command]
pub fn save_attachment(
    entity_table: String,
    entity_id: String,
    source_path: String,
) -> Result<(String, String), String> {
    let src = PathBuf::from(&source_path);
    if !src.exists() {
        return Err("Không tìm thấy tệp nguồn.".into());
    }
    let file_name = src
        .file_name()
        .ok_or("Đường dẫn tệp không hợp lệ")?
        .to_string_lossy()
        .to_string();
    let settings = config::load_settings();
    let dest_dir = PathBuf::from(&settings.data_dir)
        .join("attachments")
        .join(&entity_table)
        .join(&entity_id);
    fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    let dest = dest_dir.join(&file_name);
    fs::copy(&src, &dest).map_err(|e| e.to_string())?;
    Ok((dest.to_string_lossy().to_string(), file_name))
}

/// Đổi thư mục lưu dữ liệu (VD: sang ổ D). Yêu cầu khởi động lại ứng dụng để áp dụng
/// vì kết nối SQLite hiện tại được gắn với đường dẫn cũ trong suốt phiên chạy.
#[tauri::command]
pub fn set_data_dir(new_dir: String) -> Result<String, String> {
    let old_db = config::database_file_path();
    let new_path = PathBuf::from(&new_dir);
    fs::create_dir_all(&new_path).map_err(|e| e.to_string())?;
    let new_db = new_path.join("mn360.db");
    if old_db.exists() && old_db != new_db {
        fs::copy(&old_db, &new_db).map_err(|e| e.to_string())?;
    }
    config::save_settings(&config::AppSettings {
        data_dir: new_dir.clone(),
    })
    .map_err(|e| e.to_string())?;
    Ok(new_dir)
}
