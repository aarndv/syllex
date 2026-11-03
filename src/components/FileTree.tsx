import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { VaultNode, VaultNodeType } from "../types/vault";
import { PlusIcon, CloseIcon, PencilIcon, FolderIcon, FileIcon } from "./Icons";
import { getTreeNavigation, getVisibleTreeNodes } from "../utils/treeNavigation";

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
  const [focusedPath, setFocusedPath] = useState<string | null>(
    () => activeFile?.node.relative_path ?? nodes[0]?.relative_path ?? null
  );
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const keyboardHintId = useId();
  const visibleNodes = useMemo(() => getVisibleTreeNodes(nodes, expandedPaths), [nodes, expandedPaths]);

  useEffect(() => {
    if (!activeFile) return;
    setExpandedPaths((previous) => {
      if (activeFile.ancestors.every((path) => previous.has(path))) return previous;
      return new Set([...previous, ...activeFile.ancestors]);
    });
  }, [activeFile]);

  useEffect(() => {
    if (visibleNodes.some(({ node }) => node.relative_path === focusedPath)) return;
    setFocusedPath(visibleNodes[0]?.node.relative_path ?? null);
  }, [focusedPath, visibleNodes]);

  useEffect(() => {
    if (!openMenuPath) return;
    itemRefs.current.get(openMenuPath)?.querySelector<HTMLButtonElement>(".tree-menu-panel button")?.focus();
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".tree-item-menu")) {
        setOpenMenuPath(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpenMenuPath(null);
        setFocusedPath(openMenuPath);
        itemRefs.current.get(openMenuPath)?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuPath]);

  const focusItem = (path: string) => {
    setFocusedPath(path);
    itemRefs.current.get(path)?.focus();
  };

  const toggleFolder = (path: string) => {
    setOpenMenuPath(null);
    if (expandedPaths.has(path) && focusedPath &&
      normalizeRelativePath(focusedPath).startsWith(`${normalizeRelativePath(path)}/`)) {
      focusItem(path);
    }
    setExpandedPaths((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const activateNode = (node: VaultNode) => {
    if (node.node_type === "Folder") toggleFolder(node.relative_path);
    else onSelectFile(node);
  };

  const handleTreeKeyDown = (event: React.KeyboardEvent<HTMLLIElement>, node: VaultNode) => {
    if (event.target !== event.currentTarget) return;
    const navigation = getTreeNavigation(visibleNodes, node.relative_path, event.key, expandedPaths);
    if (navigation) {
      event.preventDefault();
      event.stopPropagation();
      if (navigation.togglePath) toggleFolder(navigation.togglePath);
      if (navigation.focusPath) focusItem(navigation.focusPath);
      return;
    }

    switch (event.key) {
      case "Enter":
      case " ":
        activateNode(node);
        break;
      case "ContextMenu":
        setOpenMenuPath(node.relative_path);
        break;
      case "F10":
        if (!event.shiftKey) return;
        setOpenMenuPath(node.relative_path);
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
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
      <span className="tree-keyboard-hint" id={keyboardHintId}>
        Use arrow keys to move through files and folders. Press Shift+F10 for item actions.
      </span>
      <ul className="tree-root-list" role="tree" aria-label={compact ? "Vault Explorer" : "Explorer Tree"}
        aria-describedby={keyboardHintId} tabIndex={nodes.length === 0 ? 0 : undefined}>
        {nodes.length === 0 ? (
          <li className="tree-empty-notice" role="none">No items in this directory.</li>
        ) : nodes.map((node) => (
          <FileTreeNode key={node.relative_path} node={node} activePath={activePath}
            compact={compact} expandedPaths={expandedPaths} focusedPath={focusedPath}
            openMenuPath={openMenuPath} onActivate={activateNode} onFocusItem={focusItem}
            onKeyDown={handleTreeKeyDown}
            registerItem={(path, element) => {
              if (element) itemRefs.current.set(path, element);
              else itemRefs.current.delete(path);
            }}
            onToggleMenu={(path) => {
              setFocusedPath(path);
              setOpenMenuPath((current) => current === path ? null : path);
            }}
            onCloseMenu={() => setOpenMenuPath(null)} onAddFile={onAddFile}
            onRemoveItem={onRemoveItem} onRenameItem={onRenameItem} />
        ))}
      </ul>
    </div>
  );
});

interface FileTreeNodeProps extends Pick<FileTreeProps,
  "activePath" | "compact" | "onAddFile" | "onRemoveItem" | "onRenameItem"> {
  node: VaultNode;
  expandedPaths: Set<string>;
  focusedPath: string | null;
  openMenuPath: string | null;
  onActivate: (node: VaultNode) => void;
  onFocusItem: (path: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLLIElement>, node: VaultNode) => void;
  registerItem: (path: string, element: HTMLLIElement | null) => void;
  onToggleMenu: (path: string) => void;
  onCloseMenu: () => void;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = React.memo(({
  node, activePath, compact, expandedPaths, focusedPath, openMenuPath,
  onActivate, onFocusItem, onKeyDown, registerItem, onToggleMenu, onCloseMenu,
  onAddFile, onRemoveItem, onRenameItem,
}) => {
  const isFolder = node.node_type === "Folder";
  const isOpen = expandedPaths.has(node.relative_path);
  const isActive = !isFolder &&
    normalizeRelativePath(activePath || "") === normalizeRelativePath(node.relative_path);
  const format = getFileFormat(node.node_type);

  return (
    <li ref={(element) => registerItem(node.relative_path, element)}
      className={isFolder ? "tree-item-group" : "tree-item-single"}
      role="treeitem" tabIndex={focusedPath === node.relative_path ? 0 : -1}
      aria-label={isFolder ? node.name : `${node.name}, ${format}`}
      aria-expanded={isFolder ? isOpen : undefined} aria-selected={isActive}
      aria-current={isActive ? "page" : undefined}
      onFocus={(event) => {
        if (event.target === event.currentTarget) onFocusItem(node.relative_path);
      }}
      onClick={(event) => {
        if (!(event.target instanceof Element) ||
          event.target.closest('[role="treeitem"]') !== event.currentTarget ||
          event.target.closest(".tree-item-menu")) return;
        onFocusItem(node.relative_path);
        onActivate(node);
      }}
      onKeyDown={(event) => onKeyDown(event, node)}>
      <div className={`tree-row ${isFolder ? "folder-row" : "file-row"} ${isActive ? "is-active" : ""}`}>
        <div className="tree-row-main" title={node.name}>
          {isFolder ? <span className="tree-chevron" aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
            : <span className="tree-chevron-placeholder" aria-hidden="true" />}
          {compact ? (
            <span className={`tree-type-icon ${isFolder ? "dir" : format.toLowerCase()}`} aria-hidden="true">
              {isFolder ? <FolderIcon size={14} /> : <FileIcon size={14} />}
            </span>
          ) : (
            <span className={`tree-type-pill ${isFolder ? "dir" : format.toLowerCase()}`} aria-hidden="true">
              {isFolder ? "DIR" : format === "PPTX" ? "PPT" : format}
            </span>
          )}
          <span className={`tree-label ${isFolder ? "folder-label" : "file-label"}`}>{node.name}</span>
        </div>
        <div className="tree-item-menu">
          <button type="button" className="tree-menu-trigger" tabIndex={-1}
            aria-label={`Actions for ${node.name}`} aria-expanded={openMenuPath === node.relative_path}
            onClick={() => onToggleMenu(node.relative_path)}>…</button>
          {openMenuPath === node.relative_path && (
            <div className="tree-menu-panel">
              <button type="button" aria-label={`Rename ${node.name}`} onClick={() => {
                onCloseMenu(); onRenameItem(node.relative_path, isFolder, node.name);
              }}><PencilIcon size={13} /> Rename</button>
              {isFolder && <button type="button" aria-label={`Add file to ${node.name}`} onClick={() => {
                onCloseMenu(); onAddFile(node.relative_path);
              }}><PlusIcon size={13} /> Add file to folder</button>}
              <button type="button" className="tree-menu-delete"
                aria-label={`Delete ${isFolder ? "folder" : "file"} ${node.name}`} onClick={() => {
                  onCloseMenu(); onRemoveItem(node.relative_path, isFolder);
                }}><CloseIcon size={13} /> Delete {isFolder ? "folder" : "file"}</button>
            </div>
          )}
        </div>
      </div>
      {isFolder && isOpen && (
        <ul className="tree-sub-list" role="group">
          {node.children.length === 0 ? <li className="tree-empty-sub" role="none">(Empty directory)</li>
            : node.children.map((child) => (
              <FileTreeNode key={child.relative_path} node={child} activePath={activePath}
                compact={compact} expandedPaths={expandedPaths} focusedPath={focusedPath}
                openMenuPath={openMenuPath} onActivate={onActivate} onFocusItem={onFocusItem}
                onKeyDown={onKeyDown} registerItem={registerItem} onToggleMenu={onToggleMenu}
                onCloseMenu={onCloseMenu} onAddFile={onAddFile}
                onRemoveItem={onRemoveItem} onRenameItem={onRenameItem} />
            ))}
        </ul>
      )}
    </li>
  );
});
