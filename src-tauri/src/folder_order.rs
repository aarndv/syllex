use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Component, Path, PathBuf};

const MARKER: &str = "syllex-folder-order-v1";
const FILE_NAME: &str = "folder-order.json";

#[derive(Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct OrderFile {
    version: u32,
    parents: HashMap<String, Vec<String>>,
}

fn is_owned(path: &Path) -> bool {
    path.is_dir()
        && !path.is_symlink()
        && !path.join("owner").is_symlink()
        && fs::read_to_string(path.join("owner")).is_ok_and(|value| value == MARKER)
}

pub fn is_managed_dir(path: &Path) -> bool {
    is_owned(path)
}

pub fn managed_dir(root: &Path, create: bool) -> Result<Option<PathBuf>, String> {
    let entries = fs::read_dir(root).map_err(|_| "Could not inspect vault data".to_string())?;
    let mut entries: Vec<_> = entries.flatten().collect();
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        if entry.file_name().to_string_lossy().starts_with(".syllex") && is_owned(&entry.path()) {
            return Ok(Some(entry.path()));
        }
    }
    if !create {
        return Ok(None);
    }
    for index in 0..100 {
        let name = if index == 0 {
            ".syllex".to_string()
        } else {
            format!(".syllex-{}", index)
        };
        let path = root.join(name);
        if path.symlink_metadata().is_ok() {
            continue;
        }
        fs::create_dir(&path)
            .map_err(|_| "Could not create Syllex vault data directory".to_string())?;
        fs::write(path.join("owner"), MARKER)
            .map_err(|_| "Could not mark Syllex vault data directory".to_string())?;
        return Ok(Some(path));
    }
    Err("Could not find a free Syllex vault data directory".to_string())
}

fn load_file(dir: &Path) -> Result<OrderFile, String> {
    let path = dir.join(FILE_NAME);
    if path.symlink_metadata().is_err() {
        return Ok(OrderFile {
            version: 1,
            parents: HashMap::new(),
        });
    }
    if path.is_symlink() {
        return Err("Folder order file must not be a link".to_string());
    }
    let bytes = fs::read(path).map_err(|_| "Could not read folder order".to_string())?;
    if bytes.len() > 1_000_000 {
        return Err("Folder order file is too large".to_string());
    }
    let data: OrderFile =
        serde_json::from_slice(&bytes).map_err(|_| "Folder order file is invalid".to_string())?;
    if data.version != 1 {
        return Err("Folder order file uses an unsupported version".to_string());
    }
    for (parent, children) in &data.parents {
        if !parent.is_empty() {
            validate_relative(parent)?;
        }
        for child in children {
            validate_relative(child)?;
        }
    }
    Ok(data)
}

fn validate_relative(path: &str) -> Result<(), String> {
    if path.contains('\\')
        || Path::new(path)
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
    {
        return Err("Folder path is invalid".to_string());
    }
    Ok(())
}

pub fn list(vault_root: &str) -> Result<HashMap<String, Vec<String>>, String> {
    let root = Path::new(vault_root)
        .canonicalize()
        .map_err(|_| "Vault is unavailable".to_string())?;
    Ok(match managed_dir(&root, false)? {
        Some(dir) => load_file(&dir)?.parents,
        None => HashMap::new(),
    })
}

