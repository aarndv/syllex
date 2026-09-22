import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { pdfjsLib, getPdfDocumentParams } from "../utils/pdfInit";
import { invoke } from "@tauri-apps/api/core";
import { VaultNode } from "../types/vault";
import { FileTree } from "./FileTree";
import {
  FolderIcon,
  CloseIcon,
  RefreshIcon,
  ScrollIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "./Icons";
import {
  extractLoadedPdfDocText,
  searchInDocPages,
  PdfPageText,
  PdfSearchMatch,
} from "../utils/pdfSearch";
import "./PdfViewer.css";

interface PdfViewerProps {
  vaultRoot: string;
  node: VaultNode;
  allNodes: VaultNode[];
  initialPage?: number;
  initialSearchQuery?: string;
  onSelectNode: (node: VaultNode) => void;
  onAddFile: (folderRelPath?: string) => void;
  onRemoveItem: (relPath: string, isFolder: boolean) => void;
  onRefreshVault?: () => void;
  onClose: () => void;
}

export type DocumentViewMode =
  | "original"
  | "fast-dark"
  | "sepia"
  | "dark-sepia"
  | "grayscale"
  | "high-contrast-dark"
  | "ocean-dark";

const VIEW_MODE_ORDER: DocumentViewMode[] = [
  "original",
  "fast-dark",
  "sepia",
  "dark-sepia",
  "grayscale",
  "high-contrast-dark",
  "ocean-dark",
];

export const VIEW_MODE_LABELS: Record<DocumentViewMode, string> = {
  "original": "Original (Full Color)",
  "fast-dark": "Fast Dark Mode",
  "sepia": "Warm Sepia",
  "dark-sepia": "Midnight Sepia",
  "grayscale": "Monochrome Grayscale",
  "high-contrast-dark": "High Contrast Dark",
  "ocean-dark": "Ocean Dark Blue",
};

export const PdfViewer: React.FC<PdfViewerProps> = ({
  vaultRoot,
  node,
  allNodes,
  initialPage,
  initialSearchQuery,
  onSelectNode,
  onAddFile,
  onRemoveItem,
  onRefreshVault,
  onClose,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(initialPage || 1);
  const [zoom, setZoom] = useState<number>(1.0);
  const [isContinuousScroll, setIsContinuousScroll] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<DocumentViewMode>(() => {
    const saved = localStorage.getItem("syllex_pdf_view_mode") as DocumentViewMode;
    return VIEW_MODE_ORDER.includes(saved) ? saved : "original";
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>("Loading document...");
  const [error, setError] = useState<string | null>(null);
  const [filterToast, setFilterToast] = useState<string | null>(null);

  // In-PDF Text Search state
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(!!initialSearchQuery);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery || "");
  const [docPageTexts, setDocPageTexts] = useState<PdfPageText[]>([]);
  const [isExtractingText, setIsExtractingText] = useState<boolean>(false);
  const [currentMatchIdx, setCurrentMatchIdx] = useState<number>(0);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<any>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const storageKey = `syllex_progress_${node.relative_path}`;

  function triggerFilterToast(mode: DocumentViewMode) {
    const label = VIEW_MODE_LABELS[mode] || mode;
    setFilterToast(label);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setFilterToast(null);
    }, 1800);
  }

  function handleSelectViewMode(mode: DocumentViewMode) {
    setViewMode(mode);
    localStorage.setItem("syllex_pdf_view_mode", mode);
    triggerFilterToast(mode);
  }

  function cycleViewMode() {
    setViewMode((prev) => {
      const idx = VIEW_MODE_ORDER.indexOf(prev);
      const nextIdx = (idx + 1) % VIEW_MODE_ORDER.length;
      const nextMode = VIEW_MODE_ORDER[nextIdx];
      localStorage.setItem("syllex_pdf_view_mode", nextMode);
      triggerFilterToast(nextMode);
      return nextMode;
    });
  }

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    if (initialPage) {
      setCurrentPage(initialPage);
    } else {
      setCurrentPage(1);
    }

    async function loadPdf() {
      try {
        const isPpt =
          node.relative_path.toLowerCase().endsWith(".ppt") ||
          node.relative_path.toLowerCase().endsWith(".pptx");

        let fileBytes: number[];
        if (isPpt) {
          setLoadingMessage("Converting presentation slides via LibreOffice...");
          fileBytes = await invoke<number[]>("convert_ppt_to_pdf", {
            vaultRoot,
            relativePath: node.relative_path,
          });
        } else {
          setLoadingMessage("Loading PDF document...");
          fileBytes = await invoke<number[]>("read_module_bytes", {
            vaultRoot,
            relativePath: node.relative_path,
          });
        }

        const uint8Array = new Uint8Array(fileBytes);
        const loadingTask = pdfjsLib.getDocument(getPdfDocumentParams(uint8Array));
        const doc = await loadingTask.promise;

        if (isMounted) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);

          if (!initialPage) {
            const savedPage = localStorage.getItem(storageKey);
            let targetPage = 1;
            if (savedPage) {
              const parsed = parseInt(savedPage, 10);
              if (!isNaN(parsed) && parsed > 0) {
                targetPage = Math.min(parsed, doc.numPages);
              }
            }
            setCurrentPage(targetPage);
          }
          setLoading(false);

          // Asynchronously extract text for instant search
          setIsExtractingText(true);
          extractLoadedPdfDocText(doc, `${vaultRoot}:${node.relative_path}`)
            .then((extracted) => {
              if (isMounted) {
                setDocPageTexts(extracted);
                setIsExtractingText(false);
              }
            })
            .catch(() => {
              if (isMounted) setIsExtractingText(false);
            });
        }
      } catch (err: any) {
        if (isMounted) {
          setError(
            typeof err === "string"
              ? err
              : err.message || "Failed to parse or convert presentation file"
          );
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      isMounted = false;
    };
  }, [vaultRoot, node.relative_path]);

  // Compute search matches
  const searchMatches = useMemo<PdfSearchMatch[]>(() => {
    if (!searchQuery.trim() || docPageTexts.length === 0) return [];
    return searchInDocPages(docPageTexts, searchQuery);
  }, [searchQuery, docPageTexts]);

  // Jump to match when index changes
  const jumpToMatch = useCallback((idx: number) => {
    if (searchMatches.length === 0 || idx < 0 || idx >= searchMatches.length) return;
    const match = searchMatches[idx];
    setCurrentMatchIdx(idx);

    if (!isContinuousScroll) {
      setCurrentPage(match.pageNum);
    } else {
      const pageEl = document.getElementById(`pdf-page-${match.pageNum}`);
      pageEl?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [searchMatches, isContinuousScroll]);

  // Reset match index when query changes
  useEffect(() => {
    if (searchMatches.length > 0) {
      // Find closest match to current page if possible
      let bestIdx = 0;
      const pageMatchIdx = searchMatches.findIndex((m) => m.pageNum >= currentPage);
      if (pageMatchIdx !== -1) bestIdx = pageMatchIdx;
      jumpToMatch(bestIdx);
    } else {
      setCurrentMatchIdx(0);
    }
  }, [searchMatches]);

  function handleNextMatch() {
    if (searchMatches.length === 0) return;
    const nextIdx = (currentMatchIdx + 1) % searchMatches.length;
    jumpToMatch(nextIdx);
  }

  function handlePrevMatch() {
    if (searchMatches.length === 0) return;
    const prevIdx = (currentMatchIdx - 1 + searchMatches.length) % searchMatches.length;
    jumpToMatch(prevIdx);
  }

  function handleToggleSearch() {
    setIsSearchOpen((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      return next;
    });
  }

  function handlePrevPage() {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  }

  function handleNextPage() {
    if (currentPage < numPages) {
      setCurrentPage((prev) => prev + 1);
    }
  }

  function handleZoomIn() {
    setZoom((prev) => Math.min(prev + 0.2, 3.0));
  }

  function handleZoomOut() {
    setZoom((prev) => Math.max(prev - 0.2, 0.5));
  }

  // Global keyboard shortcuts within viewer
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+F / Cmd+F: open search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 50);
        return;
      }

      // If search input is focused, don't hijack arrow keys
      if (document.activeElement === searchInputRef.current) {
        if (e.key === "Escape") {
          setIsSearchOpen(false);
        }
        return;
      }

      if (e.key === "ArrowLeft") {
        handlePrevPage();
      } else if (e.key === "ArrowRight") {
        handleNextPage();
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn();
      } else if (e.key === "-" || e.key === "_") {
        handleZoomOut();
      } else if (e.key.toLowerCase() === "d") {
        cycleViewMode();
      } else if (e.key === "Escape") {
        if (isSearchOpen) {
          setIsSearchOpen(false);
        } else {
          onClose();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentPage, numPages, zoom, isSearchOpen]);

  const activeMatch = searchMatches[currentMatchIdx];

  return (
    <div className={`pdf-viewer-overlay ${isDrawerOpen ? "drawer-open" : "drawer-closed"}`}>
      <aside className="pdf-drawer">
        <div className="drawer-header">
          <h3>
            <FolderIcon size={16} /> Vault Explorer
          </h3>
          <div className="drawer-header-actions">
            {onRefreshVault && (
              <button
                onClick={onRefreshVault}
                className="drawer-toggle-btn"
                title="Refresh vault directory"
              >
                <RefreshIcon size={14} />
              </button>
            )}
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="drawer-toggle-btn"
              title="Collapse sidebar"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        </div>
        <div className="drawer-tree-container">
          <FileTree
            nodes={allNodes}
            activePath={node.relative_path}
            onSelectFile={onSelectNode}
            onAddFile={onAddFile}
            onRemoveItem={onRemoveItem}
          />
        </div>
      </aside>

      <div className="pdf-main-area">
        <header className="pdf-viewer-toolbar">
          <div className="toolbar-left">
            {!isDrawerOpen && (
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="toolbar-btn expand-btn"
                title="Expand sidebar"
              >
                <FolderIcon size={14} /> <span>Files</span>
              </button>
            )}
            <button onClick={onClose} className="toolbar-btn back-btn" title="Back to library (Esc)">
              <CloseIcon size={14} /> <span>Back</span>
            </button>
            <span className="doc-title" title={node.name}>{node.name}</span>
          </div>

          <div className="toolbar-center">
            {!isContinuousScroll ? (
              <div className="toolbar-control-group page-controls">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1}
                  className="toolbar-icon-btn"
                  title="Previous Page (Left Arrow)"
                >
                  <ChevronLeftIcon size={14} />
                </button>
                <span className="page-indicator">
                  Page <strong>{currentPage}</strong> of <strong>{numPages || 1}</strong>
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage >= numPages}
                  className="toolbar-icon-btn"
                  title="Next Page (Right Arrow)"
                >
                  <ChevronRightIcon size={14} />
                </button>
              </div>
            ) : (
              <div className="toolbar-control-group page-controls">
                <span className="page-indicator">
                  <strong>{numPages}</strong> {numPages === 1 ? "Page" : "Pages"} (Continuous)
                </span>
              </div>
            )}

            <button
              onClick={() => setIsContinuousScroll((prev) => !prev)}
              className={`toolbar-btn scroll-toggle-btn ${isContinuousScroll ? "active" : ""}`}
              title="Toggle Continuous Scroll / Single Page Mode"
            >
              <ScrollIcon size={14} /> <span>{isContinuousScroll ? "Continuous" : "Single Page"}</span>
            </button>
          </div>

          <div className="toolbar-right">
            {/* Find in Document Button */}
            <button
              onClick={handleToggleSearch}
              className={`toolbar-btn search-doc-btn ${isSearchOpen ? "active" : ""}`}
              title="Find in document (Ctrl+F)"
            >
              <SearchIcon size={14} /> <span>Find</span>
            </button>

            <div className="filter-dropdown-group" title="Select Dark Mode Reading Filter (Shortcut: Press 'D' to cycle)">
              <label htmlFor="view-mode-select" className="filter-group-label">Filter:</label>
              <div className="custom-select-wrapper">
                <select
                  id="view-mode-select"
                  value={viewMode}
                  onChange={(e) => handleSelectViewMode(e.target.value as DocumentViewMode)}
                  className={`view-mode-select mode-${viewMode}`}
                >
                  <option value="original">Original (Full Color)</option>
                  <option value="fast-dark">Fast Dark Mode</option>
                  <option value="sepia">Warm Sepia</option>
                  <option value="dark-sepia">Midnight Sepia</option>
                  <option value="grayscale">Monochrome Grayscale</option>
                  <option value="high-contrast-dark">High Contrast Dark</option>
                  <option value="ocean-dark">Ocean Dark Blue</option>
                </select>
              </div>
            </div>

            <div className="toolbar-control-group zoom-controls">
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="toolbar-icon-btn"
                title="Zoom Out (-)"
              >
                -
              </button>
              <span className="zoom-indicator">{Math.round(zoom * 100)}%</span>
              <button
                onClick={handleZoomIn}
                disabled={zoom >= 3.0}
                className="toolbar-icon-btn"
                title="Zoom In (+)"
              >
                +
              </button>
            </div>
          </div>
        </header>

        {/* Floating In-PDF Search Bar */}
        {isSearchOpen && (
          <div className="pdf-search-bar" role="search">
            <div className="search-input-field-wrapper">
              <SearchIcon size={14} className="search-field-icon" />
              <input
                ref={searchInputRef}
                type="text"
                className="pdf-search-input"
                placeholder="Find in document... (Enter / Shift+Enter)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (e.shiftKey) {
                      handlePrevMatch();
                    } else {
                      handleNextMatch();
                    }
                  }
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery("")}
                  title="Clear query"
                >
                  <CloseIcon size={12} />
                </button>
              )}
            </div>

            <div className="search-counter-badge">
              {isExtractingText ? (
                "Indexing..."
              ) : searchMatches.length > 0 ? (
                `${currentMatchIdx + 1} of ${searchMatches.length}`
              ) : searchQuery.trim() ? (
                "0 matches"
              ) : (
                "Ready"
              )}
            </div>

            <div className="search-nav-btn-group">
              <button
                type="button"
                className="search-nav-btn"
                disabled={searchMatches.length === 0}
                onClick={handlePrevMatch}
                title="Previous match (Shift+Enter)"
              >
                <ChevronUpIcon size={13} />
              </button>
              <button
                type="button"
                className="search-nav-btn"
                disabled={searchMatches.length === 0}
                onClick={handleNextMatch}
                title="Next match (Enter)"
              >
                <ChevronDownIcon size={13} />
              </button>
            </div>

            <button
              type="button"
              className="search-close-btn"
              onClick={() => setIsSearchOpen(false)}
              title="Close search (Esc)"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        )}

        <main ref={bodyRef} className="pdf-viewer-body">
          {filterToast && (
            <div className="filter-toast-tooltip" role="status" aria-live="polite">
              <span className="toast-filter-name">Reading Filter: <strong>{filterToast}</strong></span>
              <span className="toast-shortcut-badge">Press 'D' to cycle</span>
            </div>
          )}

          {/* Active Search Match Snippet Pill */}
          {isSearchOpen && activeMatch && (
            <div className="pdf-active-match-pill" role="status" aria-live="polite">
              <span className="match-pill-badge">Match on Page {activeMatch.pageNum}</span>
              <span className="match-pill-text">{activeMatch.snippet}</span>
            </div>
          )}

          {loading && <div className="pdf-loading">{loadingMessage}</div>}

          {error && (
            <div className="pdf-error">
              <p><strong>Error loading document:</strong> {error}</p>
              <p className="subtext">The PDF file may be protected or corrupted.</p>
            </div>
          )}

          {!loading && !error && pdfDoc && (
            isContinuousScroll ? (
              <div className="continuous-scroll-list">
                {Array.from({ length: numPages }).map((_, idx) => {
                  const pageNumber = idx + 1;
                  const isCurrentMatchPage = activeMatch?.pageNum === pageNumber;
                  const hasMatches = searchMatches.some((m) => m.pageNum === pageNumber);

                  return (
                    <PdfContinuousPageItem
                      key={`continuous-page-${pageNumber}`}
                      pdfDoc={pdfDoc}
                      pageNumber={pageNumber}
                      zoom={zoom}
                      viewMode={viewMode}
                      isCurrentMatchPage={isCurrentMatchPage}
                      hasMatches={hasMatches}
                      scrollContainerRef={bodyRef}
                    />
                  );
                })}
              </div>
            ) : (
              <PdfPageCanvas
                key={`single-page-${currentPage}`}
                pdfDoc={pdfDoc}
                pageNum={currentPage}
                zoom={zoom}
                viewMode={viewMode}
                className={activeMatch?.pageNum === currentPage ? "active-match-page" : ""}
                onRenderSuccess={() => {
                  localStorage.setItem(storageKey, currentPage.toString());
                }}
              />
            )
          )}
        </main>
      </div>
    </div>
  );
};

