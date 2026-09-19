import React, { useState } from "react";
import { VaultNode, VaultNodeType } from "../types/vault";

interface FileTreeProps {
  nodes: VaultNode[];
  activePath?: string;
  onSelectFile: (node: VaultNode) => void;
  onAddFile: (targetFolderRelPath?: string) => void;
  onRemoveItem: (relPath: string, isFolder: boolean) => void;
}

export const FileTree: React.FC<FileTreeProps> = ({
  nodes,
  activePath,
  onSelectFile,
  onAddFile,
  onRemoveItem,
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
            />
          ))}
        </ul>
      )}
    </div>
  );
};

const FileTreeNode: React.FC<{
  node: VaultNode;
  depth: number;
  activePath?: string;
  onSelectFile: (node: VaultNode) => void;
  onAddFile: (targetFolderRelPath?: string) => void;
  onRemoveItem: (relPath: string, isFolder: boolean) => void;
}> = ({ node, depth, activePath, onSelectFile, onAddFile, onRemoveItem }) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const isFolder = node.node_type === "Folder";

  function getFileTypeLabel(type: VaultNodeType): string {
    if (typeof type === "object" && "File" in type) {
      return type.File;
    }
    return "Folder";
  }

  if (isFolder) {
    return (
      <li className="tree-item-group">
        <div
          className="tree-row folder-row"
          style={{ paddingLeft: `${depth * 1.2 + 0.5}rem` }}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span className="tree-chevron">{isOpen ? "▾" : "▸"}</span>
          <span className="tree-folder-icon">📁</span>
          <span className="tree-label folder-label">{node.name}</span>

          <div className="tree-item-actions">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddFile(node.relative_path);
              }}
              className="tree-mini-btn"
              title="Add file to folder"
            >
              +
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveItem(node.relative_path, true);
              }}
              className="tree-mini-btn delete"
              title="Delete folder"
            >
              ✕
            </button>
          </div>
        </div>

        {isOpen && (
          <ul className="tree-sub-list">
            {node.children.length === 0 ? (
              <li
                className="tree-empty-sub"
                style={{ paddingLeft: `${(depth + 1) * 1.2 + 1.2}rem` }}
              >
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
                />
              ))
            )}
          </ul>
        )}
      </li>
    );
  }

  const fileTypeStr = getFileTypeLabel(node.node_type);
  const isActive = activePath === node.relative_path;

  return (
    <li className="tree-item-single">
      <div
        className={`tree-row file-row ${isActive ? "is-active" : ""}`}
        style={{ paddingLeft: `${depth * 1.2 + 1.4}rem` }}
        onClick={() => onSelectFile(node)}
      >
        <span className={`tree-type-pill ${fileTypeStr.toLowerCase()}`}>
          {fileTypeStr}
        </span>
        <span className="tree-label file-label">{node.name}</span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemoveItem(node.relative_path, false);
          }}
          className="tree-mini-btn delete"
          title="Delete file"
        >
          ✕
        </button>
      </div>
    </li>
  );
};
