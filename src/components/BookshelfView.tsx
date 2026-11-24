import React, { useCallback, useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { VaultNode, VaultNodeType } from "../types/vault";
import { FolderIcon, FileIcon, PlusIcon, CloseIcon, BookIcon, PencilIcon, GripIcon } from "./Icons";
import { getModuleCoverThumbnail } from "../utils/pdfThumbnail";
import { getTooltipPosition } from "../utils/tooltipPosition";
import { moveSiblingFolder, sortSiblingFolders } from "../utils/folderOrder";
import "./BookshelfView.css";

export interface FolderColorOption {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  bg: string;
}

export const FOLDER_COLOR_PALETTE: FolderColorOption[] = [
  { id: "emerald", name: "Emerald Green", primary: "#059669", secondary: "#047857", bg: "rgba(5, 150, 105, 0.18)" },
  { id: "forest", name: "Forest Pine", primary: "#15803d", secondary: "#166534", bg: "rgba(21, 128, 61, 0.18)" },
  { id: "teal", name: "Deep Teal", primary: "#0d9488", secondary: "#0f766e", bg: "rgba(13, 148, 136, 0.18)" },
  { id: "cyan", name: "Cyan Coast", primary: "#0284c7", secondary: "#0369a1", bg: "rgba(2, 132, 199, 0.18)" },
  { id: "cobalt", name: "Cobalt Blue", primary: "#2563eb", secondary: "#1d4ed8", bg: "rgba(37, 99, 235, 0.18)" },
  { id: "indigo", name: "Midnight Indigo", primary: "#4f46e5", secondary: "#4338ca", bg: "rgba(79, 70, 229, 0.18)" },
  { id: "violet", name: "Royal Violet", primary: "#7c3aed", secondary: "#6d28d9", bg: "rgba(124, 58, 237, 0.18)" },
  { id: "purple", name: "Deep Purple", primary: "#9333ea", secondary: "#7e22ce", bg: "rgba(147, 51, 234, 0.18)" },
  { id: "plum", name: "Vintage Plum", primary: "#a21caf", secondary: "#86198f", bg: "rgba(162, 28, 175, 0.18)" },
  { id: "rose", name: "Nordic Rose", primary: "#e11d48", secondary: "#be123c", bg: "rgba(225, 29, 72, 0.18)" },
  { id: "crimson", name: "Rust Crimson", primary: "#dc2626", secondary: "#b91c1c", bg: "rgba(220, 38, 38, 0.18)" },
  { id: "terracotta", name: "Terracotta Red", primary: "#ea580c", secondary: "#c2410c", bg: "rgba(234, 88, 12, 0.18)" },
  { id: "amber", name: "Warm Amber", primary: "#d97706", secondary: "#b45309", bg: "rgba(217, 119, 6, 0.18)" },
  { id: "bronze", name: "Study Bronze", primary: "#ca8a04", secondary: "#a16207", bg: "rgba(202, 138, 4, 0.18)" },
  { id: "slate", name: "Steel Slate", primary: "#475569", secondary: "#334155", bg: "rgba(71, 85, 105, 0.22)" },
  { id: "sage", name: "Chalk Sage", primary: "#4d7c0f", secondary: "#3f6212", bg: "rgba(77, 124, 15, 0.18)" },
];

const FOLDER_COLORS_STORAGE_KEY = "syllex_folder_custom_colors";

interface BookshelfViewProps {
  nodes: VaultNode[];
  vaultRoot: string;
  onSelectFile: (node: VaultNode) => void;
  onAddToWorkspace: (node: VaultNode) => void;
  onAddFile: (targetFolderRelPath?: string) => void;
  onRemoveItem: (relPath: string, isFolder: boolean) => void;
  onRenameItem: (relPath: string, isFolder: boolean, currentName: string) => void;
}

export const BookshelfView: React.FC<BookshelfViewProps> = ({
  nodes,
  vaultRoot,
  onSelectFile,
  onAddToWorkspace,
  onAddFile,
  onRemoveItem,
  onRenameItem,
}) => {
  const [folderOrders, setFolderOrders] = useState<Record<string, string[]>>({});
  const [draggedFolder, setDraggedFolder] = useState<{ path: string; parent: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ path: string; position: "before" | "after" } | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    let active = true;
    setFolderOrders({});
    invoke<Record<string, string[]>>("get_folder_orders", { vaultRoot })
      .then((orders) => { if (active) setFolderOrders(orders); })
      .catch(() => { if (active) setOrderError("Could not load saved folder order."); });
    return () => { active = false; };
  }, [vaultRoot]);
  const [folderColors, setFolderColors] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem(FOLDER_COLORS_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {};
  });

  function handleSetFolderColor(relPath: string, colorId: string) {
    setFolderColors((prev) => {
      const updated = { ...prev, [relPath]: colorId };
      localStorage.setItem(FOLDER_COLORS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  const folderNodes = sortSiblingFolders(nodes.filter((n) => n.node_type === "Folder"), folderOrders[""]);
  const fileNodes = nodes.filter((n) => n.node_type !== "Folder");

  async function handleReorder(parentPath: string, siblings: VaultNode[], source: string, target: string, position: "before" | "after") {
    if (savingOrder) return;
    const current = sortSiblingFolders(siblings, folderOrders[parentPath.replace(/\\/g, "/")]).map((folder) => folder.relative_path);
    const next = moveSiblingFolder(current, source, target, position);
    if (next.join("\0") === current.join("\0")) return;
    setSavingOrder(true);
    setOrderError(null);
    setFolderOrders((previous) => ({ ...previous, [parentPath.replace(/\\/g, "/")]: next }));
    try {
      await invoke("save_folder_order", { vaultRoot, parentPath, folderPaths: next });
    } catch {
      setFolderOrders((previous) => ({ ...previous, [parentPath.replace(/\\/g, "/")]: current }));
      setOrderError("Could not save folder order. Try dragging again.");
    } finally {
      setSavingOrder(false);
    }
  }

  return (
    <div className="bookshelf-container">
      {orderError && <p className="shelf-order-error" role="alert">{orderError}</p>}
      {fileNodes.length > 0 && (
        <ShelfSection
          title="General Modules Shelf"
          folderPath={undefined}
          files={fileNodes}
          vaultRoot={vaultRoot}
          onSelectFile={onSelectFile}
          onAddToWorkspace={onAddToWorkspace}
          onAddFile={onAddFile}
          onRemoveItem={onRemoveItem}
          onRenameItem={onRenameItem}
        />
      )}

      {folderNodes.map((folder) => (
        <FolderShelf
          key={folder.relative_path}
          folder={folder}
          parentPath=""
          siblings={folderNodes}
          folderOrders={folderOrders}
          draggedFolder={draggedFolder}
          dropTarget={dropTarget}
          onDragFolder={setDraggedFolder}
          onDropTarget={setDropTarget}
          onReorder={handleReorder}
          folderColors={folderColors}
          vaultRoot={vaultRoot}
          onSetFolderColor={handleSetFolderColor}
          onSelectFile={onSelectFile}
          onAddToWorkspace={onAddToWorkspace}
          onAddFile={onAddFile}
          onRemoveItem={onRemoveItem}
          onRenameItem={onRenameItem}
        />
      ))}

      {nodes.length === 0 && (
        <div className="empty-bookshelf-notice">
          <BookIcon size={32} />
          <p>Your bookshelf is empty. Add a folder or course module to place items on your shelf.</p>
          <button onClick={() => onAddFile()} className="primary-btn">
            Add First Module
          </button>
        </div>
      )}
    </div>
  );
};

interface FolderShelfProps {
  folder: VaultNode;
  parentPath: string;
  siblings: VaultNode[];
  folderOrders: Record<string, string[]>;
  draggedFolder: { path: string; parent: string } | null;
  dropTarget: { path: string; position: "before" | "after" } | null;
  onDragFolder: (value: { path: string; parent: string } | null) => void;
  onDropTarget: (value: { path: string; position: "before" | "after" } | null) => void;
  onReorder: (parent: string, siblings: VaultNode[], source: string, target: string, position: "before" | "after") => void;
  folderColors: Record<string, string>;
  vaultRoot: string;
  onSetFolderColor: (relPath: string, colorId: string) => void;
  onSelectFile: (node: VaultNode) => void;
  onAddToWorkspace: (node: VaultNode) => void;
  onAddFile: (targetFolderRelPath?: string) => void;
  onRemoveItem: (relPath: string, isFolder: boolean) => void;
  onRenameItem: (relPath: string, isFolder: boolean, currentName: string) => void;
}

const FolderShelf: React.FC<FolderShelfProps> = ({
  folder,
  parentPath,
  siblings,
  folderOrders,
  draggedFolder,
  dropTarget,
  onDragFolder,
  onDropTarget,
  onReorder,
  folderColors,
  vaultRoot,
  onSetFolderColor,
  onSelectFile,
  onAddToWorkspace,
  onAddFile,
  onRemoveItem,
  onRenameItem,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState<boolean>(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActionMenuOpen && !isColorPickerOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) {
        setIsActionMenuOpen(false);
        setIsColorPickerOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsActionMenuOpen(false);
        setIsColorPickerOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActionMenuOpen, isColorPickerOpen]);

  const currentColorId = folderColors[folder.relative_path];
  const currentColorObj = FOLDER_COLOR_PALETTE.find((c) => c.id === currentColorId);
  const folderColor = currentColorObj ? currentColorObj.primary : "#059669";

  const directFiles = folder.children.filter((c) => c.node_type !== "Folder");
  const subfolders = sortSiblingFolders(folder.children.filter((c) => c.node_type === "Folder"), folderOrders[folder.relative_path.replace(/\\/g, "/")]);

  const headerStyle = currentColorObj
    ? { backgroundColor: currentColorObj.secondary }
    : undefined;

  const wrapperStyle = currentColorObj
    ? { backgroundColor: currentColorObj.bg }
    : undefined;

  const barStyle = currentColorObj
    ? { backgroundColor: currentColorObj.secondary }
    : undefined;

  return (
    <div className={`shelf-wrapper ${isActionMenuOpen || isColorPickerOpen ? "has-open-actions" : ""}`} style={wrapperStyle}>
      <header className={`shelf-header-blueprint ${isActionMenuOpen || isColorPickerOpen ? "has-open-actions" : ""} ${dropTarget?.path === folder.relative_path ? `drop-${dropTarget.position}` : ""}`} style={headerStyle}
        onDragOver={(event) => {
          if (!draggedFolder || draggedFolder.parent !== parentPath || draggedFolder.path === folder.relative_path) {
            if (dropTarget?.path === folder.relative_path) onDropTarget(null);
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
          onDropTarget({ path: folder.relative_path, position });
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node) && dropTarget?.path === folder.relative_path) onDropTarget(null);
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (draggedFolder?.parent === parentPath && draggedFolder.path !== folder.relative_path) {
            const rect = event.currentTarget.getBoundingClientRect();
            onReorder(parentPath, siblings, draggedFolder.path, folder.relative_path, event.clientY < rect.top + rect.height / 2 ? "before" : "after");
          }
          onDragFolder(null);
          onDropTarget(null);
        }}>
        <div className="shelf-title-plate">
          <button type="button" className="shelf-chevron-badge" onClick={() => setIsExpanded((prev) => !prev)} aria-label={`${isExpanded ? "Collapse" : "Expand"} ${folder.name}`} aria-expanded={isExpanded}>
            {isExpanded ? "▼" : "▶"}
          </button>
          <button type="button" className="folder-icon-emblem" onClick={() => setIsExpanded((prev) => !prev)} aria-label={`${isExpanded ? "Collapse" : "Expand"} ${folder.name}`} aria-expanded={isExpanded}>
            <FolderIcon size={16} />
          </button>
          <div className="shelf-title-wrapper">
            <h3 className="shelf-title"><button type="button" className="shelf-title-button" onClick={() => setIsExpanded((prev) => !prev)} aria-expanded={isExpanded}>{folder.name}</button></h3>
            <span className="shelf-title-sub">{folder.children.length} {folder.children.length === 1 ? "ITEM" : "ITEMS"}</span>
          </div>
        </div>

        <div className="shelf-actions">
          {siblings.length > 1 && <button type="button" className="shelf-drag-handle" draggable
            aria-label={`Drag to reorder ${folder.name}`} title="Drag to reorder folder"
            onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", folder.relative_path); onDragFolder({ path: folder.relative_path, parent: parentPath }); }}
            onDragEnd={() => { onDragFolder(null); onDropTarget(null); }}><GripIcon size={17} /></button>}
          <div className="shelf-more-wrapper" ref={actionsRef}>
            <button
              type="button"
              onClick={() => {
                setIsColorPickerOpen(false);
                setIsActionMenuOpen((open) => !open);
              }}
              className="shelf-mini-btn shelf-more-btn"
              title="Folder actions"
              aria-label="Folder actions"
              aria-haspopup="true"
              aria-expanded={isActionMenuOpen || isColorPickerOpen}
            >
              <span aria-hidden="true">⋯</span>
            </button>

            {isActionMenuOpen && (
              <div className="shelf-actions-menu">
                {siblings.findIndex((item) => item.relative_path === folder.relative_path) > 0 &&
                  <button type="button" onClick={() => { const index = siblings.findIndex((item) => item.relative_path === folder.relative_path); onReorder(parentPath, siblings, folder.relative_path, siblings[index - 1].relative_path, "before"); setIsActionMenuOpen(false); }}>Move up</button>}
                {siblings.findIndex((item) => item.relative_path === folder.relative_path) < siblings.length - 1 &&
                  <button type="button" onClick={() => { const index = siblings.findIndex((item) => item.relative_path === folder.relative_path); onReorder(parentPath, siblings, folder.relative_path, siblings[index + 1].relative_path, "after"); setIsActionMenuOpen(false); }}>Move down</button>}
                <button type="button" onClick={() => {
                  setIsActionMenuOpen(false);
                  setIsColorPickerOpen(true);
                }}>Folder color</button>
                <button type="button" onClick={() => {
                  setIsActionMenuOpen(false);
                  onRenameItem(folder.relative_path, true, folder.name);
                }}>Display Name</button>
                <button type="button" onClick={() => {
                  setIsActionMenuOpen(false);
                  onAddFile(folder.relative_path);
                }}>Add Book</button>
              </div>
            )}

            {isColorPickerOpen && (
              <div className="color-picker-popover" onClick={(e) => e.stopPropagation()}>
                <div className="color-picker-header">
                  <div>
                    <strong>Folder color</strong>
                    <span>Choose a color for this shelf</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsColorPickerOpen(false)}
                    className="popover-close-btn"
                    aria-label="Close folder color picker"
                  >
                    <CloseIcon size={12} />
                  </button>
                </div>
                <div className="color-palette-grid" role="group" aria-label="Folder colors">
                  {FOLDER_COLOR_PALETTE.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      className="color-option-btn"
                      aria-pressed={(currentColorId ?? "emerald") === color.id}
                      onClick={() => {
                        onSetFolderColor(folder.relative_path, color.id);
                        setIsColorPickerOpen(false);
                      }}
                    >
                      <span className="color-option-swatch" style={{ backgroundColor: color.primary }} aria-hidden="true" />
                      <span>{color.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onRemoveItem(folder.relative_path, true)}
            className="shelf-mini-btn delete"
            title="Hide shelf folder from library"
            aria-label="Hide shelf folder from library"
          >
            <CloseIcon size={11} />
          </button>
        </div>
      </header>

      {isExpanded && (
        <div className="shelf-body">
          {directFiles.length > 0 ? (
            <div className="books-row">
              {directFiles.map((file, idx) => (
                <BookSpineItem
                  key={file.relative_path}
                  node={file}
                  vaultRoot={vaultRoot}
                  folderColor={folderColor}
                  colorVariant={idx % 4}
                  onSelectFile={onSelectFile}
                  onAddToWorkspace={onAddToWorkspace}
                  onRemoveItem={onRemoveItem}
                  onRenameItem={onRenameItem}
                />
              ))}
            </div>
          ) : (
            subfolders.length === 0 && (
              <div className="empty-shelf-row">
                <span className="empty-shelf-text">(Shelf is currently empty)</span>
                <button
                  onClick={() => onAddFile(folder.relative_path)}
                  className="shelf-add-link"
                >
                  <PlusIcon size={12} /> Place a module here
                </button>
              </div>
            )
          )}

          <div className="blueprint-shelf-bar" style={barStyle}>
            <div className="shelf-ticks">
              {Array.from({ length: 12 }).map((_, i) => (
                <span key={i} className="tick-mark" />
              ))}
            </div>
          </div>

          {subfolders.map((sub) => (
            <FolderShelf
              key={sub.relative_path}
              folder={sub}
              parentPath={folder.relative_path}
              siblings={subfolders}
              folderOrders={folderOrders}
              draggedFolder={draggedFolder}
              dropTarget={dropTarget}
              onDragFolder={onDragFolder}
              onDropTarget={onDropTarget}
              onReorder={onReorder}
              folderColors={folderColors}
              vaultRoot={vaultRoot}
              onSetFolderColor={onSetFolderColor}
              onSelectFile={onSelectFile}
              onAddToWorkspace={onAddToWorkspace}
              onAddFile={onAddFile}
              onRemoveItem={onRemoveItem}
              onRenameItem={onRenameItem}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ShelfSectionProps {
  title: string;
  folderPath?: string;
  files: VaultNode[];
  vaultRoot: string;
  onSelectFile: (node: VaultNode) => void;
  onAddToWorkspace: (node: VaultNode) => void;
  onAddFile: (targetFolderRelPath?: string) => void;
  onRemoveItem: (relPath: string, isFolder: boolean) => void;
  onRenameItem: (relPath: string, isFolder: boolean, currentName: string) => void;
}

const ShelfSection: React.FC<ShelfSectionProps> = ({
  title,
  folderPath,
  files,
  vaultRoot,
  onSelectFile,
  onAddToWorkspace,
  onAddFile,
  onRemoveItem,
  onRenameItem,
}) => {
  return (
    <div className="shelf-wrapper">
      <header className="shelf-header-blueprint">
        <div className="shelf-title-plate">
          <div className="folder-icon-emblem">
            <BookIcon size={16} />
          </div>
          <div className="shelf-title-wrapper">
            <h3 className="shelf-title">{title}</h3>
            <span className="shelf-title-sub">{files.length} {files.length === 1 ? "MODULE" : "MODULES"}</span>
          </div>
        </div>

        <div className="shelf-actions">
          <button
            onClick={() => onAddFile(folderPath)}
            className="shelf-mini-btn"
            title="Add module to shelf"
          >
            <PlusIcon size={14} /> Add Book
          </button>
        </div>
      </header>

      <div className="shelf-body">
        <div className="books-row">
          {files.map((file, idx) => (
            <BookSpineItem
              key={file.relative_path}
              node={file}
              vaultRoot={vaultRoot}
              folderColor="#059669"
              colorVariant={idx % 4}
              onSelectFile={onSelectFile}
              onAddToWorkspace={onAddToWorkspace}
              onRemoveItem={onRemoveItem}
              onRenameItem={onRenameItem}
            />
          ))}
        </div>
        <div className="blueprint-shelf-bar">
          <div className="shelf-ticks">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className="tick-mark" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function getFileExt(type: VaultNodeType): string {
  if (typeof type === "object" && "File" in type) {
    return type.File.toUpperCase();
  }
  return "DOC";
}

interface BookSpineItemProps {
  node: VaultNode;
  vaultRoot: string;
  folderColor?: string;
  colorVariant: number;
  onSelectFile: (node: VaultNode) => void;
  onAddToWorkspace: (node: VaultNode) => void;
  onRemoveItem: (relPath: string, isFolder: boolean) => void;
  onRenameItem: (relPath: string, isFolder: boolean, currentName: string) => void;
}

const BookSpineItem: React.FC<BookSpineItemProps> = ({
  node,
  vaultRoot,
  folderColor,
  colorVariant,
  onSelectFile,
  onAddToWorkspace,
  onRemoveItem,
  onRenameItem,
}) => {
  const ext = getFileExt(node.node_type);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [lastReadPage, setLastReadPage] = useState<number | null | undefined>(undefined);
  const [progressUnavailable, setProgressUnavailable] = useState(false);
  const [nearViewport, setNearViewport] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (nearViewport || (ext !== "PDF" && ext !== "PPT" && ext !== "PPTX")) return;
    const card = cardRef.current;
    if (!card) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: "160px" });
    observer.observe(card);
    return () => observer.disconnect();
  }, [ext, nearViewport]);

  const positionTooltip = useCallback(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    const visualViewport = window.visualViewport;
    const viewport = {
      left: visualViewport?.offsetLeft ?? 0,
      top: visualViewport?.offsetTop ?? 0,
      width: visualViewport?.width ?? document.documentElement.clientWidth,
      height: visualViewport?.height ?? document.documentElement.clientHeight,
    };
    tooltip.style.maxWidth = `${Math.max(1, viewport.width - 16)}px`;
    tooltip.style.maxHeight = `${Math.max(1, viewport.height - 16)}px`;
    const { width, height } = tooltip.getBoundingClientRect();
    const { x, y } = getTooltipPosition(pointerRef.current, { width, height }, viewport);
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.style.visibility = "visible";
  }, []);

  function updateTooltipPosition(event: React.MouseEvent<HTMLDivElement>) {
    pointerRef.current = { x: event.clientX, y: event.clientY };
    positionTooltip();
  }

  useLayoutEffect(() => {
    if (!isTooltipVisible) return;
    positionTooltip();
    const visualViewport = window.visualViewport;
    window.addEventListener("resize", positionTooltip);
    visualViewport?.addEventListener("resize", positionTooltip);
    visualViewport?.addEventListener("scroll", positionTooltip);
    return () => {
      window.removeEventListener("resize", positionTooltip);
      visualViewport?.removeEventListener("resize", positionTooltip);
      visualViewport?.removeEventListener("scroll", positionTooltip);
    };
  }, [isTooltipVisible, node.name, positionTooltip]);

  useEffect(() => {
    let isMounted = true;
    if (!vaultRoot || !nearViewport || (ext !== "PDF" && ext !== "PPT" && ext !== "PPTX")) {
      setCoverUrl(null);
      return;
    }

    getModuleCoverThumbnail(vaultRoot, node.relative_path, ext)
      .then((url) => {
        if (isMounted) {
          setCoverUrl(url);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCoverUrl(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [vaultRoot, node.relative_path, ext, nearViewport]);

  useEffect(() => {
    if (!vaultRoot || !nearViewport || ext === "MD") return;
    let active = true;
    setLastReadPage(undefined);
    setProgressUnavailable(false);
    invoke<number | null>("get_reading_progress", { vaultRoot, relativePath: node.relative_path })
      .then((page) => { if (active) setLastReadPage(page); })
      .catch(() => { if (active) setProgressUnavailable(true); });
    return () => { active = false; };
  }, [vaultRoot, node.relative_path, ext, nearViewport]);

  const readingState = ext === "MD"
    ? "reading position not tracked"
    : progressUnavailable
      ? "reading position unavailable"
      : lastReadPage === undefined
        ? "reading position loading"
        : lastReadPage === null
          ? "not started"
          : `last read on page ${lastReadPage}`;

  return (
    <div
      ref={cardRef}
      className={`book-spine-card variant-${colorVariant} ${coverUrl ? "has-cover-snapshot" : ""}`}
      style={{ "--folder-hover-color": folderColor || "#059669" } as React.CSSProperties}
      onMouseEnter={(event) => {
        updateTooltipPosition(event);
        setIsTooltipVisible(true);
      }}
      onMouseMove={updateTooltipPosition}
      onMouseLeave={() => setIsTooltipVisible(false)}
    >
      <div className="book-spine-ridge-left" aria-hidden="true" />

      <button type="button" className="book-spine-open"
        onClick={() => onSelectFile(node)}
        aria-label={`Open ${node.name}, ${ext} module, ${readingState}`}>
        <span className="book-spine-content">
          {coverUrl ? (
            <span className="book-cover-snapshot-plate">
              <img
                src={coverUrl}
                alt=""
                className="book-cover-snapshot-img"
                loading="lazy"
              />
            </span>
          ) : (
            <span className="book-spine-icon" aria-hidden="true">
              {ext === "MD" ? <BookIcon size={18} /> : <FileIcon size={18} />}
            </span>
          )}
          <span className="book-spine-title">{node.name}</span>
        </span>

        <span className="book-spine-footer">
          <span className={`book-type-badge ${ext.toLowerCase()}`}>
            {ext}
          </span>
        </span>
      </button>

      <div className="book-spine-actions">
        {ext !== "MD" && <button type="button"
          onClick={() => onAddToWorkspace(node)}
          className="book-rename-btn"
          aria-label={`Add ${node.name} to workspace`} title="Add to workspace"
        >
          <PlusIcon size={11} />
        </button>}
        <button type="button"
          onClick={() => onRenameItem(node.relative_path, false, node.name)}
          className="book-rename-btn"
          aria-label={`Change display name for ${node.name}`} title="Change module display name"
        >
          <PencilIcon size={11} />
        </button>
        <button type="button"
          onClick={() => onRemoveItem(node.relative_path, false)}
          className="book-delete-btn"
          aria-label={`Hide ${node.name} from library`} title="Hide from library"
        >
          <CloseIcon size={12} />
        </button>
      </div>

      <div className="book-binding-lines" aria-hidden="true">
        <span className="binding-line" />
        <span className="binding-line" />
      </div>

      {isTooltipVisible && (
        createPortal(
          <div
            ref={tooltipRef}
            className="book-metadata-tooltip"
            role="tooltip"
          >
            <strong className="book-metadata-tooltip-title">{node.name}</strong>
            <span>{ext}</span>
          </div>,
          document.body,
        )
      )}
    </div>
  );
};


