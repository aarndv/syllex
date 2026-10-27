import React, { useEffect, useMemo, useState } from "react";
import { VaultNode, VaultNodeType } from "../types/vault";
import { PlusIcon, CloseIcon, PencilIcon, FolderIcon, FileIcon } from "./Icons";

interface FileTreeProps {
  nodes: VaultNode[];
  activePath?: string;
  compact?: boolean;
  onSelectFile: (node: VaultNode) => void;
  onAddFile: (targetFolderRelPath?: string) => void;
  onRemoveItem: (relPath: string, isFolder: boolean) => void;
  onRenameItem: (relPath: string, isFolder: boolean, currentName: string) => void;
}

function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function findActiveFile(nodes: VaultNode[], activePath?: string, ancestors: string[] = []):
  { node: VaultNode; ancestors: string[] } | null {
  if (!activePath) return null;
  for (const node of nodes) {
    if (node.node_type === "Folder") {
      const found = findActiveFile(node.children, activePath, [...ancestors, node.relative_path]);
      if (found) return found;
    } else if (normalizeRelativePath(node.relative_path) === normalizeRelativePath(activePath)) {
      return { node, ancestors };
    }
  }
  return null;
}

function getFileFormat(type: VaultNodeType): string {
  return typeof type === "object" ? type.File.toUpperCase() : "Folder";
}

