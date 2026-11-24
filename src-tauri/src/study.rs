use crate::{
    highlights::Highlight,
    portable::{self, RecordKind},
};
use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, HashSet},
    fs::File,
    io::Read,
    path::{Path, PathBuf},
};
use tauri::Manager;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct StudyData {
    pub highlights: BTreeMap<String, HighlightSet>,
    pub library: BTreeMap<String, LibraryEntry>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HighlightSet {
    pub sha256: String,
    pub items: Vec<Highlight>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LibraryEntry {
    pub display_name: Option<String>,
    pub hidden: bool,
    pub is_folder: bool,
    pub sha256: Option<String>,
}

fn hash_file(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|_| "Referenced module is unavailable".to_string())?;
    let mut hash = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|_| "Could not fingerprint referenced module".to_string())?;
        if count == 0 {
            break;
        }
        hash.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hash.finalize()))
}

pub fn fingerprint_file(path: &Path) -> Result<String, String> {
    hash_file(path)
}

fn relative_existing(
    root: &Path,
    path: &Path,
    folder: Option<bool>,
) -> Result<(String, PathBuf), String> {
    let absolute = path
        .canonicalize()
        .map_err(|_| format!("Referenced item is missing: {}", path.display()))?;
    if !absolute.starts_with(root) || absolute == root {
        return Err(format!(
            "Referenced item is outside the selected vault: {}",
            path.display()
        ));
    }
    if path
        .symlink_metadata()
        .is_ok_and(|m| m.file_type().is_symlink())
    {
        return Err(format!("Referenced item is a link: {}", path.display()));
    }
    if let Some(folder) = folder {
        if absolute.is_dir() != folder || (!folder && !absolute.is_file()) {
            return Err(format!("Referenced item changed type: {}", path.display()));
        }
    }
    let relative = absolute
        .strip_prefix(root)
        .map_err(|_| "Invalid module reference".to_string())?
        .components()
        .map(|c| c.as_os_str().to_string_lossy().into_owned())
        .collect::<Vec<_>>()
        .join("/");
    portable::validate_module_identity(&relative)?;
    Ok((relative, absolute))
}

