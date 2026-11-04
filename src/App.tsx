import { useState, useEffect, useMemo, useRef, type WheelEvent } from "react";
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
import { LandingPad } from "./components/LandingPad";
import { SyllexLogo } from "./components/SyllexLogo";
import { toUserFacingError } from "./utils/userFacingError";
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
const LEGACY_PROGRESS_VAULT_KEY = "syllex_legacy_progress_vault_path";
const DEFAULT_VAULTS_ROOT_KEY = "syllex_default_vaults_root_path";
const SETTINGS_STORAGE_KEY = "syllex_app_settings";
const SIDEBAR_HIDDEN_STORAGE_KEY = "syllex_sidebar_hidden";

function App({ startInVault = false }: { startInVault?: boolean }) {
  const [hasEntered, setHasEntered] = useState<boolean>(startInVault);
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
    vaultRoot: string;
    name: string;
    timerId: number;
  } | null>(null);
  const [activeViewMode, setActiveViewMode] = useState<"bookshelf" | "tree">("bookshelf");
  const [showHiddenItems, setShowHiddenItems] = useState(false);
  const scanRequestRef = useRef(0);
  const mainContentRef = useRef<HTMLElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPlusMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setIsPlusMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsPlusMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isPlusMenuOpen]);


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

  useEffect(() => {
    return () => {
      scanRequestRef.current++;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (undoStash) {
        window.clearTimeout(undoStash.timerId);
      }
    };
  }, [undoStash]);


  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<AppSettings> | null;
        const restored = { ...DEFAULT_SETTINGS, ...(parsed && typeof parsed === "object" ? parsed : {}) };
        if (parsed?.pageSidebarLayoutVersion !== 2) {
          const previousWidth = parsed?.pageSidebarWidth;
          restored.pageSidebarWidth = previousWidth === 170 || previousWidth === 220
            ? DEFAULT_SETTINGS.pageSidebarWidth
            : Math.max(100, Math.min(220, Number(previousWidth) || DEFAULT_SETTINGS.pageSidebarWidth));
          restored.pageSidebarLayoutVersion = 2;
        }
        return restored;
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
    let mounted = true;
    async function restoreVault() {
      const legacyPath = localStorage.getItem(VAULT_STORAGE_KEY);
      try {
        const storedPath = await invoke<string | null>("get_selected_vault");
        if (!mounted) return;
        if (storedPath) {
          if (legacyPath === storedPath) {
            localStorage.setItem(LEGACY_PROGRESS_VAULT_KEY, storedPath);
            localStorage.removeItem(VAULT_STORAGE_KEY);
          }
          setVaultPath(storedPath);
          void scanVault(storedPath);
        } else if (legacyPath) {
          const canonicalPath = await invoke<string>("set_selected_vault", { path: legacyPath });
          if (!mounted) return;
          localStorage.setItem(LEGACY_PROGRESS_VAULT_KEY, canonicalPath);
          localStorage.removeItem(VAULT_STORAGE_KEY);
          setVaultPath(canonicalPath);
          void scanVault(canonicalPath);
        }
      } catch (err: unknown) {
        if (mounted) setError(toUserFacingError(err, "restore your vault"));
      }
    }
    void restoreVault();
    const savedDefaultRoot = localStorage.getItem(DEFAULT_VAULTS_ROOT_KEY);
    if (savedDefaultRoot) {
      setDefaultVaultsRoot(savedDefaultRoot);
    }
    return () => { mounted = false; };
  }, []);

  async function scanVault(path: string) {
    const requestId = ++scanRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await invoke<VaultScanResult>("scan_vault", { path });
      if (requestId === scanRequestRef.current) {
        setScanResult(res);
      }
    } catch (err: unknown) {
      if (requestId === scanRequestRef.current) {
        setError(toUserFacingError(err, "scan this vault"));
        setScanResult(null);
      }
    } finally {
      if (requestId === scanRequestRef.current) {
        setLoading(false);
      }
    }
  }

  async function handleClearVault() {
    try {
      await invoke("set_selected_vault", { path: null });
      scanRequestRef.current++;
      localStorage.removeItem(VAULT_STORAGE_KEY);
      setVaultPath(null);
      setScanResult(null);
      setActiveNode(null);
      setError(null);
    } catch (err: unknown) {
      setError(toUserFacingError(err, "close this vault"));
    }
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
    } catch (err: unknown) {
      setError(toUserFacingError(err, "add this module"));
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
    } catch (err: unknown) {
      setError(toUserFacingError(err, "create this folder"));
    }
  }

  function handleRemoveItem(relativePath: string, isFolder: boolean) {
    if (!vaultPath) return;
    function findName(nodes: VaultNode[]): string | undefined {
      for (const node of nodes) {
        if (node.relative_path === relativePath) return node.name;
        const child = findName(node.children);
        if (child) return child;
      }
      return undefined;
    }
    const name = findName(scanResult?.root_nodes || []) || relativePath.split(/[\\/]/).pop() || relativePath;
    setPendingDelete({ relativePath, isFolder, name });
  }

  async function handleConfirmDelete() {
    if (!pendingDelete || !vaultPath) return;
    const { relativePath, name } = pendingDelete;
    const currentVault = vaultPath;
    try {
      await invoke("set_item_hidden", { vaultRoot: currentVault, relativePath, hidden: true });
      setPendingDelete(null);
      if (activeNode?.relative_path === relativePath || activeNode?.relative_path.startsWith(`${relativePath}/`) || activeNode?.relative_path.startsWith(`${relativePath}\\`)) {
        setActiveNode(null);
      }
      if (undoStash) window.clearTimeout(undoStash.timerId);
      await scanVault(currentVault);
      const timerId = window.setTimeout(() => {
        setUndoStash((current) => current?.timerId === timerId ? null : current);
      }, 6000);
      setUndoStash({ relativePath, vaultRoot: currentVault, name, timerId });
    } catch (err: unknown) {
      setPendingDelete(null);
      setError(toUserFacingError(err, "hide this item"));
    }
  }

  async function handleUndoDelete() {
    if (!undoStash) return;
    const { relativePath, vaultRoot: originalVault, timerId } = undoStash;
    window.clearTimeout(timerId);
    setUndoStash(null);
    try {
      await invoke("set_item_hidden", { vaultRoot: originalVault, relativePath, hidden: false });
      if (vaultPath === originalVault) await scanVault(originalVault);
    } catch (err: unknown) {
      setError(toUserFacingError(err, "restore this item"));
    }
  }

  function handleDismissUndoToast() {
    if (!undoStash) return;
    window.clearTimeout(undoStash.timerId);
    setUndoStash(null);
  }

  async function handleRestoreHidden(relativePath: string) {
    if (!vaultPath) return;
    try {
      await invoke("set_item_hidden", { vaultRoot: vaultPath, relativePath, hidden: false });
      await scanVault(vaultPath);
    } catch (err: unknown) {
      setError(toUserFacingError(err, "restore this item"));
    }
  }

  function handleRenameItem(relativePath: string, isFolder: boolean, currentName: string) {
    if (!vaultPath) return;
    setPendingRename({ relativePath, isFolder, currentName });
  }

  async function handleConfirmRename(displayName: string) {
    if (!pendingRename || !vaultPath) return;
    const { relativePath } = pendingRename;
    await invoke("set_item_display_name", {
      vaultRoot: vaultPath,
      relativePath,
      displayName,
    });
    if (activeNode?.relative_path === relativePath) {
      setActiveNode((previous) => previous ? { ...previous, name: displayName } : null);
    }
    setPendingRename(null);
    await scanVault(vaultPath);
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

  async function handleSelectVaultPath(path: string) {
    try {
      const canonicalPath = await invoke<string>("set_selected_vault", { path });
      scanRequestRef.current++;
      setVaultPath(canonicalPath);
      setScanResult(null);
      setActiveNode(null);
      localStorage.removeItem(VAULT_STORAGE_KEY);
      void scanVault(canonicalPath);
    } catch (err: unknown) {
      setError(toUserFacingError(err, "select this vault"));
    }
  }

  function handleWorkspaceWheel(event: WheelEvent<HTMLDivElement>) {
    const mainContent = mainContentRef.current;
    if (!mainContent || mainContent.contains(event.target as Node)) return;

    const target = event.target;
    if (target instanceof Element && target.closest(".app-sidebar")) return;

    event.preventDefault();
    mainContent.scrollBy({ top: event.deltaY, left: event.deltaX });
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
          settings={settings}
          onUpdateSettings={setSettings}
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

      {!hasEntered && (
        <LandingPad
          onEnter={() => setHasEntered(true)}
          vaultPath={vaultPath}
          courseCount={vaultStats.courses}
          fileCount={vaultStats.files}
          onOpenVaultManager={() => setIsVaultManagerOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      <header className="app-header">
        <div className="header-left-group">
          {isSidebarHidden && (
            <button
              onClick={() => setIsSidebarHidden(false)}
              className="icon-btn sidebar-toggle-btn is-collapsed"
              title="Show Sidebar"
              aria-label="Show Sidebar"
            >
              <SidebarToggleIcon size={18} />
            </button>
          )}
          <button
            type="button"
            className="header-title-btn"
            onClick={() => setHasEntered(false)}
            title="Syllex — Return to Landing Pad"
            aria-label="Syllex — Return to Landing Pad"
          >
            <SyllexLogo />
          </button>
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
            title="Quick Search (Ctrl+K)"
            aria-label="Quick Search (Ctrl+K)"
          >
            <SearchIcon size={16} />
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


      <div className="app-workspace" onWheel={handleWorkspaceWheel}>
        {!isSidebarHidden && (
          <aside className="app-sidebar">
            <div className="sidebar-header">
              <SidebarAcademicWidget
                onToggleSidebar={() => setIsSidebarHidden(true)}
              />
              <div className="vault-actions">
                <div className="plus-menu-wrapper" ref={plusMenuRef}>
                  <button
                    onClick={() => setIsPlusMenuOpen((prev) => !prev)}
                    className="icon-btn primary-icon-btn"
                    title={isPlusMenuOpen ? undefined : "Create vault, new folder, or add module"}
                    aria-label="Create vault, new folder, or add module"
                    aria-haspopup="true"
                    aria-expanded={isPlusMenuOpen}
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

                {vaultPath && (
                  <button
                    onClick={() => setIsVaultManagerOpen(true)}
                    className="icon-btn secondary-icon-btn"
                    title="Switch / Manage Vaults"
                  >
                    <SwitchIcon size={16} />
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

        <main
          ref={mainContentRef}
          className={`app-main-content ${isSidebarHidden ? "sidebar-collapsed" : ""}`}
        >
          {error && (
            <div className="error-banner" role="alert">
              <p><strong>Error:</strong> {error}</p>
              <button
                type="button"
                className="error-dismiss-btn"
                onClick={() => setError(null)}
                aria-label="Dismiss error"
                title="Dismiss error"
              >
                <CloseIcon size={12} />
              </button>
            </div>
          )}

          {!vaultPath && !loading && (
            <>
              <DashboardHeader />
              <div className="empty-state no-vault-empty-state">
                <h2>No Vault Selected</h2>
                <p>Create a new vault or select an existing local course folder to get started.</p>
                <button onClick={() => setIsVaultManagerOpen(true)} className="primary-btn large">
                  Open Vault Manager
                </button>
              </div>
            </>
          )}

          {loading && (
            <div className="loading-state" role="status" aria-live="polite">
              <span className="loading-spinner" aria-hidden="true" />
              <p>Scanning vault directory tree...</p>
            </div>
          )}

          {scanResult && !loading && (
            <div className="vault-view">
              {scanResult.warnings.length > 0 && (
                <div className="scan-warning" role="status">
                  <p><strong>{scanResult.warnings.length} {scanResult.warnings.length === 1 ? "entry was" : "entries were"} skipped:</strong> {scanResult.warnings.slice(0, 3).join("; ")}{scanResult.warnings.length > 3 ? `; and ${scanResult.warnings.length - 3} more` : ""}</p>
                </div>
              )}
              <DashboardHeader />

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

              {scanResult.hidden_items.length > 0 && (
                <div className="hidden-items-panel">
                  <button type="button" className="secondary-btn" onClick={() => setShowHiddenItems((shown) => !shown)}
                    aria-expanded={showHiddenItems}>
                    {showHiddenItems ? "Hide list" : "Manage hidden items"} ({scanResult.hidden_items.length})
                  </button>
                  {showHiddenItems && (
                    <ul>
                      {scanResult.hidden_items.map((item) => (
                        <li key={item.relative_path}>
                          <span>{item.is_folder ? "Folder" : "Module"}: {item.name} <small>({item.relative_path})</small></span>
                          <button type="button" className="secondary-btn"
                            onClick={() => { void handleRestoreHidden(item.relative_path); }}>
                            Restore
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {scanResult.root_nodes.length === 0 ? (
                <div className="empty-state">
                  <p>{scanResult.hidden_items.length > 0 ? "No visible files or folders. Restore a hidden item above or add a module." : "No files or folders found in this vault."}</p>
                  <button onClick={() => handleAddModule()} className="primary-btn">
                    Add First Module
                  </button>
                </div>
              ) : activeViewMode === "bookshelf" ? (
                <BookshelfView
                  nodes={scanResult.root_nodes}
                  vaultRoot={vaultPath || ""}
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
