use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::Manager;

const SCHEMA_VERSION: i64 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HighlightRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Highlight {
    pub id: String,
    pub page_number: u32,
    pub color: String,
    pub rects: Vec<HighlightRect>,
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
    let supported = document
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| matches!(value.to_ascii_lowercase().as_str(), "pdf" | "ppt" | "pptx"));
    if !supported {
        return Err("Highlights require a PDF or presentation".to_string());
    }
    Ok(document)
}

fn migrate(connection: &mut Connection) -> Result<(), String> {
    let version: i64 = connection
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|_| "Could not read highlight database version".to_string())?;
    if version > SCHEMA_VERSION {
        return Err("Highlight database was created by a newer Syllex version".to_string());
    }
    if version == 0 {
        let transaction = connection
            .transaction()
            .map_err(|_| "Could not start highlight database migration".to_string())?;
        transaction
            .execute_batch(
                "CREATE TABLE highlights (
                    id TEXT PRIMARY KEY,
                    document_path TEXT NOT NULL,
                    page_number INTEGER NOT NULL CHECK (page_number > 0),
                    color TEXT NOT NULL,
                    rects_json TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX highlights_document_page ON highlights(document_path, page_number);
                PRAGMA user_version = 1;",
            )
            .map_err(|_| "Could not migrate highlight database".to_string())?;
        transaction
            .commit()
            .map_err(|_| "Could not commit highlight database migration".to_string())?;
    }
    Ok(())
}

fn open_at(path: &Path) -> Result<Connection, String> {
    let mut connection =
        Connection::open(path).map_err(|_| "Could not open highlight database".to_string())?;
    connection
        .busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|_| "Could not configure highlight database".to_string())?;
    migrate(&mut connection)?;
    Ok(connection)
}

fn open_for_app(app: &tauri::AppHandle) -> Result<Connection, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "Could not locate application data".to_string())?;
    std::fs::create_dir_all(&data_dir)
        .map_err(|_| "Could not create application data directory".to_string())?;
    open_at(&data_dir.join("highlights.sqlite3"))
}

fn validate_highlight(highlight: &Highlight) -> Result<(), String> {
    if highlight.id.len() > 64
        || highlight.id.len() < 8
        || !highlight
            .id
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() || byte == b'-')
        || highlight.page_number == 0
        || highlight.page_number > 100_000
        || !matches!(
            highlight.color.as_str(),
            "gold"
                | "yellow"
                | "orange"
                | "rose"
                | "pink"
                | "mint"
                | "lime"
                | "teal"
                | "blue"
                | "violet"
        )
        || highlight.rects.is_empty()
        || highlight.rects.len() > 128
    {
        return Err("Invalid highlight".to_string());
    }
    for rect in &highlight.rects {
        if ![rect.x, rect.y, rect.width, rect.height]
            .into_iter()
            .all(|value| value.is_finite() && (0.0..=1.0).contains(&value))
            || rect.width <= 0.0
            || rect.height <= 0.0
            || rect.x + rect.width > 1.000_001
            || rect.y + rect.height > 1.000_001
        {
            return Err("Invalid highlight geometry".to_string());
        }
    }
    Ok(())
}

pub fn list(
    app: &tauri::AppHandle,
    vault_root: &str,
    relative_path: &str,
) -> Result<Vec<Highlight>, String> {
    let document = validated_document(vault_root, relative_path)?;
    let connection = open_for_app(app)?;
    let mut statement = connection
        .prepare("SELECT id, page_number, color, rects_json FROM highlights WHERE document_path = ?1 ORDER BY created_at, rowid")
        .map_err(|_| "Could not read highlights".to_string())?;
    let rows = statement
        .query_map([document.to_string_lossy().as_ref()], |row| {
            let rects_json: String = row.get(3)?;
            let rects =
                serde_json::from_str(&rects_json).map_err(|_| rusqlite::Error::InvalidQuery)?;
            Ok(Highlight {
                id: row.get(0)?,
                page_number: row.get(1)?,
                color: row.get(2)?,
                rects,
            })
        })
        .map_err(|_| "Could not read highlights".to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|_| "Could not decode highlights".to_string())
}

pub fn insert(
    app: &tauri::AppHandle,
    vault_root: &str,
    relative_path: &str,
    highlight: Highlight,
) -> Result<(), String> {
    validate_highlight(&highlight)?;
    let document = validated_document(vault_root, relative_path)?;
    let connection = open_for_app(app)?;
    let rects_json = serde_json::to_string(&highlight.rects)
        .map_err(|_| "Could not encode highlight".to_string())?;
    connection
        .execute(
            "INSERT INTO highlights(id, document_path, page_number, color, rects_json) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![highlight.id, document.to_string_lossy(), highlight.page_number, highlight.color, rects_json],
        )
        .map_err(|_| "Could not save highlight".to_string())?;
    Ok(())
}

