//! Versioned study data owned by a vault. Existing SQLite data is migrated in #17.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

const MANIFEST: &str = "manifest.json";
const FORMAT: &str = "syllex-portable";
const VERSION: u32 = 1;
const MAX_RECORD_BYTES: u64 = 16 * 1024 * 1024;

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Manifest {
    format: String,
    version: u32,
    path_format: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Record {
    version: u32,
    data: Value,
}

#[derive(Clone, Copy)]
pub enum RecordKind {
    Cards,
    Study,
}

impl RecordKind {
    fn name(self) -> &'static str {
        match self {
            Self::Cards => "cards.json",
            Self::Study => "study.json",
        }
    }
}

fn root_path(root: &Path) -> Result<PathBuf, String> {
    let root = root
        .canonicalize()
        .map_err(|_| "Selected vault is unavailable".to_string())?;
    if !root.is_dir() {
        return Err("Selected vault is not a directory".into());
    }
    Ok(root)
}

fn read_bounded(path: &Path, max: u64) -> Result<Option<Vec<u8>>, String> {
    match path.symlink_metadata() {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Could not inspect portable data: {error}")),
        Ok(meta) if !meta.file_type().is_file() => {
            return Err("Portable data entry must be a regular file".into())
        }
        _ => {}
    }
    let file = File::open(path).map_err(|e| format!("Could not read portable data: {e}"))?;
    if file
        .metadata()
        .map_err(|e| format!("Could not inspect portable data: {e}"))?
        .len()
        > max
    {
        return Err("Portable data file is too large".into());
    }
    let mut bytes = Vec::new();
    file.take(max + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| format!("Could not read portable data: {e}"))?;
    if bytes.len() as u64 > max {
        return Err("Portable data file is too large".into());
    }
    Ok(Some(bytes))
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let dir = path.parent().ok_or("Portable data parent is missing")?;
    let mut staged = tempfile::NamedTempFile::new_in(dir)
        .map_err(|e| format!("Could not stage portable data: {e}"))?;
    staged
        .write_all(bytes)
        .map_err(|e| format!("Could not write portable data: {e}"))?;
    staged
        .as_file()
        .sync_all()
        .map_err(|e| format!("Could not sync portable data: {e}"))?;
    staged
        .persist(path)
        .map_err(|e| format!("Could not publish portable data: {}", e.error))?;
    Ok(())
}

fn backup_path(path: &Path) -> PathBuf {
    path.with_extension("json.bak")
}

/// Creates or validates the managed directory and manifest. A corrupt or newer
/// manifest is left intact, so the library can report recovery guidance.
pub fn ensure(root: &Path) -> Result<PathBuf, String> {
    let root = root_path(root)?;
    let dir = crate::folder_order::managed_dir(&root, true)?
        .ok_or("Could not locate Syllex-managed data")?;
    if dir
        .symlink_metadata()
        .map_err(|_| "Managed directory is unavailable")?
        .file_type()
        .is_symlink()
    {
        return Err("Managed directory must not be a link".into());
    }
    let path = dir.join(MANIFEST);
    match read_bounded(&path, 64 * 1024)? {
        Some(bytes) => {
            let manifest: Manifest = serde_json::from_slice(&bytes)
                .map_err(|_| "Manifest is invalid; original data was preserved".to_string())?;
            if manifest.format != FORMAT
                || manifest.path_format != "vault-relative-posix-v1"
                || manifest.version != VERSION
            {
                return Err(
                    "Manifest uses an unsupported format or version; original data was preserved"
                        .into(),
                );
            }
            if read_bounded(&backup_path(&path), 64 * 1024)?.is_none() {
                atomic_write(&backup_path(&path), &bytes)?;
            }
        }
        None => {
            let manifest = Manifest {
                format: FORMAT.into(),
                version: VERSION,
                path_format: "vault-relative-posix-v1".into(),
            };
            let bytes = serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?;
            atomic_write(&path, &bytes)?;
            atomic_write(&backup_path(&path), &bytes)?;
        }
    }
    Ok(dir)
}

/// Portable paths use `/` regardless of host OS and preserve exact case. A
/// missing referenced module remains unlinked rather than being reassigned.
pub fn validate_module_identity(path: &str) -> Result<(), String> {
    fn invalid_part(part: &str) -> bool {
        let stem = part.split('.').next().unwrap_or("").to_ascii_uppercase();
        let reserved = [
            "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7",
            "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
        ];
        part.is_empty()
            || part == "."
            || part == ".."
            || part.ends_with([' ', '.'])
            || part
                .chars()
                .any(|c| c.is_control() || "<>:\"|?*".contains(c))
            || reserved.contains(&stem.as_str())
    }
    if path.is_empty()
        || path.starts_with('/')
        || path.contains('\\')
        || path.contains('\0')
        || path.split('/').any(invalid_part)
    {
        return Err("Module identity must be a vault-relative POSIX path".into());
    }
    Ok(())
}

fn record_path(root: &Path, kind: RecordKind) -> Result<PathBuf, String> {
    let dir = ensure(root)?;
    let records = dir.join("records");
    match records.symlink_metadata() {
        Ok(meta) if !meta.file_type().is_dir() => {
            return Err("Portable records directory is not a regular directory".into())
        }
        Ok(_) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => fs::create_dir(&records)
            .map_err(|e| format!("Could not create portable records directory: {e}"))?,
        Err(e) => return Err(format!("Could not inspect portable records: {e}")),
    }
    Ok(records.join(kind.name()))
}

fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

