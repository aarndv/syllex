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

/// Renames a folder or module file inside the vault.
/// Returns the new relative path from the vault root (using forward slashes).
pub fn rename_item<P: AsRef<Path>>(
    vault_root: P,
    relative_path: &str,
    new_name: &str,
) -> Result<String, String> {
    let vault_canon = vault_root
        .as_ref()
        .canonicalize()
        .map_err(|e| format!("Invalid vault path: {}", e))?;

    let target = vault_canon.join(relative_path);
    let target_canon = target
        .canonicalize()
        .map_err(|e| format!("Target item not found: {}", e))?;

    if !target_canon.starts_with(&vault_canon) || target_canon == vault_canon {
        return Err("Cannot rename items outside or equal to vault root".to_string());
    }

    let trimmed_name = new_name.trim();
    if trimmed_name.is_empty() {
        return Err("New name cannot be empty".to_string());
    }

    // Reject path separators, traversal, or invalid filename characters
    let invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
    if trimmed_name.contains("..")
        || trimmed_name
            .chars()
            .any(|c| invalid_chars.contains(&c) || c.is_control())
    {
        return Err("Name contains invalid characters".to_string());
    }

    let parent_canon = match target_canon.parent() {
        Some(p) => p
            .canonicalize()
            .map_err(|e| format!("Parent directory error: {}", e))?,
        None => return Err("Target item has no parent directory".to_string()),
    };

    if !parent_canon.starts_with(&vault_canon) {
        return Err("Parent directory escapes vault root".to_string());
    }

    let final_name = if target_canon.is_file() {
        let existing_ext = target_canon
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_lowercase());

        match existing_ext {
            Some(ext) => {
                let suffix = format!(".{}", ext);
                if trimmed_name.to_lowercase().ends_with(&suffix) {
                    trimmed_name.to_string()
                } else if trimmed_name.contains('.') {
                    let user_ext = trimmed_name.rsplit('.').next().unwrap_or("").to_lowercase();
                    if ["pdf", "ppt", "pptx", "md"].contains(&user_ext.as_str()) {
                        trimmed_name.to_string()
                    } else {
                        format!("{}.{}", trimmed_name, ext)
                    }
                } else {
                    format!("{}.{}", trimmed_name, ext)
                }
            }
            None => trimmed_name.to_string(),
        }
    } else {
        trimmed_name.to_string()
    };

    let new_dest = parent_canon.join(&final_name);

    if new_dest.exists() {
        let dest_canon = new_dest.canonicalize().unwrap_or_else(|_| new_dest.clone());
        if dest_canon != target_canon {
            return Err("An item with this name already exists in this folder".to_string());
        }
    }

    std::fs::rename(&target_canon, &new_dest)
        .map_err(|e| format!("Failed to rename item: {}", e))?;

    let new_canon = new_dest
        .canonicalize()
        .map_err(|e| format!("Failed to resolve renamed path: {}", e))?;

    if !new_canon.starts_with(&vault_canon) {
        return Err("Renamed item escapes vault boundary".to_string());
    }

    let rel_path = new_canon
        .strip_prefix(&vault_canon)
        .map_err(|e| format!("Failed to compute relative path: {}", e))?
        .to_string_lossy()
        .replace('\\', "/");

    Ok(rel_path)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VaultSummary {
    pub name: String,
    pub path: String,
    pub file_count: usize,
}

/// Creates a new vault folder inside a designated parent directory.
pub fn create_vault<P: AsRef<Path>>(parent_dir: P, vault_name: &str) -> Result<String, String> {
    let trimmed_name = vault_name.trim();
    if trimmed_name.is_empty() {
        return Err("Vault name cannot be empty".to_string());
    }
    if trimmed_name.contains('/') || trimmed_name.contains('\\') || trimmed_name.contains("..") {
        return Err("Vault name contains invalid path characters".to_string());
    }

    let parent = parent_dir.as_ref();
    if !parent.exists() {
        return Err("Default vault directory does not exist".to_string());
    }

    let parent_canon = parent
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize parent path: {}", e))?;

    if !parent_canon.is_dir() {
        return Err("Default vault parent path is not a directory".to_string());
    }

    let target_dir = parent_canon.join(trimmed_name);

    if target_dir.exists() {
        return Err(format!(
            "A vault named '{}' already exists in that folder",
            trimmed_name
        ));
    }

    std::fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create vault directory: {}", e))?;

    let canonical_target = target_dir
        .canonicalize()
        .map_err(|e| format!("Failed to resolve new vault path: {}", e))?;

    if !canonical_target.starts_with(&parent_canon) {
        return Err("Created vault escapes parent directory boundary".to_string());
    }

    Ok(canonical_target.to_string_lossy().to_string())
}