export const FileTree: React.FC<FileTreeProps> = React.memo(({
  nodes, activePath, compact = false, onSelectFile, onAddFile, onRemoveItem, onRenameItem,
}) => {
  const activeFile = useMemo(() => findActiveFile(nodes, activePath), [nodes, activePath]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set(activeFile?.ancestors ?? [])
  );
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null);

  useEffect(() => {
    if (!activeFile) return;
    setExpandedPaths((previous) => {
      if (activeFile.ancestors.every((path) => previous.has(path))) return previous;
      return new Set([...previous, ...activeFile.ancestors]);
    });
  }, [activePath]);

  useEffect(() => {
    if (!openMenuPath) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".tree-item-menu")) {
        setOpenMenuPath(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpenMenuPath(null);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuPath]);

  const toggleFolder = (path: string) => {
    setOpenMenuPath(null);
    setExpandedPaths((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };
  const showCurrentFile = compact && activeFile &&
    activeFile.ancestors.some((path) => !expandedPaths.has(path));

  return (
    <div className={`file-tree-container ${compact ? "is-compact" : ""}`}>
      {showCurrentFile && (
        <div className="tree-current-file">
          <span className="tree-current-heading">Current file</span>
          <button type="button" className="tree-current-link"
            onClick={() => onSelectFile(activeFile.node)}
            title={activeFile.node.relative_path} aria-current="page">
            <FileIcon size={14} /><span>{activeFile.node.name}</span>
          </button>
        </div>
      )}
      {nodes.length === 0 ? (
        <div className="tree-empty-notice">No items in this directory.</div>
      ) : (
        <ul className="tree-root-list">
          {nodes.map((node) => (
            <FileTreeNode key={node.relative_path} node={node} activePath={activePath}
              compact={compact} expandedPaths={expandedPaths} openMenuPath={openMenuPath}
              onToggleFolder={toggleFolder}
              onToggleMenu={(path) => setOpenMenuPath((current) => current === path ? null : path)}
              onCloseMenu={() => setOpenMenuPath(null)}
              onSelectFile={onSelectFile} onAddFile={onAddFile}
              onRemoveItem={onRemoveItem} onRenameItem={onRenameItem} />
          ))}
        </ul>
      )}
    </div>
  );
});

interface FileTreeNodeProps extends Pick<FileTreeProps,
  "activePath" | "compact" | "onSelectFile" | "onAddFile" | "onRemoveItem" | "onRenameItem"> {
  node: VaultNode;
  expandedPaths: Set<string>;
  openMenuPath: string | null;
  onToggleFolder: (path: string) => void;
  onToggleMenu: (path: string) => void;
  onCloseMenu: () => void;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = React.memo(({
  node, activePath, compact, expandedPaths, openMenuPath, onToggleFolder,
  onToggleMenu, onCloseMenu, onSelectFile, onAddFile, onRemoveItem, onRenameItem,
}) => {
  const isFolder = node.node_type === "Folder";
  const isOpen = expandedPaths.has(node.relative_path);
  const isActive = !isFolder &&
    normalizeRelativePath(activePath || "") === normalizeRelativePath(node.relative_path);
  const format = getFileFormat(node.node_type);
  const actions = compact ? (
    <div className="tree-item-menu">
      <button type="button" className="tree-menu-trigger"
        aria-label={`Actions for ${node.name}`} aria-expanded={openMenuPath === node.relative_path}
        onClick={() => onToggleMenu(node.relative_path)}>...</button>
      {openMenuPath === node.relative_path && (
        <div className="tree-menu-panel">
          <button type="button" onClick={() => {
            onCloseMenu(); onRenameItem(node.relative_path, isFolder, node.name);
          }}><PencilIcon size={13} /> Rename</button>
          {isFolder && <button type="button" onClick={() => {
            onCloseMenu(); onAddFile(node.relative_path);
          }}><PlusIcon size={13} /> Add file to folder</button>}
          <button type="button" className="tree-menu-delete" onClick={() => {
            onCloseMenu(); onRemoveItem(node.relative_path, isFolder);
          }}><CloseIcon size={13} /> Delete {isFolder ? "folder" : "file"}</button>
        </div>
      )}
    </div>
  ) : (
    <div className="tree-item-actions">
      <button type="button" onClick={() => onRenameItem(node.relative_path, isFolder, node.name)}
        className="tree-mini-btn" title={`Rename ${isFolder ? "folder" : "module"}`}>
        <PencilIcon size={12} />
      </button>
      {isFolder && <button type="button" onClick={() => onAddFile(node.relative_path)}
        className="tree-mini-btn" title="Add file to folder"><PlusIcon size={12} /></button>}
      <button type="button" onClick={() => onRemoveItem(node.relative_path, isFolder)}
        className="tree-mini-btn delete" title={`Delete ${isFolder ? "folder" : "file"}`}>
        <CloseIcon size={12} />
      </button>
    </div>
  );

  return (
    <li className={isFolder ? "tree-item-group" : "tree-item-single"}>
      <div className={`tree-row ${isFolder ? "folder-row" : "file-row"} ${isActive ? "is-active" : ""}`}>
        <button type="button" className="tree-row-main"
          onClick={() => isFolder ? onToggleFolder(node.relative_path) : onSelectFile(node)}
          aria-expanded={isFolder ? isOpen : undefined}
          aria-current={isActive ? "page" : undefined} title={node.name}>
          {isFolder ? <span className="tree-chevron" aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
            : <span className="tree-chevron-placeholder" />}
          {compact ? (
            <span className={`tree-type-icon ${isFolder ? "dir" : format.toLowerCase()}`}
              title={format} aria-label={format}>
              {isFolder ? <FolderIcon size={14} /> : <FileIcon size={14} />}
            </span>
          ) : (
            <span className={`tree-type-pill ${isFolder ? "dir" : format.toLowerCase()}`}>
              {isFolder ? "DIR" : format === "PPTX" ? "PPT" : format}
            </span>
          )}
          <span className={`tree-label ${isFolder ? "folder-label" : "file-label"}`}>{node.name}</span>
        </button>
        {actions}
      </div>
      {isFolder && isOpen && (
        <ul className="tree-sub-list">
          {node.children.length === 0 ? <li className="tree-empty-sub">(Empty directory)</li>
            : node.children.map((child) => (
              <FileTreeNode key={child.relative_path} node={child} activePath={activePath}
                compact={compact} expandedPaths={expandedPaths} openMenuPath={openMenuPath}
                onToggleFolder={onToggleFolder} onToggleMenu={onToggleMenu}
                onCloseMenu={onCloseMenu} onSelectFile={onSelectFile} onAddFile={onAddFile}
                onRemoveItem={onRemoveItem} onRenameItem={onRenameItem} />
            ))}
        </ul>
      )}
    </li>
  );
});
