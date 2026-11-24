use std::path::{Component, Path, PathBuf};

#[derive(Debug, serde::Serialize)]
pub struct MarkdownModule {
    pub content: String,
}

pub fn read_markdown(root: &Path, relative_path: &str) -> Result<MarkdownModule, String> {
    let file = validated_module(root, relative_path)?;
    if !file
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("md"))
    {
        return Err("The selected module is not Markdown".into());
    }
    let handle =
        std::fs::File::open(&file).map_err(|e| format!("Could not open Markdown module: {e}"))?;
    const MAX_MARKDOWN_BYTES: u64 = 8 * 1024 * 1024;
    if handle
        .metadata()
        .map_err(|e| format!("Could not inspect Markdown module: {e}"))?
        .len()
        > MAX_MARKDOWN_BYTES
    {
        return Err("Markdown module is too large to display (8 MiB limit)".into());
    }
    use std::io::Read;
    let mut bytes = Vec::new();
    handle
        .take(MAX_MARKDOWN_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| format!("Could not read Markdown module: {e}"))?;
    if bytes.len() as u64 > MAX_MARKDOWN_BYTES {
        return Err("Markdown module is too large to display (8 MiB limit)".into());
    }
    let content =
        String::from_utf8(bytes).map_err(|_| "Markdown module is not valid UTF-8".to_string())?;
    Ok(MarkdownModule { content })
}

pub fn validated_module(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let relative = Path::new(relative_path);
    if relative.as_os_str().is_empty()
        || !relative
            .components()
            .all(|part| matches!(part, Component::Normal(_)))
    {
        return Err("Module path must be inside the selected vault".into());
    }
    let root = root
        .canonicalize()
        .map_err(|_| "Selected vault is unavailable".to_string())?;
    if !root.is_dir() {
        return Err("Selected vault is not a directory".into());
    }
    let file = root
        .join(relative)
        .canonicalize()
        .map_err(|_| "Original file is missing. Refresh the vault and try again".to_string())?;
    if !file.starts_with(&root) || !file.is_file() {
        return Err("Module path must be a file inside the selected vault".into());
    }
    let supported = file
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| {
            ["pdf", "ppt", "pptx", "md"].contains(&ext.to_ascii_lowercase().as_str())
        });
    if !supported {
        return Err("This file type is not a supported module".into());
    }
    Ok(file)
}

#[cfg(target_os = "linux")]
pub fn open_in_system_app(_app: &tauri::AppHandle, file: &Path) -> Result<(), String> {
    let status = std::process::Command::new("xdg-open")
        .arg(file)
        .status()
        .map_err(|e| format!("Could not start the system file opener: {e}"))?;
    if status.success() {
        Ok(())
    } else {
        Err("No system application could open this file. Check its default application.".into())
    }
}

#[cfg(not(target_os = "linux"))]
pub fn open_in_system_app(app: &tauri::AppHandle, file: &Path) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_path(file.to_string_lossy().into_owned(), None::<String>)
        .map_err(|e| format!("Could not open the original file in a system application: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accepts_supported_files_and_rejects_escape_or_stale_paths() {
        let root = tempfile::tempdir().unwrap();
        for name in ["notes.md", "slides.ppt", "slides.pptx", "paper.pdf"] {
            std::fs::write(root.path().join(name), b"unchanged").unwrap();
            assert_eq!(
                validated_module(root.path(), name).unwrap(),
                root.path().join(name)
            );
        }
        assert!(validated_module(root.path(), "../notes.md").is_err());
        assert!(validated_module(root.path(), "missing.pdf").is_err());
        std::fs::write(root.path().join("script.sh"), b"unchanged").unwrap();
        assert!(validated_module(root.path(), "script.sh").is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlink_to_file_outside_vault() {
        let root = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        std::fs::write(outside.path().join("external.pdf"), b"unchanged").unwrap();
        std::os::unix::fs::symlink(
            outside.path().join("external.pdf"),
            root.path().join("linked.pdf"),
        )
        .unwrap();
        assert!(validated_module(root.path(), "linked.pdf").is_err());
    }

    #[test]
    fn reads_only_valid_utf8_markdown_without_writing() {
        let root = tempfile::tempdir().unwrap();
        let file = root.path().join("note.md");
        std::fs::write(&file, b"# Hello").unwrap();
        assert_eq!(
            read_markdown(root.path(), "note.md").unwrap().content,
            "# Hello"
        );
        assert_eq!(std::fs::read(&file).unwrap(), b"# Hello");
        std::fs::write(&file, [0xff]).unwrap();
        assert!(read_markdown(root.path(), "note.md").is_err());
        std::fs::write(root.path().join("other.pdf"), b"data").unwrap();
        assert!(read_markdown(root.path(), "other.pdf").is_err());
        assert!(read_markdown(root.path(), "missing.md").is_err());
        std::fs::OpenOptions::new()
            .write(true)
            .open(&file)
            .unwrap()
            .set_len(8 * 1024 * 1024 + 1)
            .unwrap();
        assert!(read_markdown(root.path(), "note.md")
            .unwrap_err()
            .contains("too large"));
    }
}
