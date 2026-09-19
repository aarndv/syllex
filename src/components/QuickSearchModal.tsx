import React, { useState, useEffect, useRef, useMemo } from "react";
import { VaultNode } from "../types/vault";
import { SearchIcon, CloseIcon, FolderIcon, FileIcon, BookIcon } from "./Icons";
import "./QuickSearchModal.css";

export interface SearchResultItem {
  node: VaultNode;
  parentPath: string;
  matchType: "filename" | "folder" | "tag" | "type";
  snippet?: string;
}

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  rootNodes: VaultNode[];
  onSelectResult: (item: SearchResultItem) => void;
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({
  isOpen,
  onClose,
  rootNodes,
  onSelectResult,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on modal open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Recursively collect all indexable nodes from vault tree
  const allSearchableItems = useMemo(() => {
    const items: { node: VaultNode; parentPath: string }[] = [];

    function traverse(nodes: VaultNode[], currentPath: string) {
      for (const node of nodes) {
        items.push({
          node,
          parentPath: currentPath || "Vault Root",
        });

        if (node.node_type === "Folder" && node.children && node.children.length > 0) {
          const newPath = currentPath ? `${currentPath} > ${node.name}` : node.name;
          traverse(node.children, newPath);
        }
      }
    }

    traverse(rootNodes, "");
    return items;
  }, [rootNodes]);

  // Filter items according to search query
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Show top 8 items as quick suggestion
      return allSearchableItems.slice(0, 8).map((item) => ({
        ...item,
        matchType: "filename" as const,
        snippet: `Location: ${item.parentPath}`,
      }));
    }

    const results: SearchResultItem[] = [];

    for (const item of allSearchableItems) {
      const nameLower = item.node.name.toLowerCase();
      const parentLower = item.parentPath.toLowerCase();

      // Check file extension / node type match
      let extString = "";
      if (typeof item.node.node_type === "object" && "File" in item.node.node_type) {
        extString = item.node.node_type.File.toLowerCase();
      } else {
        extString = "folder";
      }

      if (nameLower.includes(q)) {
        results.push({
          node: item.node,
          parentPath: item.parentPath,
          matchType: "filename",
          snippet: `Matches title in ${item.parentPath}`,
        });
      } else if (parentLower.includes(q)) {
        results.push({
          node: item.node,
          parentPath: item.parentPath,
          matchType: "folder",
          snippet: `Located inside folder "${item.parentPath}"`,
        });
      } else if (extString.includes(q)) {
        results.push({
          node: item.node,
          parentPath: item.parentPath,
          matchType: "type",
          snippet: `${extString.toUpperCase()} document in ${item.parentPath}`,
        });
      }
    }

    return results.slice(0, 30);
  }, [query, allSearchableItems]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation listener (Up / Down / Enter / Esc)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (searchResults.length > 0 ? (prev + 1) % searchResults.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        searchResults.length > 0 ? (prev - 1 + searchResults.length) % searchResults.length : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (searchResults.length > 0 && searchResults[selectedIndex]) {
        onSelectResult(searchResults[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="quick-search-backdrop" onClick={onClose}>
      <div
        className="quick-search-modal-card"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="quick-search-header">
          <div className="search-input-wrapper">
            <SearchIcon className="search-input-icon" size={18} />
            <input
              ref={inputRef}
              type="text"
              className="quick-search-input"
              placeholder="Search documents, slides, notes, or folders... (Ctrl+K)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="clear-query-btn" onClick={() => setQuery("")}>
                <CloseIcon size={14} />
              </button>
            )}
          </div>
          <button className="quick-search-close-btn" onClick={onClose} title="Close (Esc)">
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="quick-search-results-list">
          {searchResults.length === 0 ? (
            <div className="search-empty-state">
              <p>No matching documents or folders found for "{query}"</p>
              <span className="search-empty-hint">Try searching by file name, folder tag, or extension (e.g. pdf, pptx, md)</span>
            </div>
          ) : (
            searchResults.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              let badgeText = "FOLDER";
              let badgeClass = "badge-folder";

              if (typeof item.node.node_type === "object" && "File" in item.node.node_type) {
                badgeText = item.node.node_type.File.toUpperCase();
                badgeClass = `badge-${item.node.node_type.File.toLowerCase()}`;
              }

              return (
                <div
                  key={`${item.node.relative_path}-${idx}`}
                  className={`search-result-item ${isSelected ? "selected" : ""}`}
                  onClick={() => onSelectResult(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="result-icon-col">
                    {item.node.node_type === "Folder" ? (
                      <FolderIcon size={18} />
                    ) : badgeText === "MD" ? (
                      <BookIcon size={18} />
                    ) : (
                      <FileIcon size={18} />
                    )}
                  </div>
                  <div className="result-info-col">
                    <div className="result-title-row">
                      <span className="result-title">{item.node.name}</span>
                      <span className={`result-type-badge ${badgeClass}`}>{badgeText}</span>
                    </div>
                    <div className="result-snippet-row">
                      <span className="result-path">{item.parentPath}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="quick-search-footer">
          <div className="footer-shortcut-item">
            <kbd>↑</kbd> <kbd>↓</kbd> to navigate
          </div>
          <div className="footer-shortcut-item">
            <kbd>↵</kbd> preview item
          </div>
          <div className="footer-shortcut-item">
            <kbd>esc</kbd> close
          </div>
        </div>
      </div>
    </div>
  );
};
