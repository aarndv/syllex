pub mod vault;

#[tauri::command]
fn scan_vault(path: String) -> Result<vault::VaultScanResult, String> {
    vault::scan_vault(path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![scan_vault])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
