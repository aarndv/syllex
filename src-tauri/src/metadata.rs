use rusqlite::{params, Connection, OptionalExtension};
use std::path::{Path, PathBuf};
use tauri::Manager;

const SCHEMA_VERSION: i64 = 1;

fn migrate(connection: &mut Connection) -> Result<(), String> {
    let version: i64 = connection
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

pub fn move_progress(
    app: &tauri::AppHandle,
    old_path: &Path,
    new_path: &Path,
) -> Result<(), String> {
    let path = database_path(app)?;
    if !path.exists() {
        return Ok(());
    }
    let mut connection = open_at(&path)?;
    let paths = {
        let mut statement = connection
            .prepare("SELECT document_path FROM reading_progress")
            .map_err(|_| "Could not read reading positions".to_string())?;
        let rows = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|_| "Could not read reading positions".to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|_| "Could not read reading positions".to_string())?
    };
    let transaction = connection
        .transaction()
        .map_err(|_| "Could not start progress move".to_string())?;
    for path in paths {
        if let Ok(suffix) = Path::new(&path).strip_prefix(old_path) {
            let destination = new_path.join(suffix).to_string_lossy().into_owned();
            transaction
                .execute(
                    "UPDATE reading_progress SET document_path = ?1 WHERE document_path = ?2",
                    params![destination, path],
                )
                .map_err(|_| "Could not move reading position".to_string())?;
        }
    }
    transaction
        .commit()
        .map_err(|_| "Could not commit progress move".to_string())?;
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
        assert_eq!(version, 1);
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
}
