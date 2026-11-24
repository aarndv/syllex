pub mod folder_order;
pub mod highlights;
pub mod metadata;
pub mod original;
pub mod portable;
pub mod ppt_converter;
pub mod study;
pub mod vault;

#[tauri::command]
fn scan_vault(app: tauri::AppHandle, path: String) -> Result<vault::VaultScanResult, String> {
    let mut scan = vault::scan_vault(path)?;
    if metadata::selected_vault(&app)?.as_deref() == Some(scan.root_path.as_str()) {
        if let Err(error) = portable::ensure(std::path::Path::new(&scan.root_path)) {
            scan.warnings.push(format!("Portable study data: {error}"));
        } else if let Err(error) =
            study::ensure_for_app(&app, std::path::Path::new(&scan.root_path))
        {
            scan.warnings.push(format!("Study-data migration: {error}"));
        }
    }
    if let Err(error) = metadata::apply_library_overrides(&app, &mut scan) {
        scan.warnings.push(format!("Library study data: {error}"));
    }
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
fn get_folder_orders(
    vault_root: String,
) -> Result<std::collections::HashMap<String, Vec<String>>, String> {
    folder_order::list(&vault_root)
}

#[tauri::command]
fn save_folder_order(
    vault_root: String,
    parent_path: String,
    folder_paths: Vec<String>,
) -> Result<(), String> {
    folder_order::save(&vault_root, &parent_path, folder_paths)
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

#[tauri::command]
fn open_original(app: tauri::AppHandle, relative_path: String) -> Result<(), String> {
    let root = metadata::selected_vault(&app)?.ok_or_else(|| "No vault is selected".to_string())?;
    let file = original::validated_module(std::path::Path::new(&root), &relative_path)?;
    original::open_in_system_app(&app, &file)
}

#[tauri::command]
fn read_markdown_module(
    app: tauri::AppHandle,
    relative_path: String,
) -> Result<original::MarkdownModule, String> {
    let root = metadata::selected_vault(&app)?.ok_or_else(|| "No vault is selected".to_string())?;
    original::read_markdown(std::path::Path::new(&root), &relative_path)
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
            get_folder_orders,
            save_folder_order,
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
            convert_ppt_to_pdf,
            open_original,
            read_markdown_module
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