interface PdfContinuousPageItemProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
  viewMode: DocumentViewMode;
  isCurrentMatchPage: boolean;
  hasMatches: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

const PdfContinuousPageItem: React.FC<PdfContinuousPageItemProps> = React.memo(
  ({
    pdfDoc,
    pageNumber,
    zoom,
    viewMode,
    isCurrentMatchPage,
    hasMatches,
    scrollContainerRef,
  }) => {
    const itemRef = useRef<HTMLDivElement | null>(null);
    const [isVisible, setIsVisible] = useState<boolean>(false);
    const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);

    // Query unscaled page dimensions once for placeholder sizing
    useEffect(() => {
      let isMounted = true;
      pdfDoc
        .getPage(pageNumber)
        .then((page) => {
          if (isMounted) {
            const vp = page.getViewport({ scale: 1.0 });
            setPageSize({ width: vp.width, height: vp.height });
          }
        })
        .catch(() => {});
      return () => {
        isMounted = false;
      };
    }, [pdfDoc, pageNumber]);

    // Viewport intersection observer to lazy-render canvas only when near/in view
    useEffect(() => {
      const el = itemRef.current;
      if (!el) return;

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            setIsVisible(entry.isIntersecting);
          }
        },
        {
          root: scrollContainerRef.current,
          rootMargin: "800px 0px 800px 0px", // Pre-render pages within 800px of scrolling window
          threshold: 0,
        }
      );

      observer.observe(el);

      return () => {
        observer.disconnect();
      };
    }, [scrollContainerRef]);

    const estimatedWidth = pageSize ? Math.floor(pageSize.width * zoom) : Math.floor(800 * zoom);
    const estimatedHeight = pageSize ? Math.floor(pageSize.height * zoom) : Math.floor(1130 * zoom);

    return (
      <div
        id={`pdf-page-${pageNumber}`}
        ref={itemRef}
        className={`continuous-page-item ${hasMatches ? "has-matches" : ""} ${
          isCurrentMatchPage ? "active-match-page" : ""
        }`}
        style={{
          minWidth: `${estimatedWidth}px`,
          minHeight: `${estimatedHeight}px`,
        }}
      >
        {isVisible ? (
          <PdfPageCanvas
            key={`page-${pageNumber}-${zoom}`}
            pdfDoc={pdfDoc}
            pageNum={pageNumber}
            zoom={zoom}
            viewMode={viewMode}
          />
        ) : (
          <div
            className={`canvas-container mode-${viewMode} continuous-page-placeholder`}
            style={{
              width: `${estimatedWidth}px`,
              height: `${estimatedHeight}px`,
            }}
          >
            <span className="placeholder-page-label">Page {pageNumber}</span>
          </div>
        )}
      </div>
    );
  }
);

