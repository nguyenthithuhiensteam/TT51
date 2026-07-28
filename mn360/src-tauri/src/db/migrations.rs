use tauri_plugin_sql::{Migration, MigrationKind};

/// Danh sách migration có phiên bản cho CSDL SQLite của MN360.
/// Mỗi migration chỉ chạy một lần trên một CSDL, theo thứ tự `version` tăng dần.
pub fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "init_schema_giai_doan_1",
            sql: include_str!("./sql/001_init_schema.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "seed_roles_permissions",
            sql: include_str!("./sql/002_seed_roles_permissions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "seed_demo_data_truong_mam_non_trang_da",
            sql: include_str!("./sql/003_seed_demo_data.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
