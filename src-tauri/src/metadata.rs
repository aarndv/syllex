use crate::vault::{HiddenItem, VaultNode, VaultNodeType, VaultScanResult};
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::Manager;

const SCHEMA_VERSION: i64 = 2;

fn migrate(connection: &mut Connection) -> Result<(), String> {
    let mut version: i64 = connection
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|_| "Could not read metadata database version".to_string())?;
    if version > SCHEMA_VERSION {
        return Err("Metadata database was created by a newer Syllex version".to_string());
    }
    if version == 0 {
        let transaction = connection
            .transaction()
            .map_err(|_| "Could not start metadata migration".to_string())?;
        transaction
            .execute_batch(
                "CREATE TABLE settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                CREATE TABLE reading_progress (
                    document_path TEXT PRIMARY KEY,
                    last_page INTEGER NOT NULL CHECK (last_page > 0)
                );
                PRAGMA user_version = 1;",
            )
            .map_err(|_| "Could not migrate metadata database".to_string())?;
        transaction
            .commit()
            .map_err(|_| "Could not commit metadata migration".to_string())?;
        version = 1;
    }
    if version == 1 {
        let transaction = connection
            .transaction()
            .map_err(|_| "Could not start library metadata migration".to_string())?;
        transaction
            .execute_batch(
                "CREATE TABLE library_overrides (
                    vault_root TEXT NOT NULL,
                    relative_path TEXT NOT NULL,
                    display_name TEXT,
                    hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
                    is_folder INTEGER NOT NULL DEFAULT 0 CHECK (is_folder IN (0, 1)),
                    PRIMARY KEY(vault_root, relative_path)
                );
                PRAGMA user_version = 2;",
            )
            .map_err(|_| "Could not migrate library metadata".to_string())?;
        transaction
            .commit()
            .map_err(|_| "Could not commit library metadata migration".to_string())?;
    }
    Ok(())
}

fn open_at(path: &Path) -> Result<Connection, String> {
    let mut connection =
        Connection::open(path).map_err(|_| "Could not open metadata database".to_string())?;
    connection
        .busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|_| "Could not configure metadata database".to_string())?;
    migrate(&mut connection)?;
    Ok(connection)
}

fn database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "Could not locate application data".to_string())?;
    std::fs::create_dir_all(&data_dir)
        .map_err(|_| "Could not create application data directory".to_string())?;
    Ok(data_dir.join("metadata.sqlite3"))
}

fn open_for_app(app: &tauri::AppHandle) -> Result<Connection, String> {
    open_at(&database_path(app)?)
}

fn validated_document(vault_root: &str, relative_path: &str) -> Result<PathBuf, String> {
    let root = Path::new(vault_root)
        .canonicalize()
        .map_err(|_| "Selected vault is unavailable".to_string())?;
    let document = root
        .join(relative_path)
        .canonicalize()
        .map_err(|_| "Document is unavailable".to_string())?;
    if !document.starts_with(&root) || !document.is_file() {
        return Err("Document is outside the selected vault".to_string());
    }
    Ok(document)
}

fn validated_item(vault_root: &str, relative_path: &str) -> Result<(String, String, bool), String> {
    let root = Path::new(vault_root)
        .canonicalize()
        .map_err(|_| "Selected vault is unavailable".to_string())?;
    if !root.is_dir() {
        return Err("Selected vault is not a directory".to_string());
    }
    let relative = Path::new(relative_path);
    if relative.as_os_str().is_empty()
        || relative
            .components()
            .any(|part| !matches!(part, std::path::Component::Normal(_)))
    {
        return Err("Invalid item path".to_string());
    }
    let item = root
        .join(relative)
        .canonicalize()
        .map_err(|_| "Item is unavailable".to_string())?;
    if !item.starts_with(&root) || item == root {
        return Err("Item is outside the selected vault".to_string());
    }
    let canonical_relative = item
        .strip_prefix(&root)
        .map_err(|_| "Invalid item path".to_string())?;
    Ok((
        root.to_string_lossy().into_owned(),
        canonical_relative.to_string_lossy().into_owned(),
        item.is_dir(),
    ))
}

fn validated_key(vault_root: &str, relative_path: &str) -> Result<(String, String), String> {
    let root = Path::new(vault_root)
        .canonicalize()
        .map_err(|_| "Selected vault is unavailable".to_string())?;
    if !root.is_dir() {
        return Err("Selected vault is not a directory".to_string());
    }
    let relative = Path::new(relative_path);
    if relative.as_os_str().is_empty()
        || relative
            .components()
            .any(|part| !matches!(part, std::path::Component::Normal(_)))
    {
        return Err("Invalid item path".to_string());
    }
    Ok((
        root.to_string_lossy().into_owned(),
        relative.to_string_lossy().into_owned(),
    ))
}

