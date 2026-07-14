use tauri_plugin_sql::{Migration, MigrationKind};

pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "init ai-os core schema",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "notes + notes_fts",
            sql: include_str!("../migrations/0002_notes.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "agents table + preset agent ids",
            sql: include_str!("../migrations/0003_agents.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "pipelines, steps, run history",
            sql: include_str!("../migrations/0004_pipelines.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "automations",
            sql: include_str!("../migrations/0005_automations.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "courses, tasks, events",
            sql: include_str!("../migrations/0006_semester.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "applications tracker",
            sql: include_str!("../migrations/0007_applications.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:dashboard.db", migrations())
                .build(),
        )
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}