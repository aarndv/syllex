import { useState, useEffect, useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { VaultScanResult, VaultNode } from "./types/vault";
import { FileTree } from "./components/FileTree";
import { PdfViewer } from "./components/PdfViewer";
import { DashboardHeader } from "./components/DashboardHeader";
import { VaultManagerModal } from "./components/VaultManagerModal";
import "./App.css";

const VAULT_STORAGE_KEY = "syllex_selected_vault_path";
const DEFAULT_VAULTS_ROOT_KEY = "syllex_default_vaults_root_path";

function App() {
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [defaultVaultsRoot, setDefaultVaultsRoot] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<VaultScanResult | null>(null);
  const [activeNode, setActiveNode] = useState<VaultNode | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState<boolean>(false);
  const [isVaultManagerOpen, setIsVaultManagerOpen] = useState<boolean>(false);

  useEffect(() => {
    const savedPath = localStorage.getItem(VAULT_STORAGE_KEY);
    if (savedPath) {
      setVaultPath(savedPath);
      scanVault(savedPath);
    }
    const savedDefaultRoot = localStorage.getItem(DEFAULT_VAULTS_ROOT_KEY);
    if (savedDefaultRoot) {
      setDefaultVaultsRoot(savedDefaultRoot);
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

  function handleClearVault() {
    localStorage.removeItem(VAULT_STORAGE_KEY);
    setVaultPath(null);
    setScanResult(null);
    setActiveNode(null);
    setError(null);
  }

  async function handleAddModule(targetFolderRelPath?: string) {
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
          targetCourseRelPath: targetFolderRelPath || null,
          sourceFilePath: selected,
        });
        await scanVault(vaultPath);
      }
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Failed to add module to vault");
    }
  }

  async function handleCreateFolder() {
    if (!vaultPath) return;
    const folderName = window.prompt("Enter new folder name (e.g. CS101 or CS101/Lectures):");
    if (!folderName || !folderName.trim()) return;

    try {
      await invoke("create_folder", {
        vaultRoot: vaultPath,
        relativePath: folderName.trim(),
      });
      await scanVault(vaultPath);
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Failed to create folder");
    }
  }

  async function handleRemoveItem(relativePath: string, isFolder: boolean) {
    if (!vaultPath) return;
    const confirmMsg = isFolder
      ? `Are you sure you want to remove the folder "${relativePath}" and all its contents?`
      : `Are you sure you want to remove "${relativePath}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await invoke("remove_item", {
        vaultRoot: vaultPath,
        relativePath,
      });
      if (activeNode?.relative_path === relativePath) {
        setActiveNode(null);
      }
      await scanVault(vaultPath);
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Failed to remove item");
    }
  }

  function handleSelectFileNode(node: VaultNode) {
    const isFile = typeof node.node_type === "object" && "File" in node.node_type;
    if (!isFile) return;

    const fileType = (node.node_type as { File: string }).File;
    if (fileType === "Pdf") {
      setActiveNode(node);
    } else {
      setError(`Viewing ${fileType} files is coming in later milestones.`);
    }
  }

  const vaultStats = useMemo(() => {
    if (!scanResult) return { courses: 0, files: 0 };
    let courses = 0;
    let files = 0;

    function traverse(nodes: VaultNode[], isRootLevel: boolean) {
      for (const node of nodes) {
        if (node.node_type === "Folder") {
          if (isRootLevel) courses++;
          traverse(node.children, false);
        } else {
          files++;
        }
      }
    }

    traverse(scanResult.root_nodes, true);
    return { courses, files };
  }, [scanResult]);

  function handleSetDefaultVaultsRoot(path: string) {
    setDefaultVaultsRoot(path);
    localStorage.setItem(DEFAULT_VAULTS_ROOT_KEY, path);
  }

  function handleSelectVaultPath(path: string) {
    setVaultPath(path);
    localStorage.setItem(VAULT_STORAGE_KEY, path);
    scanVault(path);
  }

  return (
    <div className="app-layout">
      {isVaultManagerOpen && (
        <VaultManagerModal
          currentVaultPath={vaultPath}
          defaultVaultsRoot={defaultVaultsRoot}
          onSelectVaultPath={handleSelectVaultPath}
          onSetDefaultVaultsRoot={handleSetDefaultVaultsRoot}
          onClose={() => setIsVaultManagerOpen(false)}
        />
      )}

      {activeNode && vaultPath && scanResult && (
        <PdfViewer
          vaultRoot={vaultPath}
          node={activeNode}
          allNodes={scanResult.root_nodes}
          onSelectNode={handleSelectFileNode}
          onAddFile={handleAddModule}
          onRemoveItem={handleRemoveItem}
          onClose={() => setActiveNode(null)}
        />
      )}

      <header className="app-header">
        <h1>Syllex</h1>
      </header>

      <div className="app-workspace">
        <aside className="app-sidebar">
          <div className="sidebar-header">
            <span className="sidebar-title">Course Explorer</span>
            <div className="vault-actions">
              <div className="plus-menu-wrapper">
                <button
                  onClick={() => setIsPlusMenuOpen((prev) => !prev)}
                  className="icon-btn primary-icon-btn"
                  title="Create vault, new folder, or add module"
                >
                  +
                </button>
                {isPlusMenuOpen && (
                  <div className="plus-dropdown">
                    <button
                      onClick={() => {
                        setIsPlusMenuOpen(false);
                        setIsVaultManagerOpen(true);
                      }}
                    >
                      ➕ Create / Manage Vaults
                    </button>
                    {vaultPath && (
                      <>
                        <button
                          onClick={() => {
                            setIsPlusMenuOpen(false);
                            handleCreateFolder();
                          }}
                        >
                          📁 New Folder
                        </button>
                        <button
                          onClick={() => {
                            setIsPlusMenuOpen(false);
                            handleAddModule();
                          }}
                        >
                          📄 Add Module
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {vaultPath ? (
                <button
                  onClick={() => setIsVaultManagerOpen(true)}
                  className="icon-btn secondary-icon-btn"
                  title="Switch / Manage Vaults"
                >
                  ⇄
                </button>
              ) : (
                <button onClick={() => setIsVaultManagerOpen(true)} className="primary-btn">
                  Select Vault
                </button>
              )}

              {vaultPath && (
                <button
                  onClick={handleClearVault}
                  className="icon-btn close-icon-btn"
                  title="Close Vault"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <div className="sidebar-content">
            {/* Sidebar body kept empty while center vault view is active to avoid redundancy */}
          </div>
        </aside>

        <main className="app-main-content">
          {error && (
            <div className="error-banner">
              <p><strong>Error:</strong> {error}</p>
            </div>
          )}

          {!vaultPath && !loading && (
            <>
              <DashboardHeader />
              <div className="empty-state">
                <h2>No Vault Selected</h2>
                <p>Create a new vault or select an existing local course folder to get started.</p>
                <button onClick={() => setIsVaultManagerOpen(true)} className="primary-btn large">
                  Open Vault Manager
                </button>
              </div>
            </>
          )}

          {loading && (
            <div className="loading-state">
              <p>Scanning vault directory tree...</p>
            </div>
          )}

          {scanResult && !loading && (
            <div className="vault-view">
              <DashboardHeader
                courseCount={vaultStats.courses}
                fileCount={vaultStats.files}
              />

              {scanResult.root_nodes.length === 0 ? (
                <div className="empty-state">
                  <p>No files or folders found in this vault.</p>
                  <button onClick={() => handleAddModule()} className="primary-btn">
                    Add First Module
                  </button>
                </div>
              ) : (
                <div className="tree-explorer-card">
                  <div className="tree-card-header">
                    <span className="tree-card-vault-path" title={scanResult.root_path}>
                      <span className="path-icon">📂</span>
                      <span className="path-text">{scanResult.root_path}</span>
                    </span>
                  </div>
                  <div className="tree-card-body">
                    <FileTree
                      nodes={scanResult.root_nodes}
                      activePath={activeNode?.relative_path}
                      onSelectFile={handleSelectFileNode}
                      onAddFile={handleAddModule}
                      onRemoveItem={handleRemoveItem}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
