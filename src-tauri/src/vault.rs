use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ModuleFileType {
    Pdf,
    Ppt,
    Pptx,
    Md,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleItem {
    pub relative_path: String,
    pub file_name: String,
    pub file_type: ModuleFileType,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum VaultNodeType {
    File(ModuleFileType),
    Folder,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultNode {
    pub name: String,
    pub relative_path: String,
    pub node_type: VaultNodeType,
    pub size_bytes: Option<u64>,
    pub children: Vec<VaultNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultScanResult {
    pub root_path: String,
    pub root_nodes: Vec<VaultNode>,
}

/// Recursively scans a selected vault directory.
/// Ensures source modules are never modified and paths do not escape the vault.
pub fn scan_vault<P: AsRef<Path>>(root_path: P) -> Result<VaultScanResult, String> {
    let root = root_path.as_ref();
    if !root.exists() {
        return Err("Vault path does not exist".to_string());
    }
    if !root.is_dir() {
        return Err("Vault path is not a directory".to_string());
    }

    let canonical_root = root
        .canonicalize()
        .map_err(|e| format!("Failed to resolve vault path: {}", e))?;

    fn scan_dir(canonical_root: &Path, current_dir: &Path) -> Vec<VaultNode> {
        let mut nodes = Vec::new();
        let entries = match std::fs::read_dir(current_dir) {
            Ok(e) => e,
            Err(_) => return nodes,
        };

        let mut entries_vec: Vec<_> = entries.filter_map(|e| e.ok()).collect();
        entries_vec.sort_by_key(|e| e.file_name());

        for entry in entries_vec {
            let path = entry.path();
            let canonical_path = match path.canonicalize() {
                Ok(c) => c,
                Err(_) => continue,
            };

            if !canonical_path.starts_with(canonical_root) {
                continue;
            }

            let name = entry.file_name().to_string_lossy().to_string();
            let rel_path = match path.strip_prefix(canonical_root) {
                Ok(r) => r.to_string_lossy().to_string(),
                Err(_) => continue,
            };

            if path.is_dir() {
                let children = scan_dir(canonical_root, &path);
                nodes.push(VaultNode {
                    name,
                    relative_path: rel_path,
                    node_type: VaultNodeType::Folder,
                    size_bytes: None,
                    children,
                });
            } else if path.is_file() {
                let ext = match path.extension().and_then(|s| s.to_str()) {
                    Some(e) => e.to_lowercase(),
                    None => continue,
                };

                let file_type = match ext.as_str() {
                    "pdf" => ModuleFileType::Pdf,
                    "ppt" => ModuleFileType::Ppt,
                    "pptx" => ModuleFileType::Pptx,
                    "md" => ModuleFileType::Md,
                    _ => continue,
                };

                let metadata = match path.metadata() {
                    Ok(m) => m,
                    Err(_) => continue,
                };

                nodes.push(VaultNode {
                    name,
                    relative_path: rel_path,
                    node_type: VaultNodeType::File(file_type),
                    size_bytes: Some(metadata.len()),
                    children: Vec::new(),
                });
            }
        }

        nodes
    }

    let root_nodes = scan_dir(&canonical_root, &canonical_root);

    Ok(VaultScanResult {
        root_path: canonical_root.to_string_lossy().to_string(),
        root_nodes,
    })
}

/// Copies an external module file (.pdf, .ppt, .pptx, .md) into a specified course directory inside the vault.
pub fn add_module_to_vault<P: AsRef<Path>>(
    vault_root: P,
    target_course_rel_path: Option<String>,
    source_file_path: P,
) -> Result<ModuleItem, String> {
    let vault_canon = vault_root
        .as_ref()
        .canonicalize()
        .map_err(|e| format!("Invalid vault path: {}", e))?;

    let source = source_file_path.as_ref();
    if !source.exists() || !source.is_file() {
        return Err("Source file does not exist or is not a valid file".to_string());
    }

    let ext = source
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .ok_or_else(|| "Source file has no extension".to_string())?;

    let file_type = match ext.as_str() {
        "pdf" => ModuleFileType::Pdf,
        "ppt" => ModuleFileType::Ppt,
        "pptx" => ModuleFileType::Pptx,
        "md" => ModuleFileType::Md,
        _ => return Err("Unsupported file format".to_string()),
    };

    let file_name = source
        .file_name()
        .ok_or_else(|| "Invalid source file name".to_string())?
        .to_string_lossy()
        .to_string();

    let target_dir = match target_course_rel_path {
        Some(rel) if !rel.trim().is_empty() => vault_canon.join(rel),
        _ => vault_canon.clone(),
    };

    if !target_dir.exists() {
        std::fs::create_dir_all(&target_dir)
            .map_err(|e| format!("Failed to create course directory: {}", e))?;
    }

    let dest_file_path = target_dir.join(&file_name);
    let dest_canon = if dest_file_path.exists() {
        dest_file_path
            .canonicalize()
            .map_err(|e| format!("Failed to resolve destination path: {}", e))?
    } else {
        // Safe check path traversal
        let parent = dest_file_path
            .parent()
            .ok_or_else(|| "Invalid destination path".to_string())?;
        let parent_canon = parent
            .canonicalize()
            .map_err(|e| format!("Failed to resolve parent directory: {}", e))?;
        parent_canon.join(&file_name)
    };

    if !dest_canon.starts_with(&vault_canon) {
        return Err("Target path escapes the vault boundary".to_string());
    }

    std::fs::copy(source, &dest_file_path)
        .map_err(|e| format!("Failed to copy file into vault: {}", e))?;

    let metadata = std::fs::metadata(&dest_file_path)
        .map_err(|e| format!("Failed to read metadata of copied file: {}", e))?;

    let rel_path = dest_file_path
        .strip_prefix(&vault_canon)
        .map_err(|e| format!("Failed to compute relative path: {}", e))?
        .to_string_lossy()
        .to_string();

    Ok(ModuleItem {
        relative_path: rel_path,
        file_name,
        file_type,
        size_bytes: metadata.len(),
    })
}

/// Safely reads document file bytes from within the vault.
pub fn read_module_bytes<P: AsRef<Path>>(
    vault_root: P,
    relative_path: &str,
) -> Result<Vec<u8>, String> {
    let vault_canon = vault_root
        .as_ref()
        .canonicalize()
        .map_err(|e| format!("Invalid vault path: {}", e))?;

    let file_path = vault_canon.join(relative_path);
    let file_canon = file_path
        .canonicalize()
        .map_err(|e| format!("Module file not found: {}", e))?;

    if !file_canon.starts_with(&vault_canon) {
        return Err("Requested path escapes vault boundary".to_string());
    }

    std::fs::read(&file_canon).map_err(|e| format!("Failed to read module file: {}", e))
}

/// Creates a new folder inside the vault.
pub fn create_folder<P: AsRef<Path>>(vault_root: P, relative_path: &str) -> Result<(), String> {
    let vault_canon = vault_root
        .as_ref()
        .canonicalize()
        .map_err(|e| format!("Invalid vault path: {}", e))?;

    let target_dir = vault_canon.join(relative_path);

    // Check path traversal
    let parent = target_dir
        .parent()
        .ok_or_else(|| "Invalid folder path".to_string())?;
    let parent_canon = parent
        .canonicalize()
        .map_err(|e| format!("Parent directory does not exist: {}", e))?;

    if !parent_canon.starts_with(&vault_canon) {
        return Err("Target folder escapes vault boundary".to_string());
    }

    std::fs::create_dir_all(&target_dir).map_err(|e| format!("Failed to create folder: {}", e))
}

/// Removes a folder or module file inside the vault.
pub fn remove_item<P: AsRef<Path>>(vault_root: P, relative_path: &str) -> Result<(), String> {
    let vault_canon = vault_root
        .as_ref()
        .canonicalize()
        .map_err(|e| format!("Invalid vault path: {}", e))?;

    let target = vault_canon.join(relative_path);
    let target_canon = target
        .canonicalize()
        .map_err(|e| format!("Target item not found: {}", e))?;

    if !target_canon.starts_with(&vault_canon) || target_canon == vault_canon {
        return Err("Cannot delete items outside or equal to vault root".to_string());
    }

    if target_canon.is_dir() {
        std::fs::remove_dir_all(&target_canon)
            .map_err(|e| format!("Failed to remove folder: {}", e))
    } else {
        std::fs::remove_file(&target_canon).map_err(|e| format!("Failed to remove file: {}", e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_vault_scan_read_only_and_discovery() {
        let dir = tempdir().unwrap();
        let root_path = dir.path();

        let course_dir = root_path.join("CS101");
        fs::create_dir(&course_dir).unwrap();

        let pdf_path = course_dir.join("lecture1.pdf");
        let mut pdf_file = File::create(&pdf_path).unwrap();
        pdf_file.write_all(b"%PDF-1.4 dummy content").unwrap();

        let pptx_path = course_dir.join("lecture2.pptx");
        let mut pptx_file = File::create(&pptx_path).unwrap();
        pptx_file.write_all(b"dummy pptx content").unwrap();

        let txt_path = course_dir.join("ignore.txt");
        let mut txt_file = File::create(&txt_path).unwrap();
        txt_file.write_all(b"ignore me").unwrap();

        let initial_pdf_meta = fs::metadata(&pdf_path).unwrap();

        let res = scan_vault(root_path).unwrap();

        assert_eq!(res.courses.len(), 1);
        assert_eq!(res.courses[0].name, "CS101");
        assert_eq!(res.courses[0].modules.len(), 2);

        // Verify source files are untouched
        let post_pdf_meta = fs::metadata(&pdf_path).unwrap();
        assert_eq!(initial_pdf_meta.len(), post_pdf_meta.len());
        assert_eq!(
            initial_pdf_meta.modified().unwrap(),
            post_pdf_meta.modified().unwrap()
        );
    }
}
