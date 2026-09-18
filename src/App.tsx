import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { VaultScanResult, CourseItem, ModuleItem } from "./types/vault";
import { PdfViewer } from "./components/PdfViewer";
import "./App.css";

const VAULT_STORAGE_KEY = "syllex_selected_vault_path";

function App() {
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<VaultScanResult | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleItem | null>(null);
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

  async function handleAddModule(targetCourseRelPath?: string) {
    if (!vaultPath) return;
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        title: "Select Module File to Copy into Vault",
        filters: [
          {
            name: "Course Modules",
            extensions: ["pdf", "ppt", "pptx", "md"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        await invoke("add_module_to_vault", {
          vaultRoot: vaultPath,
          targetCourseRelPath: targetCourseRelPath || null,
          sourceFilePath: selected,
        });
        await scanVault(vaultPath);
      }
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Failed to add module to vault");
    }
  }

  function handleOpenModule(mod: ModuleItem) {
    if (mod.file_type === "Pdf") {
      setActiveModule(mod);
    } else {
      setError(`Opening ${mod.file_type} files directly in viewer is coming in later milestones.`);
    }
  }

  return (
    <div className="app-layout">
      {activeModule && vaultPath && (
        <PdfViewer
          vaultRoot={vaultPath}
          module={activeModule}
          onClose={() => setActiveModule(null)}
        />
      )}

      <header className="app-header">
        <h1>Syllex</h1>
        <div className="vault-actions">
          {vaultPath && (
            <button onClick={() => handleAddModule()} className="primary-btn">
              + Add Module
            </button>
          )}
          <button onClick={handleSelectVault} className="secondary-btn">
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
                <p>No supported course modules (.pdf, .ppt, .pptx, .md) found in this vault.</p>
                <button onClick={() => handleAddModule()} className="primary-btn">
                  Add First Module
                </button>
              </div>
            ) : (
              <div className="courses-grid">
                {scanResult.courses.map((course: CourseItem) => (
                  <section key={course.relative_path} className="course-card">
                    <div className="course-card-header">
                      <h4>📚 {course.name}</h4>
                      <button
                        onClick={() => handleAddModule(course.relative_path)}
                        className="add-file-btn"
                        title="Add file to this course"
                      >
                        + Add File
                      </button>
                    </div>
                    <p className="module-count">{course.modules.length} module(s)</p>
                    <ul className="module-list">
                      {course.modules.map((mod: ModuleItem) => (
                        <li
                          key={mod.relative_path}
                          className="module-item clickable"
                          onClick={() => handleOpenModule(mod)}
                        >
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
                    <div className="course-card-header">
                      <h4>📄 General Modules</h4>
                      <button
                        onClick={() => handleAddModule()}
                        className="add-file-btn"
                        title="Add file to vault root"
                      >
                        + Add File
                      </button>
                    </div>
                    <ul className="module-list">
                      {scanResult.root_modules.map((mod: ModuleItem) => (
                        <li
                          key={mod.relative_path}
                          className="module-item clickable"
                          onClick={() => handleOpenModule(mod)}
                        >
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