fn read_legacy(root: &Path, highlights_db: &Path, metadata_db: &Path) -> Result<StudyData, String> {
    let mut data = StudyData::default();
    let mut case_keys = HashSet::new();
    if highlights_db.exists() {
        let db = Connection::open_with_flags(highlights_db, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|_| "Could not read legacy highlights".to_string())?;
        let version: i64 = db
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .map_err(|_| "Could not inspect legacy highlights".to_string())?;
        if version > 1 {
            return Err("Legacy highlights use an unsupported version".into());
        }
        if version == 1 {
            let mut query = db.prepare("SELECT id, document_path, page_number, color, rects_json FROM highlights ORDER BY created_at, rowid")
                .map_err(|_| "Could not read legacy highlights".to_string())?;
            let rows = query
                .query_map([], |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, u32>(2)?,
                        r.get::<_, String>(3)?,
                        r.get::<_, String>(4)?,
                    ))
                })
                .map_err(|_| "Could not read legacy highlights".to_string())?;
            for row in rows {
                let (id, path, page_number, color, rects) =
                    row.map_err(|_| "Could not decode legacy highlights".to_string())?;
                let source = Path::new(&path);
                if !source.starts_with(root) {
                    continue;
                }
                let (relative, absolute) = relative_existing(root, source, Some(false))?;
                if !["pdf", "ppt", "pptx"].contains(
                    &absolute
                        .extension()
                        .and_then(|e| e.to_str())
                        .unwrap_or("")
                        .to_ascii_lowercase()
                        .as_str(),
                ) {
                    return Err(format!(
                        "Highlight references an unsupported module: {relative}"
                    ));
                }
                if !data.highlights.contains_key(&relative)
                    && !case_keys.insert(relative.to_lowercase())
                {
                    return Err(format!(
                        "Case-colliding module references require recovery: {relative}"
                    ));
                }
                let item = Highlight {
                    id,
                    page_number,
                    color,
                    rects: serde_json::from_str(&rects)
                        .map_err(|_| "Legacy highlight geometry is invalid".to_string())?,
                };
                crate::highlights::validate_highlight(&item)?;
                let entry = data
                    .highlights
                    .entry(relative)
                    .or_insert_with(|| HighlightSet {
                        sha256: String::new(),
                        items: Vec::new(),
                    });
                if entry.sha256.is_empty() {
                    entry.sha256 = hash_file(&absolute)?;
                }
                entry.items.push(item);
            }
        }
    }
    if metadata_db.exists() {
        let db = Connection::open_with_flags(metadata_db, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|_| "Could not read legacy library metadata".to_string())?;
        let version: i64 = db
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .map_err(|_| "Could not inspect legacy library metadata".to_string())?;
        if version > 2 {
            return Err("Legacy library metadata uses an unsupported version".into());
        }
        if version == 2 {
            let mut query = db.prepare("SELECT relative_path, display_name, hidden, is_folder FROM library_overrides WHERE vault_root = ?1")
                .map_err(|_| "Could not read legacy library metadata".to_string())?;
            let rows = query
                .query_map([root.to_string_lossy().as_ref()], |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, Option<String>>(1)?,
                        r.get::<_, bool>(2)?,
                        r.get::<_, bool>(3)?,
                    ))
                })
                .map_err(|_| "Could not read legacy library metadata".to_string())?;
            let mut library_cases = HashSet::new();
            for row in rows {
                let (path, display_name, hidden, is_folder) =
                    row.map_err(|_| "Could not decode legacy library metadata".to_string())?;
                let normalized = if cfg!(windows) {
                    path.replace('\\', "/")
                } else {
                    path.clone()
                };
                portable::validate_module_identity(&normalized)?;
                let (relative, absolute) =
                    relative_existing(root, &root.join(&normalized), Some(is_folder))?;
                if relative != normalized {
                    return Err(format!(
                        "Library path changed or points through a link: {path}"
                    ));
                }
                if !library_cases.insert(relative.to_lowercase()) {
                    return Err(format!(
                        "Case-colliding library references require recovery: {relative}"
                    ));
                }
                if display_name.as_ref().is_some_and(|s| {
                    s.trim().is_empty()
                        || s.chars().count() > 255
                        || s.chars().any(char::is_control)
                }) {
                    return Err(format!("Invalid display name for {relative}"));
                }
                data.library.insert(
                    relative,
                    LibraryEntry {
                        display_name,
                        hidden,
                        is_folder,
                        sha256: if is_folder {
                            None
                        } else {
                            Some(hash_file(&absolute)?)
                        },
                    },
                );
            }
        }
    }
    Ok(data)
}

fn decode(value: serde_json::Value) -> Result<StudyData, String> {
    let data: StudyData = serde_json::from_value(value)
        .map_err(|_| "Portable study data is invalid; legacy data remains available".to_string())?;
    let mut paths = std::collections::HashMap::<String, String>::new();
    for (path, set) in &data.highlights {
        portable::validate_module_identity(path)?;
        if !["pdf", "ppt", "pptx"].contains(
            &Path::new(path)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_ascii_lowercase()
                .as_str(),
        ) {
            return Err("Portable highlight references an unsupported module".into());
        }
        if set.sha256.len() != 64 || !set.sha256.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err("Portable highlight fingerprint is invalid".into());
        }
        let mut ids = HashSet::new();
        for item in &set.items {
            crate::highlights::validate_highlight(item)?;
            if !ids.insert(&item.id) {
                return Err("Portable highlight IDs are duplicated".into());
            }
        }
        paths.insert(path.to_lowercase(), path.clone());
    }
    for (path, entry) in &data.library {
        portable::validate_module_identity(path)?;
        if let Some(existing) = paths.insert(path.to_lowercase(), path.clone()) {
            if existing != *path {
                return Err("Portable module paths collide by case".into());
            }
        }
        if entry.display_name.as_ref().is_some_and(|name| {
            name.trim().is_empty()
                || name.chars().count() > 255
                || name.chars().any(char::is_control)
        }) {
            return Err("Portable display name is invalid".into());
        }
        if entry.is_folder != entry.sha256.is_none()
            || entry
                .sha256
                .as_ref()
                .is_some_and(|sha| sha.len() != 64 || !sha.bytes().all(|b| b.is_ascii_hexdigit()))
        {
            return Err("Portable library fingerprint is invalid".into());
        }
    }
    Ok(data)
}