pub fn save(vault_root: &str, parent_path: &str, folder_paths: Vec<String>) -> Result<(), String> {
    let root = Path::new(vault_root)
        .canonicalize()
        .map_err(|_| "Vault is unavailable".to_string())?;
    if !root.is_dir() {
        return Err("Vault is not a folder".to_string());
    }
    let parent_key = parent_path.replace('\\', "/");
    let parent = if parent_key.is_empty() {
        root.clone()
    } else {
        validate_relative(&parent_key)?;
        root.join(&parent_key)
            .canonicalize()
            .map_err(|_| "Parent folder is unavailable".to_string())?
    };
    if !parent.starts_with(&root) || !parent.is_dir() {
        return Err("Parent folder is outside vault".to_string());
    }
    let mut seen = HashSet::new();
    let normalized_paths: Vec<String> = folder_paths
        .iter()
        .map(|path| path.replace('\\', "/"))
        .collect();
    for relative in &normalized_paths {
        validate_relative(relative)?;
        if !seen.insert(relative) {
            return Err("Folder order contains duplicates".to_string());
        }
        let candidate = root.join(relative);
        if candidate.is_symlink() {
            return Err("Linked folders cannot be reordered".to_string());
        }
        let canonical = candidate
            .canonicalize()
            .map_err(|_| "Folder is unavailable".to_string())?;
        if !canonical.is_dir()
            || canonical.parent() != Some(parent.as_path())
            || !canonical.starts_with(&root)
        {
            return Err("Only sibling folders can be reordered".to_string());
        }
    }
    let dir = managed_dir(&root, true)?.ok_or("Syllex vault data directory is unavailable")?;
    let mut data = load_file(&dir)?;
    data.parents.insert(parent_key, normalized_paths);
    let mut staged = tempfile::NamedTempFile::new_in(&dir)
        .map_err(|_| "Could not stage folder order".to_string())?;
    serde_json::to_writer_pretty(&mut staged, &data)
        .map_err(|_| "Could not encode folder order".to_string())?;
    staged
        .persist(dir.join(FILE_NAME))
        .map_err(|_| "Could not save folder order".to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saves_nested_order_and_survives_vault_copy() {
        let source = tempfile::tempdir().unwrap();
        for name in ["Course", "Course/A", "Course/B"] {
            fs::create_dir(source.path().join(name)).unwrap();
        }
        save(
            source.path().to_str().unwrap(),
            "Course",
            vec!["Course/B".into(), "Course/A".into()],
        )
        .unwrap();
        assert_eq!(
            list(source.path().to_str().unwrap()).unwrap()["Course"],
            vec!["Course/B", "Course/A"]
        );
        save(
            source.path().to_str().unwrap(),
            "Course",
            vec!["Course/A".into(), "Course/B".into()],
        )
        .unwrap();
        assert_eq!(
            list(source.path().to_str().unwrap()).unwrap()["Course"],
            vec!["Course/A", "Course/B"]
        );
        assert_eq!(
            crate::vault::scan_vault(source.path())
                .unwrap()
                .root_nodes
                .len(),
            1
        );

        let copied = tempfile::tempdir().unwrap();
        fs::create_dir(copied.path().join(".syllex")).unwrap();
        fs::copy(
            source.path().join(".syllex/owner"),
            copied.path().join(".syllex/owner"),
        )
        .unwrap();
        fs::copy(
            source.path().join(".syllex/folder-order.json"),
            copied.path().join(".syllex/folder-order.json"),
        )
        .unwrap();
        assert_eq!(
            list(copied.path().to_str().unwrap()).unwrap()["Course"],
            vec!["Course/A", "Course/B"]
        );
        assert!(source.path().join("Course/A").is_dir());
    }

    #[test]
    fn rejects_cross_parent_and_preserves_unrelated_syllex_directory() {
        let vault = tempfile::tempdir().unwrap();
        fs::create_dir(vault.path().join(".syllex")).unwrap();
        fs::write(vault.path().join(".syllex/private.md"), "untouched").unwrap();
        fs::create_dir(vault.path().join("A")).unwrap();
        fs::create_dir(vault.path().join("B")).unwrap();
        assert!(save(vault.path().to_str().unwrap(), "A", vec!["B".into()]).is_err());
        assert!(save(
            vault.path().to_str().unwrap(),
            "",
            vec!["../outside".into()]
        )
        .is_err());
        save(
            vault.path().to_str().unwrap(),
            "",
            vec!["B".into(), "A".into()],
        )
        .unwrap();
        assert_eq!(
            fs::read_to_string(vault.path().join(".syllex/private.md")).unwrap(),
            "untouched"
        );
        assert!(vault.path().join(".syllex-1/folder-order.json").exists());
    }
}
