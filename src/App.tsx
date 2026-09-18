import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { VaultScanResult, CourseItem, ModuleItem } from "./types/vault";
import "./App.css";

const VAULT_STORAGE_KEY = "syllex_selected_vault_path";

function App() {
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<VaultScanResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedPath = localStorage.getItem(VAULT_STORAGE_KEY);
    if (savedPath) {
      setVaultPath(savedPath);
      scanVault(savedPath);
    }
  }, []);

  async function scanVault(path: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await invoke<VaultScanResult>("scan_vault", { path });
      setScanResult(res);
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Failed to scan vault");
      setScanResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectVault() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Course Vault Directory",
      });

      if (selected && typeof selected === "string") {
        setVaultPath(selected);
        localStorage.setItem(VAULT_STORAGE_KEY, selected);
        await scanVault(selected);
      }
    } catch (err: any) {
      setError(err.message || "Failed to select directory");
    }
  }

  function handleClearVault() {
    localStorage.removeItem(VAULT_STORAGE_KEY);
    setVaultPath(null);
    setScanResult(null);
    setError(null);
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>Syllex</h1>
        <div className="vault-actions">
          <button onClick={handleSelectVault} className="primary-btn">
            {vaultPath ? "Change Vault" : "Select Vault"}
          </button>
          {vaultPath && (
            <button onClick={handleClearVault} className="secondary-btn">
              Close Vault
            </button>
          )}
        </div>
      </header>

      <main className="app-content">
        {error && (
          <div className="error-banner">
            <p><strong>Error:</strong> {error}</p>
          </div>
        )}

        {!vaultPath && !loading && (
          <div className="empty-state">
            <h2>No Vault Selected</h2>
            <p>Select a local folder containing your college course modules to get started.</p>
            <button onClick={handleSelectVault} className="primary-btn large">
              Open Vault Directory
            </button>
          </div>
        )}

        {loading && (
          <div className="loading-state">
            <p>Scanning vault modules...</p>
          </div>
        )}

        {scanResult && !loading && (
          <div className="vault-view">
            <div className="vault-info">
              <h3>Vault Root: <code>{scanResult.root_path}</code></h3>
            </div>

            {scanResult.courses.length === 0 && scanResult.root_modules.length === 0 ? (
              <div className="empty-state">
                <p>No supported course modules (.pdf, .ppt, .pptx) found in this vault.</p>
              </div>
            ) : (
              <div className="courses-grid">
                {scanResult.courses.map((course: CourseItem) => (
                  <section key={course.relative_path} className="course-card">
                    <h4>📚 {course.name}</h4>
                    <p className="module-count">{course.modules.length} module(s)</p>
                    <ul className="module-list">
                      {course.modules.map((mod: ModuleItem) => (
                        <li key={mod.relative_path} className="module-item">
                          <span className={`file-tag ${mod.file_type.toLowerCase()}`}>
                            {mod.file_type}
                          </span>
                          <span className="file-name">{mod.file_name}</span>
                          <span className="file-size">
                            {(mod.size_bytes / 1024).toFixed(1)} KB
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}

                {scanResult.root_modules.length > 0 && (
                  <section className="course-card unassigned">
                    <h4>📄 General Modules</h4>
                    <ul className="module-list">
                      {scanResult.root_modules.map((mod: ModuleItem) => (
                        <li key={mod.relative_path} className="module-item">
                          <span className={`file-tag ${mod.file_type.toLowerCase()}`}>
                            {mod.file_type}
                          </span>
                          <span className="file-name">{mod.file_name}</span>
                          <span className="file-size">
                            {(mod.size_bytes / 1024).toFixed(1)} KB
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
