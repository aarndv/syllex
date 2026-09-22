use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Manager};

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
    let cached_pdf_path = cache_dir.join(format!("{}.pdf", fingerprint));

    if cached_pdf_path.exists() && cached_pdf_path.is_file() {
        if let Ok(bytes) = fs::read(&cached_pdf_path) {
            if !bytes.is_empty() {
                return Ok(bytes);
            }
        }
    }

    // 3. Detect LibreOffice
    let lo_bin = detect_libreoffice().ok_or_else(|| {
        "LibreOffice is not installed or could not be found. Please install LibreOffice to preview PowerPoint files locally.".to_string()
    })?;

    // 4. Create isolated temporary directory for conversion
    let temp_out_dir = cache_dir.join(format!("temp_{}", fingerprint));
    if temp_out_dir.exists() {
        let _ = fs::remove_dir_all(&temp_out_dir);
    }
    fs::create_dir_all(&temp_out_dir)
        .map_err(|e| format!("Failed to create temporary output dir: {}", e))?;

    // 5. Execute LibreOffice conversion safely via argument array with isolated profile and Impress PDF export filter
    let profile_dir = temp_out_dir.join("profile");
    let _ = fs::create_dir_all(&profile_dir);
    let user_install_arg = format!(
        "-env:UserInstallation=file://{}",
        profile_dir.to_string_lossy().replace('\\', "/")
    );

    let output = Command::new(&lo_bin)
        .arg("--headless")
        .arg("--norestore")
        .arg("--nofirststartwizard")
        .arg(&user_install_arg)
        .arg("--convert-to")
        .arg("pdf:impress_pdf_Export")
        .arg("--outdir")
        .arg(&temp_out_dir)
        .arg(&canon_target)
        .output()
        .map_err(|e| format!("Failed to execute LibreOffice subprocess: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let _ = fs::remove_dir_all(&temp_out_dir);
        return Err(format!(
            "LibreOffice conversion failed: {}",
            if stderr.trim().is_empty() {
                "Unknown conversion error"
            } else {
                stderr.trim()
            }
        ));
    }

    // 6. Find output PDF in temp directory
    let entries = fs::read_dir(&temp_out_dir)
        .map_err(|e| format!("Failed to read temporary output dir: {}", e))?;

    let mut generated_pdf: Option<PathBuf> = None;
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_file()
            && p.extension()
                .is_some_and(|ext| ext.eq_ignore_ascii_case("pdf"))
        {
            generated_pdf = Some(p);
            break;
        }
    }

    let gen_pdf_path = generated_pdf.ok_or_else(|| {
        let _ = fs::remove_dir_all(&temp_out_dir);
        "LibreOffice completed but no PDF output file was produced.".to_string()
    })?;

    // 7. Copy generated PDF to permanent cache path and return bytes
    let pdf_bytes = fs::read(&gen_pdf_path)
        .map_err(|e| format!("Failed to read generated PDF bytes: {}", e))?;

    let _ = fs::copy(&gen_pdf_path, &cached_pdf_path);
    let _ = fs::remove_dir_all(&temp_out_dir);

    Ok(pdf_bytes)
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
}