/// Lists all subvaults (first-level folders) located in the default vaults directory.
pub fn list_subvaults<P: AsRef<Path>>(parent_dir: P) -> Result<Vec<VaultSummary>, String> {
    let parent = parent_dir.as_ref();
    if !parent.exists() || !parent.is_dir() {
        return Ok(Vec::new());
    }

    let parent_canon = parent
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize parent path: {}", e))?;

    let entries = match std::fs::read_dir(&parent_canon) {
        Ok(e) => e,
        Err(_) => return Ok(Vec::new()),
    };

    let mut result = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let name = entry.file_name().to_string_lossy().to_string();
            let file_count = match scan_vault(&path) {
                Ok(scan_res) => count_vault_files(&scan_res.root_nodes),
                Err(_) => 0,
            };

            let canon_path = path.canonicalize().unwrap_or(path.clone());
            result.push(VaultSummary {
                name,
                path: canon_path.to_string_lossy().to_string(),
                file_count,
            });
        }
    }

    result.sort_by_key(|a| a.name.to_lowercase());
    Ok(result)
}

fn count_vault_files(nodes: &[VaultNode]) -> usize {
    let mut count = 0;
    for node in nodes {
        match &node.node_type {
            VaultNodeType::File(_) => count += 1,
            VaultNodeType::Folder => count += count_vault_files(&node.children),
        }
    }
    count
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

        assert_eq!(res.root_nodes.len(), 1);
        assert_eq!(res.root_nodes[0].name, "CS101");
        assert_eq!(res.root_nodes[0].children.len(), 2);

        // Verify source files are untouched
        let post_pdf_meta = fs::metadata(&pdf_path).unwrap();
        assert_eq!(initial_pdf_meta.len(), post_pdf_meta.len());
        assert_eq!(
            initial_pdf_meta.modified().unwrap(),
            post_pdf_meta.modified().unwrap()
        );
    }

    #[test]
    fn test_create_vault_and_list_subvaults() {
        let parent_dir = tempdir().unwrap();
        let parent_path = parent_dir.path();

        let v1_path = create_vault(parent_path, "Course 2026").unwrap();
        assert!(Path::new(&v1_path).exists());

        let v2_path = create_vault(parent_path, "Biology 101").unwrap();
        assert!(Path::new(&v2_path).exists());

        // Attempt invalid names
        assert!(create_vault(parent_path, "../outside").is_err());
        assert!(create_vault(parent_path, "  ").is_err());
        assert!(create_vault(parent_path, "Course 2026").is_err()); // duplicate

        let subvaults = list_subvaults(parent_path).unwrap();
        assert_eq!(subvaults.len(), 2);
        assert_eq!(subvaults[0].name, "Biology 101");
        assert_eq!(subvaults[1].name, "Course 2026");
    }

    #[test]
    fn test_rename_item_file_and_folder() {
        let dir = tempdir().unwrap();
        let root_path = dir.path();

        let course_dir = root_path.join("CS101");
        fs::create_dir(&course_dir).unwrap();

        let pdf_path = course_dir.join("lecture1.pdf");
        {
            let mut pdf_file = File::create(&pdf_path).unwrap();
            pdf_file.write_all(b"%PDF-1.4 dummy content").unwrap();
        }

        // 1. Rename file without extension in input -> keeps .pdf
        let new_rel = rename_item(root_path, "CS101/lecture1.pdf", "Lecture 01 - Intro").unwrap();
        assert_eq!(new_rel, "CS101/Lecture 01 - Intro.pdf");
        assert!(!pdf_path.exists());
        assert!(course_dir.join("Lecture 01 - Intro.pdf").exists());

        // 2. Rename file with explicit extension
        let new_rel_2 =
            rename_item(root_path, "CS101/Lecture 01 - Intro.pdf", "lec1_final.pdf").unwrap();
        assert_eq!(new_rel_2, "CS101/lec1_final.pdf");
        assert!(course_dir.join("lec1_final.pdf").exists());

        // 3. Rename folder
        let new_folder_rel = rename_item(root_path, "CS101", "Computer Science 101").unwrap();
        assert_eq!(new_folder_rel, "Computer Science 101");
        assert!(!course_dir.exists());
        let new_course_dir = root_path.join("Computer Science 101");
        assert!(new_course_dir.exists());
        assert!(new_course_dir.join("lec1_final.pdf").exists());

        // 4. Test error cases: invalid chars, path traversal, collision
        assert!(rename_item(root_path, "Computer Science 101", "../escape").is_err());
        assert!(rename_item(root_path, "Computer Science 101", "invalid/slash").is_err());
        assert!(rename_item(root_path, "Computer Science 101", "  ").is_err());

        // Create collision target
        let other_dir = root_path.join("OtherCourse");
        fs::create_dir(&other_dir).unwrap();
        assert!(rename_item(root_path, "Computer Science 101", "OtherCourse").is_err());
    }
}