interface PdfPageCanvasProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNum: number;
  zoom: number;
  viewMode: DocumentViewMode;
  onRenderSuccess?: () => void;
  className?: string;
}

const PdfPageCanvas: React.FC<PdfPageCanvasProps> = React.memo(
  ({ pdfDoc, pageNum, zoom, viewMode, onRenderSuccess, className = "" }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

    useEffect(() => {
      let isCancelled = false;

      async function renderPage() {
        // Cancel any previous in-flight render task on this canvas and await its completion
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
            await renderTaskRef.current.promise;
          } catch {
            // RenderingCancelledException is expected
          }
          renderTaskRef.current = null;
        }

        if (isCancelled) return;

        try {
          const page = await pdfDoc.getPage(pageNum);
          if (isCancelled) return;

          const canvas = canvasRef.current;
          if (!canvas) return;

          const context = canvas.getContext("2d");
          if (!context) return;

          // Compute viewport with devicePixelRatio for sharp rendering on high-DPI screens
          const pixelRatio = window.devicePixelRatio || 1;
          const viewport = page.getViewport({ scale: zoom * pixelRatio });

          // Set canvas internal pixel resolution
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);

          // Set canvas CSS display dimensions
          canvas.style.width = `${Math.floor(viewport.width / pixelRatio)}px`;
          canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`;

          // Clean context transforms and reset canvas state
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.clearRect(0, 0, canvas.width, canvas.height);

          const renderContext = {
            canvasContext: context,
            viewport,
            canvas,
          };

          const renderTask = page.render(renderContext);
          renderTaskRef.current = renderTask;
          await renderTask.promise;

          if (!isCancelled) {
            renderTaskRef.current = null;
            onRenderSuccess?.();
          }
        } catch (err: any) {
          if (err?.name !== "RenderingCancelledException") {
            console.error(`Page ${pageNum} render error:`, err);
          }
        }
      }

      renderPage();

      return () => {
        isCancelled = true;
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }
      };
    }, [pdfDoc, pageNum, zoom]);

    return (
      <div className={`canvas-container mode-${viewMode} ${className}`.trim()}>
        <canvas ref={canvasRef} />
      </div>
    );
  }
);
