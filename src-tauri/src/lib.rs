pub mod ppt_converter;
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

#[tauri::command]
fn create_folder(vault_root: String, relative_path: String) -> Result<(), String> {
    vault::create_folder(vault_root, &relative_path)
}

#[tauri::command]
fn remove_item(vault_root: String, relative_path: String) -> Result<(), String> {
    vault::remove_item(vault_root, &relative_path)
}

#[tauri::command]
fn rename_item(
    vault_root: String,
    relative_path: String,
    new_name: String,
) -> Result<String, String> {
    vault::rename_item(vault_root, &relative_path, &new_name)
}

#[tauri::command]
fn create_vault(parent_dir: String, vault_name: String) -> Result<String, String> {
    vault::create_vault(parent_dir, &vault_name)
}

#[tauri::command]
fn list_subvaults(parent_dir: String) -> Result<Vec<vault::VaultSummary>, String> {
    vault::list_subvaults(parent_dir)
}

#[tauri::command]
fn check_libreoffice_installed() -> bool {
    ppt_converter::detect_libreoffice().is_some()
}

#[tauri::command]
fn convert_ppt_to_pdf(
    app: tauri::AppHandle,
    vault_root: String,
    relative_path: String,
) -> Result<Vec<u8>, String> {
    ppt_converter::convert_ppt_to_pdf(&app, &vault_root, &relative_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_vault,
            add_module_to_vault,
            read_module_bytes,
            create_folder,
            remove_item,
            rename_item,
            create_vault,
            list_subvaults,
            check_libreoffice_installed,
            convert_ppt_to_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
