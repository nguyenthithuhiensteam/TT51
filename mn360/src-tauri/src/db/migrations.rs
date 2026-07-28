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
        Migration {
            version: 4,
            description: "extend_permissions_phase2",
            sql: include_str!("./sql/004_extend_permissions_phase2.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "children_classes_schema",
            sql: include_str!("./sql/005_children_classes.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "staff_schema",
            sql: include_str!("./sql/006_staff.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "curriculum_schema",
            sql: include_str!("./sql/007_curriculum.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "seed_demo_data_phase2",
            sql: include_str!("./sql/008_seed_demo_phase2.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "extend_permissions_phase3",
            sql: include_str!("./sql/009_extend_permissions_phase3.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "nutrition_schema",
            sql: include_str!("./sql/010_nutrition.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "health_safety_schema",
            sql: include_str!("./sql/011_health_safety.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "finance_assets_schema",
            sql: include_str!("./sql/012_finance_assets.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "seed_demo_data_phase3",
            sql: include_str!("./sql/013_seed_demo_phase3.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "extend_permissions_phase4",
            sql: include_str!("./sql/014_extend_permissions_phase4.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "accreditation_schema",
            sql: include_str!("./sql/015_accreditation.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 16,
            description: "party_schema",
            sql: include_str!("./sql/016_party.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 17,
            description: "parent_portal_schema",
            sql: include_str!("./sql/017_parent_portal.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 18,
            description: "seed_demo_data_phase4",
            sql: include_str!("./sql/018_seed_demo_phase4.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