pub fn set_item_display_name(
    app: &tauri::AppHandle,
    vault_root: &str,
    relative_path: &str,
    display_name: &str,
) -> Result<(), String> {
    let name = display_name.trim();
    if name.is_empty() || name.chars().count() > 255 || name.chars().any(char::is_control) {
        return Err("Display name must be 1–255 visible characters".to_string());
    }
    let (root, relative, is_folder) = validated_item(vault_root, relative_path)?;
    let connection = open_for_app(app)?;
    connection
        .execute(
            "INSERT INTO library_overrides(vault_root, relative_path, display_name, hidden, is_folder) VALUES (?1, ?2, ?3, 0, ?4)
             ON CONFLICT(vault_root, relative_path) DO UPDATE SET display_name = excluded.display_name",
            params![root, relative, name, is_folder],
        )
        .map_err(|_| "Could not save display name".to_string())?;
    Ok(())
}

pub fn set_item_hidden(
    app: &tauri::AppHandle,
    vault_root: &str,
    relative_path: &str,
    hidden: bool,
) -> Result<(), String> {
    let connection = open_for_app(app)?;
    if hidden {
        let (root, relative, is_folder) = validated_item(vault_root, relative_path)?;
        connection
            .execute(
                "INSERT INTO library_overrides(vault_root, relative_path, hidden, is_folder) VALUES (?1, ?2, 1, ?3)
                 ON CONFLICT(vault_root, relative_path) DO UPDATE SET hidden = 1, is_folder = excluded.is_folder",
                params![root, relative, is_folder],
            )
            .map_err(|_| "Could not hide library item".to_string())?;
    } else {
        let (root, relative) = validated_key(vault_root, relative_path)?;
        connection
            .execute("UPDATE library_overrides SET hidden = 0 WHERE vault_root = ?1 AND relative_path = ?2", params![root, relative])
            .map_err(|_| "Could not restore library item".to_string())?;
    }
    Ok(())
}

pub fn apply_library_overrides(
    app: &tauri::AppHandle,
    scan: &mut VaultScanResult,
) -> Result<(), String> {
    let connection = open_for_app(app)?;
    let mut statement = connection
        .prepare("SELECT relative_path, display_name, hidden, is_folder FROM library_overrides WHERE vault_root = ?1")
        .map_err(|_| "Could not read library settings".to_string())?;
    let rows = statement
        .query_map(params![&scan.root_path], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, bool>(2)?,
                row.get::<_, bool>(3)?,
            ))
        })
        .map_err(|_| "Could not read library settings".to_string())?;
    let mut overrides = HashMap::new();
    for row in rows {
        let (relative, name, hidden, is_folder) =
            row.map_err(|_| "Could not read library settings".to_string())?;
        if hidden {
            let fallback = Path::new(&relative)
                .file_name()
                .map(|name| name.to_string_lossy().into_owned())
                .unwrap_or_else(|| relative.clone());
            scan.hidden_items.push(HiddenItem {
                relative_path: relative.clone(),
                name: name.clone().unwrap_or(fallback),
                is_folder,
            });
        }
        overrides.insert(relative, (name, hidden));
    }
    scan.hidden_items
        .sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    apply_overrides_to_nodes(&mut scan.root_nodes, &overrides);
    Ok(())
}

fn apply_overrides_to_nodes(
    nodes: &mut Vec<VaultNode>,
    overrides: &HashMap<String, (Option<String>, bool)>,
) {
    nodes.retain_mut(|node| {
        if let Some((name, hidden)) = overrides.get(&node.relative_path) {
            if *hidden {
                return false;
            }
            if let Some(name) = name {
                node.name = name.clone();
            }
        }
        if node.node_type == VaultNodeType::Folder {
            apply_overrides_to_nodes(&mut node.children, overrides);
        }
        true
    });
}

fn selected_vault_at(connection: &Connection) -> Result<Option<String>, String> {
    connection
        .query_row(
            "SELECT value FROM settings WHERE key = 'selected_vault'",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|_| "Could not read selected vault".to_string())
}

pub fn selected_vault(app: &tauri::AppHandle) -> Result<Option<String>, String> {
    selected_vault_at(&open_for_app(app)?)
}