pub fn read(root: &Path) -> Result<Option<(StudyData, String)>, String> {
    portable::read_record(root, RecordKind::Study)?
        .map(|(value, revision)| Ok((decode(value)?, revision)))
        .transpose()
}

pub fn save(root: &Path, data: &StudyData, revision: Option<&str>) -> Result<String, String> {
    let value =
        serde_json::to_value(data).map_err(|_| "Could not encode study data".to_string())?;
    decode(value.clone())?;
    portable::write_record(root, RecordKind::Study, &value, revision)
}

pub fn ensure_migrated(
    root: &Path,
    highlights_db: &Path,
    metadata_db: &Path,
) -> Result<(), String> {
    let root = root
        .canonicalize()
        .map_err(|_| "Selected vault is unavailable".to_string())?;
    if read(&root)?.is_some() {
        return Ok(());
    }
    let data = read_legacy(&root, highlights_db, metadata_db)?;
    save(&root, &data, None)?;
    let verified = read(&root)?
        .ok_or("Could not verify portable study data")?
        .0;
    if verified != data {
        return Err(
            "Portable study data verification failed; legacy data remains available".into(),
        );
    }
    Ok(())
}

pub fn ensure_for_app(app: &tauri::AppHandle, root: &Path) -> Result<(), String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "Could not locate application data".to_string())?;
    ensure_migrated(
        root,
        &data_dir.join("highlights.sqlite3"),
        &data_dir.join("metadata.sqlite3"),
    )
}

pub fn selected_read(
    app: &tauri::AppHandle,
    root: &Path,
) -> Result<Option<(StudyData, String)>, String> {
    let root = root
        .canonicalize()
        .map_err(|_| "Selected vault is unavailable".to_string())?;
    if crate::metadata::selected_vault(app)?.as_deref() != Some(root.to_string_lossy().as_ref()) {
        return Err("Study data is outside the selected vault".into());
    }
    read(&root)
}

pub fn fingerprint_matches(root: &Path, relative: &str, expected: &str) -> Result<bool, String> {
    let (_, path) = relative_existing(root, &root.join(relative), Some(false))?;
    Ok(hash_file(&path)? == expected)
}

