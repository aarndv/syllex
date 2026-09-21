import React, { useState } from "react";
import { VaultNode, VaultNodeType } from "../types/vault";
import { FolderIcon, FileIcon, PlusIcon, CloseIcon, BookIcon, PencilIcon } from "./Icons";
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
  onSelectFile: (node: VaultNode) => void;
  onAddFile: (targetFolderRelPath?: string) => void;
  onRemoveItem: (relPath: string, isFolder: boolean) => void;
}

export const BookshelfView: React.FC<BookshelfViewProps> = ({
  nodes,
  onSelectFile,
  onAddFile,
  onRemoveItem,
}) => {
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

  const folderNodes = nodes.filter((n) => n.node_type === "Folder");
  const fileNodes = nodes.filter((n) => n.node_type !== "Folder");

  return (
    <div className="bookshelf-container">
      {fileNodes.length > 0 && (
        <ShelfSection
          title="General Modules Shelf"
          folderPath={undefined}
          files={fileNodes}
          onSelectFile={onSelectFile}
          onAddFile={onAddFile}
          onRemoveItem={onRemoveItem}
        />
      )}

      {folderNodes.map((folder) => (
        <FolderShelf
          key={folder.relative_path}
          folder={folder}
          folderColors={folderColors}
          onSetFolderColor={handleSetFolderColor}
          onSelectFile={onSelectFile}
          onAddFile={onAddFile}
          onRemoveItem={onRemoveItem}
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
  folderColors: Record<string, string>;
  onSetFolderColor: (relPath: string, colorId: string) => void;
  onSelectFile: (node: VaultNode) => void;
  onAddFile: (targetFolderRelPath?: string) => void;
  onRemoveItem: (relPath: string, isFolder: boolean) => void;
}

const FolderShelf: React.FC<FolderShelfProps> = ({
  folder,
  folderColors,
  onSetFolderColor,
  onSelectFile,
  onAddFile,
  onRemoveItem,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState<boolean>(false);

  const currentColorId = folderColors[folder.relative_path];
  const currentColorObj = FOLDER_COLOR_PALETTE.find((c) => c.id === currentColorId);
  const folderColor = currentColorObj ? currentColorObj.primary : "#059669";

  const directFiles = folder.children.filter((c) => c.node_type !== "Folder");
  const subfolders = folder.children.filter((c) => c.node_type === "Folder");

  const headerStyle = currentColorObj
    ? { background: `linear-gradient(135deg, ${currentColorObj.primary} 0%, ${currentColorObj.secondary} 70%, rgba(13, 34, 23, 0.95) 100%)` }
    : undefined;

  const wrapperStyle = currentColorObj
    ? { background: `linear-gradient(180deg, ${currentColorObj.bg} 0%, rgba(13, 37, 23, 0.65) 100%)` }
    : undefined;

  const barStyle = currentColorObj
    ? { background: `linear-gradient(180deg, ${currentColorObj.secondary} 0%, rgba(10, 28, 18, 0.95) 100%)` }
    : undefined;

  return (
    <div className={`shelf-wrapper ${isColorPickerOpen ? "has-open-picker" : ""}`} style={wrapperStyle}>
      <header className={`shelf-header-blueprint ${isColorPickerOpen ? "has-open-picker" : ""}`} style={headerStyle}>
        <div className="shelf-title-plate" onClick={() => setIsExpanded((prev) => !prev)}>
          <span className="shelf-chevron-badge">{isExpanded ? "▼" : "▶"}</span>
          <div className="folder-icon-emblem">
            <FolderIcon size={16} />
          </div>
          <div className="shelf-title-wrapper">
            <h3 className="shelf-title">{folder.name}</h3>
            <span className="shelf-title-sub">COLLECTION ARCHIVE</span>
          </div>
          <span className="shelf-count-badge">
            <span className="count-num">{folder.children.length}</span>
            <span className="count-label">{folder.children.length === 1 ? "ITEM" : "ITEMS"}</span>
          </span>
        </div>

        <div className="shelf-actions">
          <div className="color-picker-wrapper">
            <button
              onClick={() => setIsColorPickerOpen((prev) => !prev)}
              className="shelf-mini-btn pencil-btn"
              title="Customize Folder Color Palette"
            >
              <PencilIcon size={13} />
            </button>

            {isColorPickerOpen && (
              <div className="color-picker-popover" onClick={(e) => e.stopPropagation()}>
                <div className="color-picker-header">
                  <span>Folder Colors (16 Options)</span>
                  <button
                    onClick={() => setIsColorPickerOpen(false)}
                    className="popover-close-btn"
                  >
                    <CloseIcon size={12} />
                  </button>
                </div>
                <div className="color-palette-grid">
                  {FOLDER_COLOR_PALETTE.map((color) => (
                    <button
                      key={color.id}
                      className={`color-dot-btn ${currentColorId === color.id ? "selected" : ""}`}
                      style={{ background: `linear-gradient(135deg, ${color.primary}, ${color.secondary})` }}
                      title={color.name}
                      onClick={() => {
                        onSetFolderColor(folder.relative_path, color.id);
                        setIsColorPickerOpen(false);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => onAddFile(folder.relative_path)}
            className="shelf-mini-btn"
            title="Add module to shelf"
          >
            <PlusIcon size={14} /> Add Book
          </button>
          <button
            onClick={() => onRemoveItem(folder.relative_path, true)}
            className="shelf-mini-btn delete"
            title="Remove shelf folder"
          >
            <CloseIcon size={14} />
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
                  folderColor={folderColor}
                  colorVariant={idx % 4}
                  onSelectFile={onSelectFile}
                  onRemoveItem={onRemoveItem}
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
              folderColors={folderColors}
              onSetFolderColor={onSetFolderColor}
              onSelectFile={onSelectFile}
              onAddFile={onAddFile}
              onRemoveItem={onRemoveItem}
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
  onSelectFile: (node: VaultNode) => void;
  onAddFile: (targetFolderRelPath?: string) => void;
  onRemoveItem: (relPath: string, isFolder: boolean) => void;
}

const ShelfSection: React.FC<ShelfSectionProps> = ({
  title,
  folderPath,
  files,
  onSelectFile,
  onAddFile,
  onRemoveItem,
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
            <span className="shelf-title-sub">GENERAL VAULT MODULES</span>
          </div>
          <span className="shelf-count-badge">
            <span className="count-num">{files.length}</span>
            <span className="count-label">{files.length === 1 ? "MODULE" : "MODULES"}</span>
          </span>
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
              folderColor="#059669"
              colorVariant={idx % 4}
              onSelectFile={onSelectFile}
              onRemoveItem={onRemoveItem}
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
  folderColor?: string;
  colorVariant: number;
  onSelectFile: (node: VaultNode) => void;
  onRemoveItem: (relPath: string, isFolder: boolean) => void;
}

const BookSpineItem: React.FC<BookSpineItemProps> = ({
  node,
  folderColor,
  colorVariant,
  onSelectFile,
  onRemoveItem,
}) => {
  const ext = getFileExt(node.node_type);
  const savedPage = localStorage.getItem(`syllex_progress_${node.relative_path}`);

  return (
    <div
      className={`book-spine-card variant-${colorVariant}`}
      style={{ "--folder-hover-color": folderColor || "#059669" } as React.CSSProperties}
      onClick={() => onSelectFile(node)}
      title={`Open ${node.name}`}
    >
      <div className="book-spine-ridge-left" />

      <div className="book-spine-header">
        <span className={`book-type-badge ${ext.toLowerCase()}`}>
          <span className="badge-dot" />
          {ext}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemoveItem(node.relative_path, false);
          }}
          className="book-delete-btn"
          title="Remove from shelf"
        >
          <CloseIcon size={12} />
        </button>
      </div>

      <div className="book-spine-content">
        <div className="book-spine-icon">
          {ext === "MD" ? <BookIcon size={18} /> : <FileIcon size={18} />}
        </div>
        <span className="book-spine-title">{node.name}</span>
      </div>

      <div className="book-spine-footer">
        {savedPage ? (
          <span className="book-progress-ribbon">Page {savedPage}</span>
        ) : (
          <span className="book-unread-tag">Unread</span>
        )}
      </div>

      <div className="book-binding-lines">
        <span className="binding-line" />
        <span className="binding-line" />
      </div>
    </div>
  );
};

