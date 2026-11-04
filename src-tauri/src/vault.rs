use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Component, Path};

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
    pub warnings: Vec<String>,
    pub hidden_items: Vec<HiddenItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HiddenItem {
    pub relative_path: String,
    pub name: String,
    pub is_folder: bool,
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

    fn scan_dir(
        canonical_root: &Path,
        current_dir: &Path,
        visited_dirs: &mut HashSet<std::path::PathBuf>,
        warnings: &mut Vec<String>,
    ) -> Vec<VaultNode> {
        let mut nodes = Vec::new();
        let entries = match std::fs::read_dir(current_dir) {
            Ok(e) => e,
            Err(_) => {
                let relative = current_dir
                    .strip_prefix(canonical_root)
                    .unwrap_or(Path::new("."));
                warnings.push(format!("Could not read folder: {}", relative.display()));
                return nodes;
            }
        };

        let mut entries_vec = Vec::new();
        for entry in entries {
            match entry {
                Ok(entry) => entries_vec.push(entry),
                Err(_) => {
                    let relative = current_dir
                        .strip_prefix(canonical_root)
                        .unwrap_or(Path::new("."));
                    warnings.push(format!("Could not read an entry in {}", relative.display()));
                }
            }
        }
        entries_vec.sort_by_key(|e| e.file_name());

        for entry in entries_vec {
            let path = entry.path();
            let relative = path.strip_prefix(canonical_root).unwrap_or(Path::new("."));
            let link_metadata = match path.symlink_metadata() {
                Ok(metadata) => metadata,
                Err(_) => {
                    warnings.push(format!("Could not inspect entry: {}", relative.display()));
                    continue;
                }
            };
            if link_metadata.file_type().is_symlink() {
                warnings.push(format!("Skipped linked entry: {}", relative.display()));
                continue;
            }
            let canonical_path = match path.canonicalize() {
                Ok(c) => c,
                Err(_) => {
                    warnings.push(format!("Could not resolve entry: {}", relative.display()));
                    continue;
                }
            };

            if !canonical_path.starts_with(canonical_root) {
                warnings.push(format!(
                    "Skipped entry outside vault: {}",
                    relative.display()
                ));
                continue;
            }

            let metadata = link_metadata;

            let name = entry.file_name().to_string_lossy().to_string();
            let rel_path = match path.strip_prefix(canonical_root) {
                Ok(r) => r.to_string_lossy().to_string(),
                Err(_) => continue,
            };

            if metadata.is_dir() {
                if !visited_dirs.insert(canonical_path.clone()) {
                    warnings.push(format!("Skipped repeated folder: {}", relative.display()));
                    continue;
                }
                let children = scan_dir(canonical_root, &canonical_path, visited_dirs, warnings);
                nodes.push(VaultNode {
                    name,
                    relative_path: rel_path,
                    node_type: VaultNodeType::Folder,
                    size_bytes: None,
                    children,
                });
            } else if metadata.is_file() {
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

    let mut visited_dirs = HashSet::from([canonical_root.clone()]);
    let mut warnings = Vec::new();
    let root_nodes = scan_dir(
        &canonical_root,
        &canonical_root,
        &mut visited_dirs,
        &mut warnings,
    );

    Ok(VaultScanResult {
        root_path: canonical_root.to_string_lossy().to_string(),
        root_nodes,
        warnings,
        hidden_items: Vec::new(),
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
        Some(rel) if !rel.trim().is_empty() => {
            let relative = Path::new(&rel);
            if relative
                .components()
                .any(|part| !matches!(part, Component::Normal(_)))
            {
                return Err("Invalid course folder path".to_string());
            }
            vault_canon.join(relative)
        }
        _ => vault_canon.clone(),
    };
    let target_dir = target_dir
        .canonicalize()
        .map_err(|_| "Course folder is unavailable".to_string())?;
    if !target_dir.starts_with(&vault_canon) || !target_dir.is_dir() {
        return Err("Target path escapes the vault boundary".to_string());
    }
    let dest_file_path = target_dir.join(&file_name);
    let mut input = std::fs::File::open(source)
        .map_err(|_| "Could not open the selected module".to_string())?;
    let mut staged = tempfile::NamedTempFile::new_in(&target_dir)
        .map_err(|_| "Could not stage module in the selected course".to_string())?;
    std::io::copy(&mut input, &mut staged)
        .map_err(|_| "Could not copy the complete module".to_string())?;
    staged
        .as_file()
        .sync_all()
        .map_err(|_| "Could not finish writing the module".to_string())?;
    if target_dir.canonicalize().ok().as_deref() != Some(target_dir.as_path()) {
        return Err("Course folder changed during import".to_string());
    }
    staged.persist_noclobber(&dest_file_path).map_err(|err| {
        if err.error.kind() == std::io::ErrorKind::AlreadyExists {
            "A module with this name already exists in the course".to_string()
        } else {
            "Could not finish adding the module".to_string()
        }
    })?;

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
        assert!(res.warnings.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn scan_skips_cyclic_and_outside_links_without_losing_readable_modules() {
        use std::os::unix::fs::symlink;
        let dir = tempdir().unwrap();
        let vault = dir.path().join("vault");
        let course = vault.join("CS101");
        fs::create_dir_all(&course).unwrap();
        fs::write(course.join("lecture.pdf"), b"module").unwrap();
        symlink(&vault, course.join("cycle")).unwrap();
        symlink(dir.path(), course.join("outside")).unwrap();

        let result = scan_vault(&vault).unwrap();
        assert_eq!(result.root_nodes[0].children.len(), 1);
        assert_eq!(result.root_nodes[0].children[0].name, "lecture.pdf");
        assert_eq!(result.warnings.len(), 2);
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
    fn import_module_never_overwrites_and_rejects_escape() {
        let dir = tempdir().unwrap();
        let vault = dir.path().join("vault");
        let course = vault.join("CS101");
        fs::create_dir_all(&course).unwrap();
        let source = dir.path().join("lecture.pdf");
        fs::write(&source, b"new module").unwrap();
        let destination = course.join("lecture.pdf");
        fs::write(&destination, b"original module").unwrap();

        assert!(add_module_to_vault(&vault, Some("CS101".into()), &source).is_err());
        assert_eq!(fs::read(&destination).unwrap(), b"original module");
        assert!(add_module_to_vault(&vault, Some("../outside".into()), &source).is_err());
        assert!(!dir.path().join("outside").exists());

        fs::remove_file(&destination).unwrap();
        add_module_to_vault(&vault, Some("CS101".into()), &source).unwrap();
        assert_eq!(fs::read(&destination).unwrap(), b"new module");
        assert_eq!(fs::read(&source).unwrap(), b"new module");
        assert_eq!(fs::read_dir(&course).unwrap().count(), 1);
    }
}
