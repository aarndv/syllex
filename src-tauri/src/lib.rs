pub mod vault;

#[tauri::command]
fn scan_vault(path: String) -> Result<vault::VaultScanResult, String> {
    vault::scan_vault(path)
}

#[tauri::command]
fn add_module_to_vault(
    vault_root: String,
    target_course_rel_path: Option<String>,
    source_file_path: String,
) -> Result<vault::ModuleItem, String> {
    vault::add_module_to_vault(vault_root, target_course_rel_path, source_file_path)
}

#[tauri::command]
fn read_module_bytes(vault_root: String, relative_path: String) -> Result<Vec<u8>, String> {
    vault::read_module_bytes(vault_root, &relative_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_vault,
            add_module_to_vault,
            read_module_bytes
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
