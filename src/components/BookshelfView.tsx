import React, { useState } from "react";
import { VaultNode, VaultNodeType } from "../types/vault";
import { FolderIcon, FileIcon, PlusIcon, CloseIcon, BookIcon } from "./Icons";
import "./BookshelfView.css";

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
  // Separate top-level folders and top-level files
  const folderNodes = nodes.filter((n) => n.node_type === "Folder");
  const fileNodes = nodes.filter((n) => n.node_type !== "Folder");

  return (
    <div className="bookshelf-container">
      {/* Top Level Loose Files Shelf (if any) */}
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

      {/* Folders as Shelves */}
      {folderNodes.map((folder) => (
        <FolderShelf
          key={folder.relative_path}
          folder={folder}
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
  onSelectFile: (node: VaultNode) => void;
  onAddFile: (targetFolderRelPath?: string) => void;
  onRemoveItem: (relPath: string, isFolder: boolean) => void;
}

const FolderShelf: React.FC<FolderShelfProps> = ({
  folder,
  onSelectFile,
  onAddFile,
  onRemoveItem,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Direct files inside this folder
  const directFiles = folder.children.filter((c) => c.node_type !== "Folder");
  // Subfolders inside this folder
  const subfolders = folder.children.filter((c) => c.node_type === "Folder");

  return (
    <div className="shelf-wrapper">
      <header className="shelf-header-blueprint">
        <div className="shelf-title-plate" onClick={() => setIsExpanded((prev) => !prev)}>
          <span className="shelf-chevron">{isExpanded ? "▼" : "▶"}</span>
          <FolderIcon size={16} />
          <h3 className="shelf-title">{folder.name}</h3>
          <span className="shelf-count-badge">
            {folder.children.length} {folder.children.length === 1 ? "item" : "items"}
          </span>
        </div>

        <div className="shelf-actions">
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
          {/* Direct Books Row */}
          {directFiles.length > 0 ? (
            <div className="books-row">
              {directFiles.map((file, idx) => (
                <BookSpineItem
                  key={file.relative_path}
                  node={file}
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

          {/* Architectural Wooden/Blueprint Shelf Line */}
          <div className="blueprint-shelf-bar">
            <div className="shelf-ticks">
              {Array.from({ length: 12 }).map((_, i) => (
                <span key={i} className="tick-mark" />
              ))}
            </div>
          </div>

          {/* Render Subfolders as Nested Sub-Shelves */}
          {subfolders.map((sub) => (
            <FolderShelf
              key={sub.relative_path}
              folder={sub}
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
          <BookIcon size={16} />
          <h3 className="shelf-title">{title}</h3>
          <span className="shelf-count-badge">
            {files.length} {files.length === 1 ? "module" : "modules"}
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
  colorVariant: number;
  onSelectFile: (node: VaultNode) => void;
  onRemoveItem: (relPath: string, isFolder: boolean) => void;
}

const BookSpineItem: React.FC<BookSpineItemProps> = ({
  node,
  colorVariant,
  onSelectFile,
  onRemoveItem,
}) => {
  const ext = getFileExt(node.node_type);
  const savedPage = localStorage.getItem(`syllex_progress_${node.relative_path}`);

  return (
    <div
      className={`book-spine-card variant-${colorVariant}`}
      onClick={() => onSelectFile(node)}
      title={`Open ${node.name}`}
    >
      <div className="book-spine-header">
        <span className={`book-type-badge ${ext.toLowerCase()}`}>{ext}</span>
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
          <FileIcon size={20} />
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