/// Reads a versioned record and its revision. Missing records are not created.
pub fn read_record(root: &Path, kind: RecordKind) -> Result<Option<(Value, String)>, String> {
    let path = record_path(root, kind)?;
    let Some(bytes) = read_bounded(&path, MAX_RECORD_BYTES)? else {
        return Ok(None);
    };
    let record: Record = serde_json::from_slice(&bytes)
        .map_err(|_| "Portable record is invalid; original data was preserved".to_string())?;
    if record.version != VERSION {
        return Err(
            "Portable record uses an unsupported version; original data was preserved".into(),
        );
    }
    Ok(Some((record.data, digest(&bytes))))
}

/// Compare-and-swap avoids replacing edits made since the caller last read.
/// `None` means the record must not already exist.
pub fn write_record(
    root: &Path,
    kind: RecordKind,
    data: &Value,
    expected_revision: Option<&str>,
) -> Result<String, String> {
    let path = record_path(root, kind)?;
    let existing = read_record(root, kind)?;
    if existing.as_ref().map(|(_, revision)| revision.as_str()) != expected_revision {
        return Err("Portable data changed outside Syllex; reload before saving".into());
    }
    let bytes = serde_json::to_vec_pretty(&Record {
        version: VERSION,
        data: data.clone(),
    })
    .map_err(|e| format!("Could not encode portable data: {e}"))?;
    if bytes.len() as u64 > MAX_RECORD_BYTES {
        return Err("Portable record is too large".into());
    }
    if let Some(previous_bytes) = read_bounded(&path, MAX_RECORD_BYTES)? {
        if Some(digest(&previous_bytes).as_str()) != expected_revision {
            return Err("Portable data changed outside Syllex; reload before saving".into());
        }
        atomic_write(&backup_path(&path), &previous_bytes)?;
    } else {
        atomic_write(&backup_path(&path), &bytes)?;
    }
    atomic_write(&path, &bytes)?;
    Ok(digest(&bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn empty_and_colliding_vaults_initialize_and_copy() {
        let source = tempfile::tempdir().unwrap();
        fs::create_dir(source.path().join(".syllex")).unwrap();
        fs::write(source.path().join(".syllex/private.md"), "untouched").unwrap();
        let dir = ensure(source.path()).unwrap();
        assert_eq!(dir.file_name().unwrap(), ".syllex-1");
        assert_eq!(
            fs::read_to_string(source.path().join(".syllex/private.md")).unwrap(),
            "untouched"
        );
        assert_eq!(
            crate::vault::scan_vault(source.path())
                .unwrap()
                .root_nodes
                .len(),
            1
        );
        let copied = tempfile::tempdir().unwrap();
        fs::create_dir(copied.path().join(".syllex-1")).unwrap();
        for name in ["owner", MANIFEST] {
            fs::copy(dir.join(name), copied.path().join(".syllex-1").join(name)).unwrap();
        }
        assert_eq!(
            ensure(copied.path()).unwrap().file_name().unwrap(),
            ".syllex-1"
        );
    }

    #[test]
    fn rejects_bad_versions_and_preserves_previous_bytes() {
        let root = tempfile::tempdir().unwrap();
        let dir = ensure(root.path()).unwrap();
        let path = dir.join(MANIFEST);
        assert!(backup_path(&path).exists());
        let newer =
            br#"{"format":"syllex-portable","version":99,"path_format":"vault-relative-posix-v1"}"#;
        fs::write(&path, newer).unwrap();
        assert!(ensure(root.path()).unwrap_err().contains("unsupported"));
        assert_eq!(fs::read(&path).unwrap(), newer);
        fs::write(&path, b"broken").unwrap();
        assert!(ensure(root.path()).unwrap_err().contains("invalid"));
        assert_eq!(fs::read(&path).unwrap(), b"broken");
        assert!(serde_json::from_slice::<Manifest>(&fs::read(backup_path(&path)).unwrap()).is_ok());
    }

    #[test]
    fn record_write_is_atomic_and_rejects_stale_or_corrupt_data() {
        let root = tempfile::tempdir().unwrap();
        let first =
            write_record(root.path(), RecordKind::Cards, &json!({"decks": []}), None).unwrap();
        let path = ensure(root.path()).unwrap().join("records/cards.json");
        fs::write(
            path.parent().unwrap().join(".abandoned-stage"),
            b"incomplete",
        )
        .unwrap();
        assert!(
            write_record(root.path(), RecordKind::Cards, &json!({"decks": [1]}), None).is_err()
        );
        assert_eq!(
            read_record(root.path(), RecordKind::Cards)
                .unwrap()
                .unwrap()
                .1,
            first
        );
        let second = write_record(
            root.path(),
            RecordKind::Cards,
            &json!({"decks": [1]}),
            Some(&first),
        )
        .unwrap();
        assert_ne!(first, second);
        assert_eq!(digest(&fs::read(backup_path(&path)).unwrap()), first);
        assert_eq!(
            fs::read(path.parent().unwrap().join(".abandoned-stage")).unwrap(),
            b"incomplete"
        );
        fs::write(&path, b"invalid").unwrap();
        assert!(write_record(root.path(), RecordKind::Cards, &json!({}), Some(&second)).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"invalid");
    }

    #[test]
    fn rejects_links_and_nonportable_module_identities() {
        let root = tempfile::tempdir().unwrap();
        assert!(validate_module_identity("Course/Unit 1/Notes.md").is_ok());
        for bad in [
            "",
            "/absolute.md",
            "../escape.md",
            "a//b.md",
            "C:/file.md",
            "a\\b.md",
            "CON.md",
            "a/ends. ",
        ] {
            assert!(validate_module_identity(bad).is_err());
        }
        let dir = ensure(root.path()).unwrap();
        #[cfg(unix)]
        {
            fs::create_dir(root.path().join("outside")).unwrap();
            std::os::unix::fs::symlink(root.path().join("outside"), dir.join("records")).unwrap();
            assert!(read_record(root.path(), RecordKind::Study).is_err());
        }
    }
}