pub fn library_entry_matches(root: &Path, relative: &str, entry: &LibraryEntry) -> bool {
    let Ok((resolved, path)) = relative_existing(root, &root.join(relative), Some(entry.is_folder))
    else {
        return false;
    };
    if resolved != relative {
        return false;
    }
    if entry.is_folder {
        true
    } else {
        entry
            .sha256
            .as_deref()
            .is_some_and(|hash| hash_file(&path).is_ok_and(|actual| actual == hash))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;
    #[test]
    fn migrates_populated_databases_once_and_keeps_legacy_sources() {
        let root = tempfile::tempdir().unwrap();
        let app_data = tempfile::tempdir().unwrap();
        let module = root.path().join("lecture.pdf");
        std::fs::write(&module, b"original").unwrap();
        let h_path = app_data.path().join("highlights.sqlite3");
        let h = Connection::open(&h_path).unwrap();
        h.execute_batch("CREATE TABLE highlights(id TEXT PRIMARY KEY, document_path TEXT, page_number INTEGER, color TEXT, rects_json TEXT, created_at TEXT); PRAGMA user_version=1;").unwrap();
        h.execute("INSERT INTO highlights VALUES (?1, ?2, 1, 'gold', '[{\"x\":0.1,\"y\":0.1,\"width\":0.2,\"height\":0.2}]', 'now')", params!["12345678-1234", module.to_string_lossy()]).unwrap();
        let m_path = app_data.path().join("metadata.sqlite3");
        let m = Connection::open(&m_path).unwrap();
        m.execute_batch("CREATE TABLE library_overrides(vault_root TEXT, relative_path TEXT, display_name TEXT, hidden INTEGER, is_folder INTEGER); PRAGMA user_version=2;").unwrap();
        m.execute(
            "INSERT INTO library_overrides VALUES (?1, 'lecture.pdf', 'Lecture', 1, 0)",
            params![root.path().to_string_lossy()],
        )
        .unwrap();
        ensure_migrated(root.path(), &h_path, &m_path).unwrap();
        let (mut data, revision) = read(root.path()).unwrap().unwrap();
        assert_eq!(data.highlights["lecture.pdf"].items[0].color, "gold");
        assert_eq!(
            data.library["lecture.pdf"].display_name.as_deref(),
            Some("Lecture")
        );
        assert!(data.library["lecture.pdf"].hidden);
        data.library.get_mut("lecture.pdf").unwrap().display_name = Some("New".into());
        save(root.path(), &data, Some(&revision)).unwrap();
        ensure_migrated(root.path(), &h_path, &m_path).unwrap();
        assert_eq!(
            read(root.path()).unwrap().unwrap().0.library["lecture.pdf"]
                .display_name
                .as_deref(),
            Some("New")
        );
        assert!(h_path.exists() && m_path.exists());
        assert_eq!(std::fs::read(module).unwrap(), b"original");
    }

    #[test]
    fn missing_reference_blocks_migration_without_partial_snapshot() {
        let root = tempfile::tempdir().unwrap();
        let app_data = tempfile::tempdir().unwrap();
        let m_path = app_data.path().join("metadata.sqlite3");
        let m = Connection::open(&m_path).unwrap();
        m.execute_batch("CREATE TABLE library_overrides(vault_root TEXT, relative_path TEXT, display_name TEXT, hidden INTEGER, is_folder INTEGER); PRAGMA user_version=2;").unwrap();
        m.execute(
            "INSERT INTO library_overrides VALUES (?1, 'missing.pdf', 'Missing', 1, 0)",
            params![root.path().to_string_lossy()],
        )
        .unwrap();
        assert!(
            ensure_migrated(root.path(), &app_data.path().join("none.sqlite3"), &m_path).is_err()
        );
        assert!(read(root.path()).unwrap().is_none());
        assert!(m_path.exists());
    }

    #[test]
    fn copied_snapshot_uses_relative_paths_and_detects_changed_source() {
        let source = tempfile::tempdir().unwrap();
        let copied = tempfile::tempdir().unwrap();
        std::fs::write(source.path().join("same.pdf"), b"first").unwrap();
        let mut data = StudyData::default();
        data.library.insert(
            "same.pdf".into(),
            LibraryEntry {
                display_name: Some("Reading".into()),
                hidden: false,
                is_folder: false,
                sha256: Some(hash_file(&source.path().join("same.pdf")).unwrap()),
            },
        );
        save(source.path(), &data, None).unwrap();
        let managed = crate::portable::ensure(source.path()).unwrap();
        let destination = copied.path().join(managed.file_name().unwrap());
        std::fs::create_dir_all(destination.join("records")).unwrap();
        for file in ["owner", "manifest.json"] {
            std::fs::copy(managed.join(file), destination.join(file)).unwrap();
        }
        std::fs::copy(
            managed.join("records/study.json"),
            destination.join("records/study.json"),
        )
        .unwrap();
        std::fs::write(copied.path().join("same.pdf"), b"first").unwrap();
        let copied_data = read(copied.path()).unwrap().unwrap().0;
        assert!(library_entry_matches(
            copied.path(),
            "same.pdf",
            &copied_data.library["same.pdf"]
        ));
        std::fs::write(copied.path().join("same.pdf"), b"different").unwrap();
        assert!(!library_entry_matches(
            copied.path(),
            "same.pdf",
            &copied_data.library["same.pdf"]
        ));
    }

    #[test]
    fn invalid_portable_reference_is_rejected_before_use() {
        let bad = serde_json::json!({"highlights": {}, "library": {"../outside.pdf": {"display_name": "Bad", "hidden": true, "is_folder": false, "sha256": "0".repeat(64)}}});
        assert!(decode(bad).is_err());
    }

    #[test]
    fn empty_legacy_state_creates_readable_portable_snapshot() {
        let root = tempfile::tempdir().unwrap();
        let app_data = tempfile::tempdir().unwrap();
        ensure_migrated(
            root.path(),
            &app_data.path().join("absent-highlights.sqlite3"),
            &app_data.path().join("absent-metadata.sqlite3"),
        )
        .unwrap();
        let (data, _) = read(root.path()).unwrap().unwrap();
        assert!(data.highlights.is_empty() && data.library.is_empty());
    }
}
