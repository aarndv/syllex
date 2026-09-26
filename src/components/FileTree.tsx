import React, { useState, useMemo } from "react";
import { VaultNode, VaultNodeType } from "../types/vault";
import { PlusIcon, CloseIcon, PencilIcon } from "./Icons";

interface FileTreeProps {
  nodes: VaultNode[];
  activePath?: string;
  onSelectFile: (node: VaultNode) => void;
  onAddFile: (targetFolderRelPath?: string) => void;
  onRemoveItem: (relPath: string, isFolder: boolean) => void;
  onRenameItem: (relPath: string, isFolder: boolean, currentName: string) => void;
}

export const FileTree: React.FC<FileTreeProps> = React.memo(({
  nodes,
  activePath,
  onSelectFile,
  onAddFile,
  onRemoveItem,
  onRenameItem,
}) => {
  return (
    <div className="file-tree-container">
      {nodes.length === 0 ? (
        <div className="tree-empty-notice">No items in this directory.</div>
      ) : (
        <ul className="tree-root-list">
          {nodes.map((node) => (
            <FileTreeNode
              key={node.relative_path}
              node={node}
              depth={0}
              activePath={activePath}
              onSelectFile={onSelectFile}
              onAddFile={onAddFile}
              onRemoveItem={onRemoveItem}
              onRenameItem={onRenameItem}
            />
          ))}
        </ul>
      )}
    </div>
  );
});

const FileTreeNode: React.FC<{
  node: VaultNode;
  depth: number;
  activePath?: string;
  onSelectFile: (node: VaultNode) => void;
  onAddFile: (targetFolderRelPath?: string) => void;
  onRemoveItem: (relPath: string, isFolder: boolean) => void;
  onRenameItem: (relPath: string, isFolder: boolean, currentName: string) => void;
}> = React.memo(({ node, depth, activePath, onSelectFile, onAddFile, onRemoveItem, onRenameItem }) => {
  // Check if active path is inside this folder tree to auto-expand only active lineage
  const containsActive = useMemo(() => {
    if (!activePath) return false;
    return activePath.startsWith(node.relative_path + "/");
  }, [activePath, node.relative_path]);

  // Start with all subfolders closed by default unless it contains active file
  const [isOpen, setIsOpen] = useState<boolean>(containsActive);

  const isFolder = node.node_type === "Folder";

  function getThreeLetterBadge(type: VaultNodeType): string {
    if (typeof type === "object" && "File" in type) {
      const raw = type.File.toUpperCase();
      if (raw === "PPTX" || raw === "PPT") return "PPT";
      if (raw === "PDF") return "PDF";
      if (raw === "MD") return "MD";
      return raw.slice(0, 3);
    }
    return "DIR";
  }

  if (isFolder) {
    return (
      <li className="tree-item-group">
        <div
          className="tree-row folder-row"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span className="tree-chevron">{isOpen ? "▾" : "▸"}</span>
          <span className="tree-type-pill dir">DIR</span>
          <span className="tree-label folder-label">{node.name}</span>

          <div className="tree-item-actions">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRenameItem(node.relative_path, true, node.name);
              }}
              className="tree-mini-btn"
              title="Rename folder"
            >
              <PencilIcon size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddFile(node.relative_path);
              }}
              className="tree-mini-btn"
              title="Add file to folder"
            >
              <PlusIcon size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveItem(node.relative_path, true);
              }}
              className="tree-mini-btn delete"
              title="Delete folder"
            >
              <CloseIcon size={12} />
            </button>
          </div>
        </div>

        {isOpen && (
          <ul className="tree-sub-list">
            {node.children.length === 0 ? (
              <li className="tree-empty-sub">
                (Empty directory)
              </li>
            ) : (
              node.children.map((child) => (
                <FileTreeNode
                  key={child.relative_path}
                  node={child}
                  depth={depth + 1}
                  activePath={activePath}
                  onSelectFile={onSelectFile}
                  onAddFile={onAddFile}
                  onRemoveItem={onRemoveItem}
                  onRenameItem={onRenameItem}
                />
              ))
            )}
          </ul>
        )}
      </li>
    );
  }

  const badgeStr = getThreeLetterBadge(node.node_type);
  const isActive = activePath === node.relative_path;

  return (
    <li className="tree-item-single">
      <div
        className={`tree-row file-row ${isActive ? "is-active" : ""}`}
        onClick={() => onSelectFile(node)}
      >
        <span className="tree-chevron-placeholder" />
        <span className={`tree-type-pill ${badgeStr.toLowerCase()}`}>
          {badgeStr}
        </span>
        <span className="tree-label file-label">{node.name}</span>

        <div className="tree-item-actions">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRenameItem(node.relative_path, false, node.name);
            }}
            className="tree-mini-btn"
            title="Rename module"
          >
            <PencilIcon size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemoveItem(node.relative_path, false);
            }}
            className="tree-mini-btn delete"
            title="Delete file"
          >
            <CloseIcon size={12} />
          </button>
        </div>
      </div>
    </li>
  );
});