pub fn set_selected_vault(
    app: &tauri::AppHandle,
    path: Option<String>,
) -> Result<Option<String>, String> {
    let canonical = match path {
        Some(path) => {
            let root = Path::new(&path)
                .canonicalize()
                .map_err(|_| "Selected vault is unavailable".to_string())?;
            if !root.is_dir() {
                return Err("Selected vault is not a directory".to_string());
            }
            Some(root.to_string_lossy().into_owned())
        }
        None => None,
    };
    let connection = open_for_app(app)?;
    if let Some(path) = &canonical {
        connection
            .execute("INSERT INTO settings(key, value) VALUES ('selected_vault', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value", params![path])
            .map_err(|_| "Could not save selected vault".to_string())?;
    } else {
        connection
            .execute("DELETE FROM settings WHERE key = 'selected_vault'", [])
            .map_err(|_| "Could not clear selected vault".to_string())?;
    }
    Ok(canonical)
}

fn progress_at(connection: &Connection, document: &Path) -> Result<Option<u32>, String> {
    connection
        .query_row(
            "SELECT last_page FROM reading_progress WHERE document_path = ?1",
            params![document.to_string_lossy()],
            |row| row.get(0),
        )
        .optional()
        .map_err(|_| "Could not read reading position".to_string())
}

pub fn reading_progress(
    app: &tauri::AppHandle,
    vault_root: &str,
    relative_path: &str,
) -> Result<Option<u32>, String> {
    let document = validated_document(vault_root, relative_path)?;
    progress_at(&open_for_app(app)?, &document)
}

pub fn save_reading_progress(
    app: &tauri::AppHandle,
    vault_root: &str,
    relative_path: &str,
    page: u32,
) -> Result<(), String> {
    if page == 0 {
        return Err("Page number must be positive".to_string());
    }
    let document = validated_document(vault_root, relative_path)?;
    let connection = open_for_app(app)?;
    connection
        .execute(
            "INSERT INTO reading_progress(document_path, last_page) VALUES (?1, ?2) ON CONFLICT(document_path) DO UPDATE SET last_page = excluded.last_page",
            params![document.to_string_lossy(), page],
        )
        .map_err(|_| "Could not save reading position".to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migration_and_vault_scoped_progress() {
        let dir = tempfile::tempdir().unwrap();
        let mut connection = open_at(&dir.path().join("metadata.sqlite3")).unwrap();
        let version: i64 = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 2);
        assert_eq!(selected_vault_at(&connection).unwrap(), None);
        let first = dir.path().join("a").join("same.pdf");
        let second = dir.path().join("b").join("same.pdf");
        connection
            .execute(
                "INSERT INTO reading_progress VALUES (?1, 7)",
                params![first.to_string_lossy()],
            )
            .unwrap();
        assert_eq!(progress_at(&connection, &first).unwrap(), Some(7));
        assert_eq!(progress_at(&connection, &second).unwrap(), None);
        migrate(&mut connection).unwrap();
    }

    #[test]
    fn library_overrides_hide_and_alias_without_changing_paths() {
        let mut nodes = vec![VaultNode {
            name: "CS101".into(),
            relative_path: "CS101".into(),
            node_type: VaultNodeType::Folder,
            size_bytes: None,
            children: vec![VaultNode {
                name: "lecture.pdf".into(),
                relative_path: "CS101/lecture.pdf".into(),
                node_type: VaultNodeType::File(crate::vault::ModuleFileType::Pdf),
                size_bytes: Some(5),
                children: vec![],
            }],
        }];
        let mut overrides = HashMap::new();
        overrides.insert("CS101".into(), (Some("Computer Science".into()), false));
        overrides.insert("CS101/lecture.pdf".into(), (None, true));
        apply_overrides_to_nodes(&mut nodes, &overrides);
        assert_eq!(nodes[0].name, "Computer Science");
        assert_eq!(nodes[0].relative_path, "CS101");
        assert!(nodes[0].children.is_empty());
        overrides.insert("CS101".into(), (None, true));
        apply_overrides_to_nodes(&mut nodes, &overrides);
        assert!(nodes.is_empty());
    }

    #[test]
    fn upgrades_version_one_without_losing_reading_progress() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("metadata.sqlite3");
        let connection = Connection::open(&path).unwrap();
        connection.execute_batch("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE reading_progress (document_path TEXT PRIMARY KEY, last_page INTEGER NOT NULL CHECK (last_page > 0));
            INSERT INTO reading_progress VALUES ('module.pdf', 9);
            PRAGMA user_version = 1;").unwrap();
        drop(connection);
        let upgraded = open_at(&path).unwrap();
        let version: i64 = upgraded
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 2);
        assert_eq!(
            progress_at(&upgraded, Path::new("module.pdf")).unwrap(),
            Some(9)
        );
    }
}
