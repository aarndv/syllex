import React, { useState, useEffect, useRef, useMemo } from "react";
import { VaultNode } from "../types/vault";
import { SearchIcon, CloseIcon, FolderIcon, FileIcon, BookIcon } from "./Icons";
import { searchVaultPdfs } from "../utils/pdfSearch";
import "./QuickSearchModal.css";

export interface SearchResultItem {
  node: VaultNode;
  parentPath: string;
  matchType: "filename" | "folder" | "tag" | "type" | "content";
  snippet?: string;
  targetPage?: number;
  searchQuery?: string;
}

export type SearchScope = "all" | "titles" | "pdf-content";

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  rootNodes: VaultNode[];
  vaultRoot: string;
  onSelectResult: (item: SearchResultItem) => void;
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({
  isOpen,
  onClose,
  rootNodes,
  vaultRoot,
  onSelectResult,
}) => {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pdfContentResults, setPdfContentResults] = useState<SearchResultItem[]>([]);
  const [isSearchingPdfs, setIsSearchingPdfs] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<any>(null);

  // Focus input on modal open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setPdfContentResults([]);
      setIsSearchingPdfs(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Recursively collect all searchable nodes and PDF nodes from vault tree
  const { allSearchableItems, allPdfNodes } = useMemo(() => {
    const items: { node: VaultNode; parentPath: string }[] = [];
    const pdfs: { node: VaultNode; parentPath: string }[] = [];

    function traverse(nodes: VaultNode[], currentPath: string) {
      for (const node of nodes) {
        const item = {
          node,
          parentPath: currentPath || "Vault Root",
        };
        items.push(item);

        const isPdf =
          typeof node.node_type === "object" &&
          "File" in node.node_type &&
          (node.node_type.File === "Pdf" ||
            node.node_type.File === "Ppt" ||
            node.node_type.File === "Pptx");
        if (isPdf) {
          pdfs.push(item);
        }

        if (node.node_type === "Folder" && node.children && node.children.length > 0) {
          const newPath = currentPath ? `${currentPath} > ${node.name}` : node.name;
          traverse(node.children, newPath);
        }
      }
    }

    traverse(rootNodes, "");
    return { allSearchableItems: items, allPdfNodes: pdfs };
  }, [rootNodes]);

  // Synchronous title and folder results
  const titleResults = useMemo<SearchResultItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Show default suggestions when empty
      return allSearchableItems.slice(0, 8).map((item) => ({
        ...item,
        matchType: "filename" as const,
        snippet: `Location: ${item.parentPath}`,
      }));
    }

    if (scope === "pdf-content") return [];

    const results: SearchResultItem[] = [];
    for (const item of allSearchableItems) {
      const nameLower = item.node.name.toLowerCase();
      const parentLower = item.parentPath.toLowerCase();

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

    return results.slice(0, 20);
  }, [query, allSearchableItems, scope]);

  // Asynchronous Deep PDF content search
  useEffect(() => {
    const q = query.trim();
    if (!vaultRoot || !q || q.length < 2 || scope === "titles") {
      setPdfContentResults([]);
      setIsSearchingPdfs(false);
      return;
    }

    setIsSearchingPdfs(true);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    let isCancelled = false;
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const rawMatches = await searchVaultPdfs(vaultRoot, allPdfNodes, q, 25);
        if (!isCancelled) {
          const formatted: SearchResultItem[] = rawMatches.map((m) => ({
            node: m.node,
            parentPath: m.parentPath,
            matchType: "content",
            snippet: m.snippet,
            targetPage: m.pageNum,
            searchQuery: q,
          }));
          setPdfContentResults(formatted);
          setIsSearchingPdfs(false);
        }
      } catch {
        if (!isCancelled) setIsSearchingPdfs(false);
      }
    }, 220);

    return () => {
      isCancelled = true;
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [query, vaultRoot, allPdfNodes, scope]);

  // Combined Search Results
  const combinedResults = useMemo(() => {
    if (scope === "titles") return titleResults;
    if (scope === "pdf-content") return pdfContentResults;
    return [...titleResults, ...pdfContentResults];
  }, [titleResults, pdfContentResults, scope]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, scope, combinedResults.length]);

  // Keyboard navigation listener (Up / Down / Enter / Esc)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        combinedResults.length > 0 ? (prev + 1) % combinedResults.length : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        combinedResults.length > 0 ? (prev - 1 + combinedResults.length) % combinedResults.length : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (combinedResults.length > 0 && combinedResults[selectedIndex]) {
        onSelectResult(combinedResults[selectedIndex]);
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
              placeholder="Search file names, folders, or text inside multiple PDFs... (Ctrl+K)"
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

        {/* Scope Filter Tabs */}
        <div className="search-scope-tabs">
          <button
            type="button"
            className={`scope-tab-btn ${scope === "all" ? "active" : ""}`}
            onClick={() => setScope("all")}
          >
            All Results
          </button>
          <button
            type="button"
            className={`scope-tab-btn ${scope === "titles" ? "active" : ""}`}
            onClick={() => setScope("titles")}
          >
            File & Folder Titles
          </button>
          <button
            type="button"
            className={`scope-tab-btn ${scope === "pdf-content" ? "active" : ""}`}
            onClick={() => setScope("pdf-content")}
          >
            PDF Full-Text Search
          </button>

          {isSearchingPdfs && (
            <div className="pdf-scanning-indicator">
              <span className="scanning-dot" />
              <span>Scanning vault PDFs...</span>
            </div>
          )}
        </div>

        {/* Results List */}
        <div className="quick-search-results-list">
          {combinedResults.length === 0 ? (
            <div className="search-empty-state">
              {isSearchingPdfs ? (
                <p>Searching text inside multiple PDFs in your vault...</p>
              ) : (
                <>
                  <p>No matching results found for "{query}"</p>
                  <span className="search-empty-hint">
                    Try another keyword, title, or switch to PDF Full-Text Search.
                  </span>
                </>
              )}
            </div>
          ) : (
            combinedResults.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const isContentMatch = item.matchType === "content";

              let badgeText = "FOLDER";
              let badgeClass = "badge-folder";

              if (isContentMatch) {
                badgeText = `PAGE ${item.targetPage}`;
                badgeClass = "badge-content-match";
              } else if (
                typeof item.node.node_type === "object" &&
                "File" in item.node.node_type
              ) {
                badgeText = item.node.node_type.File.toUpperCase();
                badgeClass = `badge-${item.node.node_type.File.toLowerCase()}`;
              }

              return (
                <div
                  key={`${item.node.relative_path}-${item.matchType}-${item.targetPage || 0}-${idx}`}
                  className={`search-result-item ${isSelected ? "selected" : ""} ${
                    isContentMatch ? "content-result" : ""
                  }`}
                  onClick={() => onSelectResult(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="result-icon-col">
                    {item.node.node_type === "Folder" ? (
                      <FolderIcon size={18} />
                    ) : badgeText === "MD" ? (
                      <BookIcon size={18} />
                    ) : isContentMatch ? (
                      <SearchIcon size={18} />
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
                      {isContentMatch ? (
                        <span className="result-content-snippet" title={item.snippet}>
                          {item.snippet}
                        </span>
                      ) : (
                        <span className="result-path">{item.parentPath}</span>
                      )}
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
            <kbd>↵</kbd> open document
          </div>
          <div className="footer-shortcut-item">
            <kbd>esc</kbd> close
          </div>
        </div>
      </div>
    </div>
  );
};
