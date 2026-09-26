import { useState, useEffect, useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { VaultScanResult, VaultNode } from "./types/vault";
import { FileTree } from "./components/FileTree";
import { BookshelfView } from "./components/BookshelfView";
import { PdfViewer } from "./components/PdfViewer";
import { DashboardHeader } from "./components/DashboardHeader";
import { VaultManagerModal } from "./components/VaultManagerModal";
import { SettingsModal, AppSettings, DEFAULT_SETTINGS } from "./components/SettingsModal";
import { SidebarAcademicWidget } from "./components/SidebarAcademicWidget";
import { SidebarTodoList } from "./components/SidebarTodoList";
import { SidebarCountersWidget } from "./components/SidebarCountersWidget";
import { QuickSearchModal, SearchResultItem } from "./components/QuickSearchModal";
import { SearchPreviewDrawer } from "./components/SearchPreviewDrawer";
import { ConfirmDeleteModal, UndoToast } from "./components/ConfirmDeleteModal";
import { RenameModal } from "./components/RenameModal";
import {
  PlusIcon,
  FolderIcon,
  FileIcon,
  SwitchIcon,
  CloseIcon,
  SettingsIcon,
  ShelfIcon,
  TreeListIcon,
  RefreshIcon,
  SearchIcon,
  SidebarToggleIcon,
  ClockIcon,
} from "./components/Icons";
import "./App.css";

const VAULT_STORAGE_KEY = "syllex_selected_vault_path";
const DEFAULT_VAULTS_ROOT_KEY = "syllex_default_vaults_root_path";
const SETTINGS_STORAGE_KEY = "syllex_app_settings";
const SIDEBAR_HIDDEN_STORAGE_KEY = "syllex_sidebar_hidden";

function App() {
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [defaultVaultsRoot, setDefaultVaultsRoot] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<VaultScanResult | null>(null);
  const [activeNode, setActiveNode] = useState<VaultNode | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState<boolean>(false);
  const [isVaultManagerOpen, setIsVaultManagerOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [selectedSearchItem, setSelectedSearchItem] = useState<SearchResultItem | null>(null);
  const [isSidebarHidden, setIsSidebarHidden] = useState<boolean>(() => {
    return localStorage.getItem(SIDEBAR_HIDDEN_STORAGE_KEY) === "true";
  });
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  const [pendingDelete, setPendingDelete] = useState<{
    relativePath: string;
    isFolder: boolean;
    name: string;
  } | null>(null);
  const [pendingRename, setPendingRename] = useState<{
    relativePath: string;
    isFolder: boolean;
    currentName: string;
  } | null>(null);
  const [undoStash, setUndoStash] = useState<{
    relativePath: string;
    isFolder: boolean;
    name: string;
    timerId: any;
  } | null>(null);
  const [activeViewMode, setActiveViewMode] = useState<"bookshelf" | "tree">("bookshelf");


  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);


  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    function applyTheme() {
      let effectiveTheme: "dark" | "light" = "dark";
      if (settings.theme === "system") {
        effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      } else {
        effectiveTheme = settings.theme;
      }
      document.documentElement.setAttribute("data-theme", effectiveTheme);
    }

    applyTheme();
    document.documentElement.setAttribute("data-font-style", settings.fontStyle);
    document.documentElement.setAttribute("data-font-size", settings.fontSize);
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyTheme();
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_HIDDEN_STORAGE_KEY, String(isSidebarHidden));
  }, [isSidebarHidden]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const headerTimeString = useMemo(() => {
    return currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [currentTime]);

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

  function handleRemoveItem(relativePath: string, isFolder: boolean) {
    if (!vaultPath) return;
    const name = relativePath.split("/").pop() || relativePath;
    setPendingDelete({ relativePath, isFolder, name });
  }

  function handleConfirmDelete() {
    if (!pendingDelete || !vaultPath) return;

    const { relativePath, isFolder, name } = pendingDelete;
    const currentVault = vaultPath;

    // Clear previous pending undo timer if any and remove immediately
    if (undoStash) {
      clearTimeout(undoStash.timerId);
      invoke("remove_item", { vaultRoot: currentVault, relativePath: undoStash.relativePath }).catch(() => {});
    }

    if (activeNode?.relative_path === relativePath) {
      setActiveNode(null);
    }

    setPendingDelete(null);

    // Schedule final deletion after 6 seconds
    const timerId = setTimeout(async () => {
      try {
        await invoke("remove_item", {
          vaultRoot: currentVault,
          relativePath,
        });
        await scanVault(currentVault);
      } catch (err: any) {
        setError(typeof err === "string" ? err : err.message || "Failed to remove item");
      } finally {
        setUndoStash(null);
      }
    }, 6000);

    setUndoStash({ relativePath, isFolder, name, timerId });
  }

  function handleUndoDelete() {
    if (!undoStash) return;
    clearTimeout(undoStash.timerId);
    setUndoStash(null);
    if (vaultPath) {
      scanVault(vaultPath);
    }
  }

  function handleDismissUndoToast() {
    if (!undoStash || !vaultPath) return;
    clearTimeout(undoStash.timerId);
    const { relativePath } = undoStash;
    const currentVault = vaultPath;
    setUndoStash(null);
    invoke("remove_item", { vaultRoot: currentVault, relativePath })
      .then(() => scanVault(currentVault))
      .catch((err: any) => setError(typeof err === "string" ? err : err.message || "Failed to remove item"));
  }

  function handleRenameItem(relativePath: string, isFolder: boolean, currentName: string) {
    if (!vaultPath) return;
    setPendingRename({ relativePath, isFolder, currentName });
  }

  async function handleConfirmRename(newName: string) {
    if (!pendingRename || !vaultPath) return;
    const { relativePath, isFolder } = pendingRename;
    const currentVault = vaultPath;

    const newRelPath = await invoke<string>("rename_item", {
      vaultRoot: currentVault,
      relativePath,
      newName,
    });

    if (isFolder) {
      // Migrate folder custom colors
      try {
        const colorsRaw = localStorage.getItem("syllex_folder_custom_colors");
        if (colorsRaw) {
          const colors = JSON.parse(colorsRaw);
          const updatedColors: Record<string, string> = {};
          for (const [k, v] of Object.entries(colors)) {
            if (k === relativePath) {
              updatedColors[newRelPath] = v as string;
            } else if (k.startsWith(relativePath + "/")) {
              const suffix = k.substring(relativePath.length);
              updatedColors[newRelPath + suffix] = v as string;
            } else {
              updatedColors[k] = v as string;
            }
          }
          localStorage.setItem("syllex_folder_custom_colors", JSON.stringify(updatedColors));
        }
      } catch {}

      // Migrate reading progress keys
      try {
        const keysToMigrate: { oldKey: string; newKey: string; val: string }[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`syllex_progress_${relativePath}/`)) {
            const suffix = key.substring(`syllex_progress_${relativePath}/`.length);
            const val = localStorage.getItem(key);
            if (val) {
              keysToMigrate.push({
                oldKey: key,
                newKey: `syllex_progress_${newRelPath}/${suffix}`,
                val,
              });
            }
          }
        }
        for (const item of keysToMigrate) {
          localStorage.removeItem(item.oldKey);
          localStorage.setItem(item.newKey, item.val);
        }
      } catch {}

      // If activeNode was inside this folder, update its relative_path
      if (activeNode && activeNode.relative_path.startsWith(relativePath + "/")) {
        const suffix = activeNode.relative_path.substring(relativePath.length);
        setActiveNode((prev) => (prev ? { ...prev, relative_path: newRelPath + suffix } : null));
      }
    } else {
      // Migrate reading progress for this file
      const oldProgKey = `syllex_progress_${relativePath}`;
      const newProgKey = `syllex_progress_${newRelPath}`;
      const savedProg = localStorage.getItem(oldProgKey);
      if (savedProg) {
        localStorage.removeItem(oldProgKey);
        localStorage.setItem(newProgKey, savedProg);
      }

      // If activeNode is this file, update activeNode name and relative_path
      if (activeNode && activeNode.relative_path === relativePath) {
        setActiveNode((prev) => (prev ? { ...prev, name: newName, relative_path: newRelPath } : null));
      }
    }

    setPendingRename(null);
    await scanVault(currentVault);
  }


  const [initialPdfState, setInitialPdfState] = useState<{
    page?: number;
    query?: string;
  } | null>(null);

  function handleSelectFileNode(
    node: VaultNode,
    targetPage?: number,
    initialSearchQuery?: string
  ) {
    const isFile = typeof node.node_type === "object" && "File" in node.node_type;
    if (!isFile) return;

    const fileType = (node.node_type as { File: string }).File;
    if (fileType === "Pdf" || fileType === "Ppt" || fileType === "Pptx") {
      setActiveNode(node);
      setInitialPdfState({ page: targetPage, query: initialSearchQuery });
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
      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          defaultVaultsRoot={defaultVaultsRoot}
          onUpdateSettings={setSettings}
          onSetDefaultVaultsRoot={handleSetDefaultVaultsRoot}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

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
          initialPage={initialPdfState?.page}
          initialSearchQuery={initialPdfState?.query}
          onSelectNode={(n) => handleSelectFileNode(n)}
          onAddFile={handleAddModule}
          onRemoveItem={handleRemoveItem}
          onRenameItem={handleRenameItem}
          onRefreshVault={() => scanVault(vaultPath)}
          onClose={() => {
            setActiveNode(null);
            setInitialPdfState(null);
          }}
        />
      )}

      <QuickSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        rootNodes={scanResult?.root_nodes || []}
        vaultRoot={vaultPath || ""}
        onSelectResult={(item) => {
          setIsSearchOpen(false);
          if (item.matchType === "content" && item.targetPage) {
            handleSelectFileNode(item.node, item.targetPage, item.searchQuery);
          } else {
            setSelectedSearchItem(item);
          }
        }}
      />

      <SearchPreviewDrawer
        item={selectedSearchItem}
        onClose={() => setSelectedSearchItem(null)}
        onOpenItem={(item) => {
          setSelectedSearchItem(null);
          if (item.node.node_type !== "Folder") {
            handleSelectFileNode(item.node, item.targetPage, item.searchQuery);
          }
        }}
        onLocateOnBookshelf={() => {
          setSelectedSearchItem(null);
          setActiveViewMode("bookshelf");
        }}
      />

      <ConfirmDeleteModal
        isOpen={!!pendingDelete}
        itemName={pendingDelete?.name || ""}
        isFolder={pendingDelete?.isFolder || false}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <RenameModal
        isOpen={!!pendingRename}
        isFolder={pendingRename?.isFolder || false}
        currentName={pendingRename?.currentName || ""}
        onConfirm={handleConfirmRename}
        onCancel={() => setPendingRename(null)}
      />

      {undoStash && (
        <UndoToast
          itemName={undoStash.name}
          onUndo={handleUndoDelete}
          onDismiss={handleDismissUndoToast}
        />
      )}


      <header className="app-header">
        <div className="header-left-group">
          <button
            onClick={() => setIsSidebarHidden((prev) => !prev)}
            className={`icon-btn sidebar-toggle-btn ${isSidebarHidden ? "is-collapsed" : ""}`}
            title={isSidebarHidden ? "Show Sidebar" : "Hide Sidebar"}
            aria-label={isSidebarHidden ? "Show Sidebar" : "Hide Sidebar"}
          >
            <SidebarToggleIcon size={18} />
          </button>
          <h1>Syllex</h1>
        </div>

        {isSidebarHidden && (
          <div className="header-clock-pill" title="Current Time">
            <ClockIcon size={15} />
            <span className="header-clock-digits">{headerTimeString}</span>
          </div>
        )}

        <div className="header-actions-group">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="search-trigger-btn"
            title="Quick Search across vaults (Ctrl+K)"
          >
            <SearchIcon size={16} />
            <span className="search-btn-label">Quick Search</span>
            <kbd className="search-shortcut-badge">Ctrl+K</kbd>
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="icon-btn secondary-icon-btn"
            title="Open Settings"
          >
            <SettingsIcon size={18} />
          </button>
        </div>
      </header>


      <div className="app-workspace">
        {!isSidebarHidden && (
          <aside className="app-sidebar">
            <div className="sidebar-header">
              <SidebarAcademicWidget onOpenSettings={() => setIsSettingsOpen(true)} />
              <div className="vault-actions">
                <div className="plus-menu-wrapper">
                  <button
                    onClick={() => setIsPlusMenuOpen((prev) => !prev)}
                    className="icon-btn primary-icon-btn"
                    title="Create vault, new folder, or add module"
                  >
                    <PlusIcon size={16} />
                  </button>
                  {isPlusMenuOpen && (
                    <div className="plus-dropdown">
                      <button
                        onClick={() => {
                          setIsPlusMenuOpen(false);
                          setIsVaultManagerOpen(true);
                        }}
                      >
                        <PlusIcon size={14} /> Create / Manage Vaults
                      </button>
                      {vaultPath && (
                        <>
                          <button
                            onClick={() => {
                              setIsPlusMenuOpen(false);
                              handleCreateFolder();
                            }}
                          >
                            <FolderIcon size={14} /> New Folder
                          </button>
                          <button
                            onClick={() => {
                              setIsPlusMenuOpen(false);
                              handleAddModule();
                            }}
                          >
                            <FileIcon size={14} /> Add Module
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {vaultPath && (
                  <button
                    onClick={() => scanVault(vaultPath)}
                    className="icon-btn secondary-icon-btn"
                    title="Refresh Vault Files"
                  >
                    <RefreshIcon size={16} />
                  </button>
                )}

                {vaultPath ? (
                  <button
                    onClick={() => setIsVaultManagerOpen(true)}
                    className="icon-btn secondary-icon-btn"
                    title="Switch / Manage Vaults"
                  >
                    <SwitchIcon size={16} />
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
                    <CloseIcon size={16} />
                  </button>
                )}
              </div>
            </div>
            <div className="sidebar-content">
              <SidebarCountersWidget />
              <SidebarTodoList />
            </div>
          </aside>
        )}

        <main className={`app-main-content ${isSidebarHidden ? "sidebar-collapsed" : ""}`}>
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

              <div className="view-mode-toolbar-blueprint">
                <span className="tree-card-vault-path" title={scanResult.root_path}>
                  <span className="path-icon">
                    <FolderIcon size={14} />
                  </span>
                  <span className="path-text">{scanResult.root_path}</span>
                </span>

                <div className="view-toggle-button-group">
                  <button
                    className={`toggle-mode-btn ${activeViewMode === "bookshelf" ? "active" : ""}`}
                    onClick={() => setActiveViewMode("bookshelf")}
                    title="Bookshelf Bookstore View"
                  >
                    <ShelfIcon size={14} /> Bookshelves
                  </button>
                  <button
                    className={`toggle-mode-btn ${activeViewMode === "tree" ? "active" : ""}`}
                    onClick={() => setActiveViewMode("tree")}
                    title="Tree Explorer View"
                  >
                    <TreeListIcon size={14} /> Explorer Tree
                  </button>
                </div>
              </div>

              {scanResult.root_nodes.length === 0 ? (
                <div className="empty-state">
                  <p>No files or folders found in this vault.</p>
                  <button onClick={() => handleAddModule()} className="primary-btn">
                    Add First Module
                  </button>
                </div>
              ) : activeViewMode === "bookshelf" ? (
                <BookshelfView
                  nodes={scanResult.root_nodes}
                  onSelectFile={handleSelectFileNode}
                  onAddFile={handleAddModule}
                  onRemoveItem={handleRemoveItem}
                  onRenameItem={handleRenameItem}
                />
              ) : (
                <div className="tree-explorer-card">
                  <div className="tree-card-body">
                    <FileTree
                      nodes={scanResult.root_nodes}
                      activePath={activeNode?.relative_path}
                      onSelectFile={handleSelectFileNode}
                      onAddFile={handleAddModule}
                      onRemoveItem={handleRemoveItem}
                      onRenameItem={handleRenameItem}
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
