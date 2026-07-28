mod commands;
mod config;
mod db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_url = config::database_url();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(&db_url, db::migrations::get_migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::auth::hash_password,
            commands::auth::verify_password,
            commands::system::get_db_url,
            commands::system::get_data_dir,
            commands::system::set_data_dir,
            commands::system::save_attachment,
            commands::backup::backup_database,
            commands::backup::restore_database,
            commands::backup::list_backups,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MN360");
}
