// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod note_folder;
mod proofreading;

// Learn more about Tauri commands at https://v1.tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn main() {
    tauri::Builder::default()
        .manage(note_folder::SharedFolder::default())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![greet, note_folder::choose_notes_folder,
            note_folder::reopen_notes_folder, note_folder::save_markdown_note,
            note_folder::save_note_image, note_folder::read_note_image,
            proofreading::proofread_text])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
