use cap_std::ambient_authority;
use cap_std::fs::{Dir, OpenOptions};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Component, Path};

fn is_link_or_reparse_point(metadata: &std::fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
        metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
    }
    #[cfg(not(windows))]
    {
        metadata.file_type().is_symlink()
    }
}

fn is_cap_link_or_reparse_point(metadata: &cap_std::fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use cap_std::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
        metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
    }
    #[cfg(not(windows))]
    {
        metadata.is_symlink()
    }
}

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
    std::fs::read_dir(&canonical_root)
        .map_err(|_| "Could not read selected vault folder".to_string())?;

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
            if is_link_or_reparse_point(&link_metadata) {
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

    let target_relative = match target_course_rel_path {
        Some(rel) if !rel.trim().is_empty() => {
            let relative = Path::new(&rel);
            if relative
                .components()
                .any(|part| !matches!(part, Component::Normal(_)))
            {
                return Err("Invalid course folder path".to_string());
            }
            relative.to_path_buf()
        }
        _ => std::path::PathBuf::new(),
    };
    let vault_dir = Dir::open_ambient_dir(&vault_canon, ambient_authority())
        .map_err(|_| "Selected vault is unavailable".to_string())?;
    let mut course_dir = vault_dir
        .try_clone()
        .map_err(|_| "Selected vault is unavailable".to_string())?;
    for component in target_relative.components() {
        let name = match component {
            Component::Normal(name) => name,
            _ => return Err("Invalid course folder path".to_string()),
        };
        let metadata = course_dir
            .symlink_metadata(name)
            .map_err(|_| "Course folder is unavailable".to_string())?;
        if is_cap_link_or_reparse_point(&metadata) || !metadata.is_dir() {
            return Err("Target path escapes the vault boundary".to_string());
        }
        course_dir = course_dir
            .open_dir(name)
            .map_err(|_| "Course folder is unavailable".to_string())?;
    }
    let mut input = std::fs::File::open(source)
        .map_err(|_| "Could not open the selected module".to_string())?;
    let destination = target_relative.join(&file_name);
    let size_bytes = stage_and_publish(&mut input, &vault_dir, &destination)?;
    let rel_path = destination.to_string_lossy().to_string();

    Ok(ModuleItem {
        relative_path: rel_path,
        file_name,
        file_type,
        size_bytes,
    })
}

struct StagedModule<'a> {
    vault_dir: &'a Dir,
    name: String,
    file: Option<cap_std::fs::File>,
}

impl Drop for StagedModule<'_> {
    fn drop(&mut self) {
        self.file.take();
        let _ = self.vault_dir.remove_file(&self.name);
    }
}

