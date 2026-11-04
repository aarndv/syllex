pub mod highlights;
pub mod metadata;
pub mod ppt_converter;
pub mod vault;

#[tauri::command]
fn scan_vault(app: tauri::AppHandle, path: String) -> Result<vault::VaultScanResult, String> {
    let mut scan = vault::scan_vault(path)?;
    metadata::apply_library_overrides(&app, &mut scan)?;
    Ok(scan)
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
fn set_item_hidden(
    app: tauri::AppHandle,
    vault_root: String,
    relative_path: String,
    hidden: bool,
) -> Result<(), String> {
    metadata::set_item_hidden(&app, &vault_root, &relative_path, hidden)
}

#[tauri::command]
fn set_item_display_name(
    app: tauri::AppHandle,
    vault_root: String,
    relative_path: String,
    display_name: String,
) -> Result<(), String> {
    metadata::set_item_display_name(&app, &vault_root, &relative_path, &display_name)
}

#[tauri::command]
fn get_selected_vault(app: tauri::AppHandle) -> Result<Option<String>, String> {
    metadata::selected_vault(&app)
}

#[tauri::command]
fn set_selected_vault(
    app: tauri::AppHandle,
    path: Option<String>,
) -> Result<Option<String>, String> {
    metadata::set_selected_vault(&app, path)
}

#[tauri::command]
fn get_reading_progress(
    app: tauri::AppHandle,
    vault_root: String,
    relative_path: String,
) -> Result<Option<u32>, String> {
    metadata::reading_progress(&app, &vault_root, &relative_path)
}

#[tauri::command]
fn save_reading_progress(
    app: tauri::AppHandle,
    vault_root: String,
    relative_path: String,
    page: u32,
) -> Result<(), String> {
    metadata::save_reading_progress(&app, &vault_root, &relative_path, page)
}

#[tauri::command]
fn list_highlights(
    app: tauri::AppHandle,
    vault_root: String,
    relative_path: String,
) -> Result<Vec<highlights::Highlight>, String> {
    highlights::list(&app, &vault_root, &relative_path)
}

#[tauri::command]
fn save_highlight(
    app: tauri::AppHandle,
    vault_root: String,
    relative_path: String,
    highlight: highlights::Highlight,
) -> Result<(), String> {
    highlights::insert(&app, &vault_root, &relative_path, highlight)
}

#[tauri::command]
fn delete_highlight(
    app: tauri::AppHandle,
    vault_root: String,
    relative_path: String,
    id: String,
) -> Result<(), String> {
    highlights::delete(&app, &vault_root, &relative_path, &id)
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
            set_item_hidden,
            set_item_display_name,
            get_selected_vault,
            set_selected_vault,
            get_reading_progress,
            save_reading_progress,
            list_highlights,
            save_highlight,
            delete_highlight,
            create_vault,
            list_subvaults,
            check_libreoffice_installed,
            convert_ppt_to_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
