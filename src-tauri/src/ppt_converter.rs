use sha2::{Digest, Sha256};
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{AppHandle, Manager};

const CONVERSION_CACHE_VERSION: &str = "2";
static NEXT_CONVERSION_ID: AtomicU64 = AtomicU64::new(0);

/// Detect LibreOffice binary on the system (Fedora / Linux and Windows 11).
pub fn detect_libreoffice() -> Option<PathBuf> {
    // 1. Try PATH resolution via 'soffice' or 'libreoffice'
    if let Ok(path) = which_binary("soffice") {
        return Some(path);
    }
    if let Ok(path) = which_binary("libreoffice") {
        return Some(path);
    }

    // 2. Check standard Linux install paths
    let linux_paths = [
        "/usr/bin/soffice",
        "/usr/bin/libreoffice",
        "/usr/local/bin/soffice",
        "/usr/local/bin/libreoffice",
    ];
    for p in linux_paths {
        let pb = PathBuf::from(p);
        if pb.exists() && pb.is_file() {
            return Some(pb);
        }
    }

    // 3. Check standard Windows install paths
    #[cfg(target_os = "windows")]
    {
        let win_paths = [
            r"C:\Program Files\LibreOffice\program\soffice.exe",
            r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        ];
        for p in win_paths {
            let pb = PathBuf::from(p);
            if pb.exists() && pb.is_file() {
                return Some(pb);
            }
        }
    }

    None
}

/// Simple helper to find binary in PATH using `which` or `where` command
fn which_binary(name: &str) -> Result<PathBuf, String> {
    #[cfg(not(target_os = "windows"))]
    let cmd = "which";
    #[cfg(target_os = "windows")]
    let cmd = "where";

    let output = Command::new(cmd)
        .arg(name)
        .output()
        .map_err(|e| format!("Failed to run {}: {}", cmd, e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Some(first_line) = stdout.lines().next() {
            let trimmed = first_line.trim();
            if !trimmed.is_empty() {
                let pb = PathBuf::from(trimmed);
                if pb.exists() {
                    return Ok(pb);
                }
            }
        }
    }

    Err(format!("Binary '{}' not found in PATH", name))
}

/// Compute SHA-256 fingerprint of a file for cache key lookup
pub fn compute_file_fingerprint(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|e| format!("Failed to read file for hashing: {}", e))?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let result = hasher.finalize();
    Ok(format!("{:x}", result))
}

fn cache_file_name(fingerprint: &str) -> String {
    format!("v{CONVERSION_CACHE_VERSION}-{fingerprint}.pdf")
}

fn is_pdf(bytes: &[u8]) -> bool {
    bytes.starts_with(b"%PDF-")
}

fn create_unique_temp_dir(cache_dir: &Path, fingerprint: &str) -> Result<PathBuf, String> {
    loop {
        let conversion_id = NEXT_CONVERSION_ID.fetch_add(1, Ordering::Relaxed);
        let path = cache_dir.join(format!(
            "temp_{fingerprint}_{}_{}",
            std::process::id(),
            conversion_id
        ));

        match fs::create_dir(&path) {
            Ok(()) => return Ok(path),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(format!("Failed to create temporary output dir: {error}"));
            }
        }
    }
}

fn libreoffice_profile_arg(profile_dir: &Path) -> Result<OsString, String> {
    let profile_url = tauri::Url::from_directory_path(profile_dir)
        .map_err(|_| "Failed to create LibreOffice profile URL".to_string())?;
    Ok(OsString::from(format!(
        "-env:UserInstallation={profile_url}"
    )))
}

fn libreoffice_conversion_args(
    profile_arg: OsString,
    output_dir: &Path,
    source_path: &Path,
) -> Vec<OsString> {
    vec![
        OsString::from("--headless"),
        OsString::from("--norestore"),
        OsString::from("--nofirststartwizard"),
        profile_arg,
        OsString::from("--convert-to"),
        OsString::from("pdf:impress_pdf_Export"),
        OsString::from("--outdir"),
        output_dir.as_os_str().to_owned(),
        source_path.as_os_str().to_owned(),
    ]
}

/// Get local application cache directory for converted PDFs
pub fn get_ppt_cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("Failed to resolve app cache dir: {}", e))?
        .join("ppt_pdf_cache");

    if !cache_dir.exists() {
        fs::create_dir_all(&cache_dir)
            .map_err(|e| format!("Failed to create PPT cache directory: {}", e))?;
    }

    Ok(cache_dir)
}