fn stage_and_publish(
    input: &mut impl std::io::Read,
    vault_dir: &Dir,
    destination: &Path,
) -> Result<u64, String> {
    let mut random = [0_u8; 16];
    getrandom::fill(&mut random)
        .map_err(|_| "Could not prepare a temporary module name".to_string())?;
    let staged_name = format!(".syllex-import-{:032x}.tmp", u128::from_le_bytes(random));
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    let staged = vault_dir
        .open_with(&staged_name, &options)
        .map_err(|_| "Could not stage module in the selected vault".to_string())?;
    let mut cleanup = StagedModule {
        vault_dir,
        name: staged_name,
        file: Some(staged),
    };
    let size_bytes = std::io::copy(input, cleanup.file.as_mut().unwrap())
        .map_err(|_| "Could not copy the complete module".to_string())?;
    cleanup
        .file
        .as_ref()
        .unwrap()
        .sync_all()
        .map_err(|_| "Could not finish writing the module".to_string())?;
    cleanup.file.take();
    vault_dir
        .hard_link(&cleanup.name, vault_dir, destination)
        .map_err(|err| {
            if err.kind() == std::io::ErrorKind::AlreadyExists {
                "A module with this name already exists in the course".to_string()
            } else {
                "Could not finish adding the module".to_string()
            }
        })?;
    Ok(size_bytes)
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
        let metadata = match path.symlink_metadata() {
            Ok(metadata) if !is_link_or_reparse_point(&metadata) => metadata,
            _ => continue,
        };
        if metadata.is_dir() {
            let canon_path = match path.canonicalize() {
                Ok(path) if path.starts_with(&parent_canon) => path,
                _ => continue,
            };
            let name = entry.file_name().to_string_lossy().to_string();
            let file_count = match scan_vault(&canon_path) {
                Ok(scan_res) => count_vault_files(&scan_res.root_nodes),
                Err(_) => 0,
            };

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

    #[cfg(unix)]
    #[test]
    fn scan_reports_unreadable_nested_folder_and_rejects_unreadable_root() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempdir().unwrap();
        let vault = dir.path().join("vault");
        let readable = vault.join("CS101");
        let unreadable = vault.join("Private");
        fs::create_dir_all(&readable).unwrap();
        fs::create_dir(&unreadable).unwrap();
        fs::write(readable.join("lecture.pdf"), b"module").unwrap();

        fs::set_permissions(&unreadable, fs::Permissions::from_mode(0o000)).unwrap();
        if fs::read_dir(&unreadable).is_err() {
            let result = scan_vault(&vault).unwrap();
            assert_eq!(result.root_nodes[0].name, "CS101");
            assert_eq!(result.root_nodes[0].children.len(), 1);
            assert!(result
                .warnings
                .iter()
                .any(|warning| warning.contains("Private")));
        }
        fs::set_permissions(&unreadable, fs::Permissions::from_mode(0o700)).unwrap();

        fs::set_permissions(&vault, fs::Permissions::from_mode(0o000)).unwrap();
        if fs::read_dir(&vault).is_err() {
            assert!(scan_vault(&vault).is_err());
        }
        fs::set_permissions(&vault, fs::Permissions::from_mode(0o700)).unwrap();
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

    #[test]
    fn concurrent_imports_with_same_name_publish_only_one_complete_file() {
        use std::sync::{Arc, Barrier};

        let dir = tempdir().unwrap();
        let vault = dir.path().join("vault");
        let course = vault.join("CS101");
        fs::create_dir_all(&course).unwrap();
        let source_a = dir.path().join("a").join("lecture.pdf");
        let source_b = dir.path().join("b").join("lecture.pdf");
        fs::create_dir_all(source_a.parent().unwrap()).unwrap();
        fs::create_dir_all(source_b.parent().unwrap()).unwrap();
        fs::write(&source_a, b"complete module A").unwrap();
        fs::write(&source_b, b"complete module B").unwrap();

        let barrier = Arc::new(Barrier::new(2));
        let handles = [source_a, source_b].map(|source| {
            let barrier = Arc::clone(&barrier);
            let vault = vault.clone();
            std::thread::spawn(move || {
                barrier.wait();
                add_module_to_vault(&vault, Some("CS101".into()), &source)
            })
        });
        let results = handles.map(|handle| handle.join().unwrap());
        assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
        let bytes = fs::read(course.join("lecture.pdf")).unwrap();
        assert!(bytes == b"complete module A" || bytes == b"complete module B");
        assert_eq!(fs::read_dir(&course).unwrap().count(), 1);
    }

    #[test]
    fn failed_copy_leaves_no_partial_module() {
        struct FailingReader(bool);

        impl std::io::Read for FailingReader {
            fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
                if self.0 {
                    return Err(std::io::Error::other("injected read failure"));
                }
                self.0 = true;
                let len = buffer.len().min(4);
                buffer[..len].copy_from_slice(&b"part"[..len]);
                Ok(len)
            }
        }

        let dir = tempdir().unwrap();
        let destination = dir.path().join("lecture.pdf");
        let vault_dir = Dir::open_ambient_dir(dir.path(), ambient_authority()).unwrap();
        assert!(stage_and_publish(
            &mut FailingReader(false),
            &vault_dir,
            Path::new("lecture.pdf")
        )
        .is_err());
        assert!(!destination.exists());
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 0);
    }

    #[cfg(unix)]
    #[test]
    fn import_rejects_replacement_link_to_moved_course() {
        use std::os::unix::fs::symlink;

        let dir = tempdir().unwrap();
        let vault = dir.path().join("vault");
        let course = vault.join("CS101");
        let outside = dir.path().join("outside");
        fs::create_dir(&vault).unwrap();
        fs::create_dir(&course).unwrap();
        fs::create_dir(&outside).unwrap();
        let vault_dir = Dir::open_ambient_dir(&vault, ambient_authority()).unwrap();
        fs::rename(&course, outside.join("moved-course")).unwrap();
        symlink(&outside, &course).unwrap();

        assert!(stage_and_publish(
            &mut b"complete module".as_slice(),
            &vault_dir,
            Path::new("CS101/lecture.pdf"),
        )
        .is_err());
        assert!(!outside.join("lecture.pdf").exists());
        assert!(!outside.join("moved-course/lecture.pdf").exists());
        assert_eq!(fs::read_dir(&vault).unwrap().count(), 1);
    }

    #[cfg(unix)]
    #[test]
    fn import_rejects_linked_destination_without_touching_external_file() {
        use std::os::unix::fs::symlink;

        let dir = tempdir().unwrap();
        let vault = dir.path().join("vault");
        let course = vault.join("CS101");
        let outside = dir.path().join("outside");
        fs::create_dir_all(&course).unwrap();
        fs::create_dir(&outside).unwrap();
        let source = dir.path().join("lecture.pdf");
        let external = outside.join("lecture.pdf");
        fs::write(&source, b"new module").unwrap();
        fs::write(&external, b"existing external module").unwrap();

        symlink(&outside, vault.join("LinkedCourse")).unwrap();
        assert!(add_module_to_vault(&vault, Some("LinkedCourse".into()), &source).is_err());
        assert_eq!(fs::read(&external).unwrap(), b"existing external module");

        symlink(&external, course.join("lecture.pdf")).unwrap();
        assert!(add_module_to_vault(&vault, Some("CS101".into()), &source).is_err());
        assert_eq!(fs::read(&external).unwrap(), b"existing external module");
        assert_eq!(fs::read_dir(&course).unwrap().count(), 1);
    }

    #[cfg(unix)]
    #[test]
    fn vault_manager_does_not_list_linked_directories() {
        use std::os::unix::fs::symlink;

        let dir = tempdir().unwrap();
        let parent = dir.path().join("vaults");
        let outside = dir.path().join("outside");
        fs::create_dir(&parent).unwrap();
        fs::create_dir(&outside).unwrap();
        fs::create_dir(parent.join("RealVault")).unwrap();
        symlink(&outside, parent.join("LinkedVault")).unwrap();

        let listed = list_subvaults(&parent).unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].name, "RealVault");
    }
}