pub fn delete(
    app: &tauri::AppHandle,
    vault_root: &str,
    relative_path: &str,
    id: &str,
) -> Result<(), String> {
    let document = validated_document(vault_root, relative_path)?;
    let connection = open_for_app(app)?;
    connection
        .execute(
            "DELETE FROM highlights WHERE document_path = ?1 AND id = ?2",
            params![document.to_string_lossy(), id],
        )
        .map_err(|_| "Could not remove highlight".to_string())?;
    Ok(())
}

pub fn move_document(
    app: &tauri::AppHandle,
    old_path: &Path,
    new_path: &Path,
) -> Result<(), String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "Could not locate application data".to_string())?;
    let database_path = data_dir.join("highlights.sqlite3");
    if !database_path.exists() {
        return Ok(());
    }
    let mut connection = open_at(&database_path)?;
    move_paths(&mut connection, old_path, new_path)
}

fn move_paths(connection: &mut Connection, old_path: &Path, new_path: &Path) -> Result<(), String> {
    let paths = {
        let mut statement = connection
            .prepare("SELECT DISTINCT document_path FROM highlights")
            .map_err(|_| "Could not read highlight metadata".to_string())?;
        let result = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|_| "Could not read highlight metadata".to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| "Could not read highlight metadata".to_string())?;
        result
    };
    let transaction = connection
        .transaction()
        .map_err(|_| "Could not start highlight metadata move".to_string())?;
    for path in paths {
        if let Ok(suffix) = Path::new(&path).strip_prefix(old_path) {
            let destination = new_path.join(suffix);
            transaction
                .execute(
                    "UPDATE highlights SET document_path = ?1 WHERE document_path = ?2",
                    params![destination.to_string_lossy(), path],
                )
                .map_err(|_| "Could not move highlight metadata".to_string())?;
        }
    }
    transaction
        .commit()
        .map_err(|_| "Could not commit highlight metadata move".to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migration_creates_versioned_table_and_reopens() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("highlights.sqlite3");
        let connection = open_at(&path).unwrap();
        let version: i64 = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 1);
        drop(connection);
        open_at(&path).unwrap();
    }

    #[test]
    fn rejects_escape_and_bad_geometry() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("note.pdf"), b"test").unwrap();
        assert!(validated_document(dir.path().to_str().unwrap(), "../note.pdf").is_err());
        assert!(validated_document(dir.path().to_str().unwrap(), "note.pdf").is_ok());
        let highlight = Highlight {
            id: "12345678-1234".to_string(),
            page_number: 1,
            color: "gold".to_string(),
            rects: vec![HighlightRect {
                x: 0.9,
                y: 0.1,
                width: 0.2,
                height: 0.1,
            }],
        };
        assert!(validate_highlight(&highlight).is_err());
    }

    #[test]
    fn accepts_extended_highlight_palette() {
        for color in [
            "gold", "yellow", "orange", "rose", "pink", "mint", "lime", "teal", "blue", "violet",
        ] {
            let highlight = Highlight {
                id: "12345678-1234".to_string(),
                page_number: 1,
                color: color.to_string(),
                rects: vec![HighlightRect {
                    x: 0.1,
                    y: 0.1,
                    width: 0.2,
                    height: 0.1,
                }],
            };
            assert!(validate_highlight(&highlight).is_ok(), "{color}");
        }
    }

    #[test]
    fn moving_a_folder_updates_only_its_highlights() {
        let mut connection = Connection::open_in_memory().unwrap();
        migrate(&mut connection).unwrap();
        let dir = tempfile::tempdir().unwrap();
        let old = dir.path().join("course");
        let new = dir.path().join("renamed");
        let untouched = dir.path().join("course-other").join("c.pdf");
        for (id, path) in [
            ("one", old.join("a.pdf")),
            ("two", old.join("sub").join("b.pdf")),
            ("three", untouched.clone()),
        ] {
            connection.execute(
                "INSERT INTO highlights(id, document_path, page_number, color, rects_json) VALUES (?1, ?2, 1, 'gold', '[]')",
                params![id, path.to_string_lossy()],
            ).unwrap();
        }
        move_paths(&mut connection, &old, &new).unwrap();
        let mut statement = connection
            .prepare("SELECT document_path FROM highlights ORDER BY rowid")
            .unwrap();
        let paths: Vec<String> = statement
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(
            paths.iter().map(PathBuf::from).collect::<Vec<_>>(),
            [new.join("a.pdf"), new.join("sub").join("b.pdf"), untouched]
        );
    }
}