/// Convert PPT / PPTX file to cached PDF using headless LibreOffice.
/// Reuses cached conversion if SHA-256 fingerprint matches.
pub fn convert_ppt_to_pdf(
    app: &AppHandle,
    vault_root: &str,
    relative_path: &str,
) -> Result<Vec<u8>, String> {
    // 1. Validate paths safely
    let root = PathBuf::from(vault_root);
    if !root.exists() || !root.is_dir() {
        return Err("Invalid vault root path".into());
    }

    let target_path = root.join(relative_path);
    if !target_path.exists() || !target_path.is_file() {
        return Err(format!("Source file does not exist: {}", relative_path));
    }

    let canon_root = root
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize vault root: {}", e))?;
    let canon_target = target_path
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize target file: {}", e))?;

    if !canon_target.starts_with(&canon_root) {
        return Err("Security error: Target path is outside the selected vault directory".into());
    }

    // 2. Compute fingerprint & check cache
    let fingerprint = compute_file_fingerprint(&canon_target)?;
    let cache_dir = get_ppt_cache_dir(app)?;
    let cached_pdf_path = cache_dir.join(cache_file_name(&fingerprint));

    if let Ok(bytes) = fs::read(&cached_pdf_path) {
        if is_pdf(&bytes) {
            return Ok(bytes);
        }

        // A partial cache write must never be treated as a converted document.
        let _ = fs::remove_file(&cached_pdf_path);
    }

    // 3. Detect LibreOffice
    let lo_bin = detect_libreoffice().ok_or_else(|| {
        "LibreOffice is not installed or could not be found. Please install LibreOffice to preview PowerPoint files locally.".to_string()
    })?;

    // 4. Create isolated temporary directory for conversion
    let temp_out_dir = create_unique_temp_dir(&cache_dir, &fingerprint)?;

    let conversion_result = (|| -> Result<Vec<u8>, String> {
        // 5. Execute LibreOffice through an argument array. Each conversion
        // gets an isolated profile and output directory so concurrent preview
        // and search requests cannot delete or lock each other's files.
        let profile_dir = temp_out_dir.join("profile");
        fs::create_dir_all(&profile_dir)
            .map_err(|e| format!("Failed to create LibreOffice profile: {}", e))?;
        let profile_arg = libreoffice_profile_arg(&profile_dir)?;
        let args = libreoffice_conversion_args(profile_arg, &temp_out_dir, &canon_target);

        let output = Command::new(&lo_bin)
            .args(args)
            .output()
            .map_err(|e| format!("Failed to execute LibreOffice subprocess: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!(
                "LibreOffice conversion failed: {}",
                if stderr.trim().is_empty() {
                    "Unknown conversion error"
                } else {
                    stderr.trim()
                }
            ));
        }

        // 6. Find and validate the output before publishing it to the cache.
        let entries = fs::read_dir(&temp_out_dir)
            .map_err(|e| format!("Failed to read temporary output dir: {}", e))?;

        let generated_pdf = entries.flatten().map(|entry| entry.path()).find(|path| {
            path.is_file()
                && path
                    .extension()
                    .is_some_and(|ext| ext.eq_ignore_ascii_case("pdf"))
        });

        let generated_pdf = generated_pdf.ok_or_else(|| {
            "LibreOffice completed but no PDF output file was produced.".to_string()
        })?;
        let pdf_bytes = fs::read(&generated_pdf)
            .map_err(|e| format!("Failed to read generated PDF bytes: {}", e))?;

        if !is_pdf(&pdf_bytes) {
            return Err("LibreOffice produced an invalid PDF preview.".to_string());
        }

        // The source and destination are on the same cache filesystem, making
        // the rename atomic. If a concurrent conversion won the race, its
        // valid cache entry is equivalent and can be reused.
        if let Err(rename_error) = fs::rename(&generated_pdf, &cached_pdf_path) {
            let concurrent_cache_is_valid = fs::read(&cached_pdf_path)
                .map(|bytes| is_pdf(&bytes))
                .unwrap_or(false);
            if !concurrent_cache_is_valid {
                return Err(format!("Failed to cache converted PDF: {rename_error}"));
            }
        }

        Ok(pdf_bytes)
    })();

    let _ = fs::remove_dir_all(&temp_out_dir);
    conversion_result
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_compute_file_fingerprint() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.pptx");
        fs::write(&file_path, b"dummy pptx content").unwrap();

        let fp = compute_file_fingerprint(&file_path).unwrap();
        assert_eq!(fp.len(), 64); // SHA-256 hex string length
    }

    #[test]
    fn cache_name_is_versioned() {
        let fingerprint = "a".repeat(64);
        assert_eq!(
            cache_file_name(&fingerprint),
            format!("v{CONVERSION_CACHE_VERSION}-{fingerprint}.pdf")
        );
    }

    #[test]
    fn validates_pdf_signature() {
        assert!(is_pdf(b"%PDF-1.7\n"));
        assert!(!is_pdf(b""));
        assert!(!is_pdf(b"not a pdf"));
    }

    #[test]
    fn concurrent_conversions_get_distinct_temp_directories() {
        let dir = tempdir().unwrap();
        let first = create_unique_temp_dir(dir.path(), "fingerprint").unwrap();
        let second = create_unique_temp_dir(dir.path(), "fingerprint").unwrap();

        assert_ne!(first, second);
        assert!(first.is_dir());
        assert!(second.is_dir());
    }

    #[test]
    fn conversion_args_use_impress_filter_and_preserve_paths() {
        let dir = tempdir().unwrap();
        let profile_dir = dir.path().join("profile with spaces");
        fs::create_dir_all(&profile_dir).unwrap();
        let source_path = dir.path().join("slides with spaces.pptx");
        let profile_arg = libreoffice_profile_arg(&profile_dir).unwrap();
        let profile_arg_text = profile_arg.to_string_lossy();
        assert!(profile_arg_text.starts_with("-env:UserInstallation=file:"));
        assert!(profile_arg_text.contains("profile%20with%20spaces"));

        let args = libreoffice_conversion_args(profile_arg, dir.path(), &source_path);
        assert!(args.iter().any(|arg| arg == "pdf:impress_pdf_Export"));
        assert_eq!(args.last(), Some(&source_path.into_os_string()));
    }
}
