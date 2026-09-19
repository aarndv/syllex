import React from "react";
import { SearchResultItem } from "./QuickSearchModal";
import { CloseIcon, FileIcon, FolderIcon, BookIcon, ShelfIcon } from "./Icons";
import "./SearchPreviewDrawer.css";

interface SearchPreviewDrawerProps {
  item: SearchResultItem | null;
  onClose: () => void;
  onOpenItem: (item: SearchResultItem) => void;
  onLocateOnBookshelf: (item: SearchResultItem) => void;
}

export const SearchPreviewDrawer: React.FC<SearchPreviewDrawerProps> = ({
  item,
  onClose,
  onOpenItem,
  onLocateOnBookshelf,
}) => {
  if (!item) return null;

  const { node, parentPath } = item;
  let fileTypeLabel = "FOLDER";
  let fileTypeBadgeClass = "badge-folder";

  if (typeof node.node_type === "object" && "File" in node.node_type) {
    fileTypeLabel = node.node_type.File.toUpperCase();
    fileTypeBadgeClass = `badge-${node.node_type.File.toLowerCase()}`;
  }

  // Format file size
  const formatSize = (bytes?: number) => {
    if (!bytes) return "Directory";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="search-preview-drawer-backdrop" onClick={onClose}>
      <aside className="search-preview-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="preview-drawer-header">
          <div className="header-type-group">
            <span className={`drawer-type-badge ${fileTypeBadgeClass}`}>{fileTypeLabel}</span>
            <span className="drawer-header-subtitle">Item Details & Preview</span>
          </div>
          <button className="drawer-close-btn" onClick={onClose} title="Close preview">
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="preview-drawer-body">
          <div className="item-hero-card">
            <div className="hero-icon-wrapper">
              {node.node_type === "Folder" ? (
                <FolderIcon size={32} />
              ) : fileTypeLabel === "MD" ? (
                <BookIcon size={32} />
              ) : (
                <FileIcon size={32} />
              )}
            </div>
            <h3 className="hero-title">{node.name}</h3>
            <p className="hero-path-text">{parentPath}</p>
          </div>

          <div className="meta-section">
            <h4 className="meta-section-title">METADATA</h4>
            <div className="meta-grid">
              <div className="meta-row">
                <span className="meta-label">Type:</span>
                <span className="meta-value">{fileTypeLabel}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Size:</span>
                <span className="meta-value">{formatSize(node.size_bytes)}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Location:</span>
                <span className="meta-value path">{parentPath}</span>
              </div>
            </div>
          </div>

          <div className="meta-section">
            <h4 className="meta-section-title">DOCUMENT PREVIEW & OUTLINE</h4>
            <div className="preview-content-box">
              {node.node_type === "Folder" ? (
                <div className="folder-children-preview">
                  <p className="preview-summary">Contains {node.children?.length || 0} sub-items:</p>
                  <ul className="preview-children-list">
                    {node.children && node.children.length > 0 ? (
                      node.children.slice(0, 6).map((child, i) => (
                        <li key={i} className="preview-child-item">
                          {child.node_type === "Folder" ? <FolderIcon size={14} /> : <FileIcon size={14} />}
                          <span>{child.name}</span>
                        </li>
                      ))
                    ) : (
                      <li className="preview-child-empty">Empty subfolder</li>
                    )}
                  </ul>
                </div>
              ) : fileTypeLabel === "PDF" ? (
                <div className="file-type-preview">
                  <p className="preview-text">PDF Document Module</p>
                  <div className="pdf-quick-stats">
                    <span>PDF Viewer Ready</span>
                    <span>Continuous Scroll & Dark Filters Supported</span>
                  </div>
                </div>
              ) : fileTypeLabel === "PPT" || fileTypeLabel === "PPTX" ? (
                <div className="file-type-preview">
                  <p className="preview-text">Presentation Slides</p>
                  <div className="ppt-quick-stats">
                    <span>Headless Presentation Preview Ready</span>
                  </div>
                </div>
              ) : (
                <div className="file-type-preview">
                  <p className="preview-text">Markdown Course Notes</p>
                  <div className="md-quick-stats">
                    <span>Structured Markdown Document</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="preview-drawer-footer">
          <button className="primary-btn drawer-action-btn" onClick={() => onOpenItem(item)}>
            <FileIcon size={16} /> Open Document
          </button>
          <button className="secondary-btn drawer-action-btn" onClick={() => onLocateOnBookshelf(item)}>
            <ShelfIcon size={16} /> Locate on Bookshelf
          </button>
        </div>
      </aside>
    </div>
  );
};
