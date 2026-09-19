import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { invoke } from "@tauri-apps/api/core";
import { VaultNode } from "../types/vault";
import { FileTree } from "./FileTree";
import { FolderIcon, CloseIcon, RefreshIcon, ScrollIcon } from "./Icons";
import "./PdfViewer.css";

// Set worker source to CDN / bundled worker URL
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfViewerProps {
  vaultRoot: string;
  node: VaultNode;
  allNodes: VaultNode[];
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

export const PdfViewer: React.FC<PdfViewerProps> = ({
  vaultRoot,
  node,
  allNodes,
  onSelectNode,
  onAddFile,
  onRemoveItem,
  onRefreshVault,
  onClose,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.0);
  const [isContinuousScroll, setIsContinuousScroll] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<DocumentViewMode>(() => {
    const saved = localStorage.getItem("syllex_pdf_view_mode") as DocumentViewMode;
    return VIEW_MODE_ORDER.includes(saved) ? saved : "original";
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const singleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  const storageKey = `syllex_progress_${node.relative_path}`;

  function handleSelectViewMode(mode: DocumentViewMode) {
    setViewMode(mode);
    localStorage.setItem("syllex_pdf_view_mode", mode);
  }

  function cycleViewMode() {
    setViewMode((prev) => {
      const idx = VIEW_MODE_ORDER.indexOf(prev);
      const nextIdx = (idx + 1) % VIEW_MODE_ORDER.length;
      const nextMode = VIEW_MODE_ORDER[nextIdx];
      localStorage.setItem("syllex_pdf_view_mode", nextMode);
      return nextMode;
    });
  }

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setCurrentPage(1);

    async function loadPdf() {
      try {
        const fileBytes = await invoke<number[]>("read_module_bytes", {
          vaultRoot,
          relativePath: node.relative_path,
        });

        const uint8Array = new Uint8Array(fileBytes);
        const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
        const doc = await loadingTask.promise;

        if (isMounted) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);

          const savedPage = localStorage.getItem(storageKey);
          let initialPage = 1;
          if (savedPage) {
            const parsed = parseInt(savedPage, 10);
            if (!isNaN(parsed) && parsed > 0) {
              initialPage = Math.min(parsed, doc.numPages);
            }
          }
          setCurrentPage(initialPage);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to parse or load PDF document");
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      isMounted = false;
    };
  }, [vaultRoot, node.relative_path]);

  // Single page mode canvas renderer effect
  useEffect(() => {
    if (isContinuousScroll || !pdfDoc || currentPage < 1 || currentPage > numPages) return;

    let isCancelled = false;

    async function renderSinglePage() {
      try {
        const page = await pdfDoc!.getPage(currentPage);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: zoom });
        const canvas = singleCanvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const renderContext = {
          canvasContext: context,
          viewport,
          canvas: canvas,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        localStorage.setItem(storageKey, currentPage.toString());
      } catch (err: any) {
        if (err.name !== "RenderingCancelledException") {
          console.error("Page render error:", err);
        }
      }
    }

    renderSinglePage();

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, currentPage, zoom, numPages, isContinuousScroll]);

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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
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
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentPage, numPages, zoom]);

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
                className="drawer-toggle-btn expand"
                title="Expand sidebar"
              >
                <FolderIcon size={14} /> Files
              </button>
            )}
            <button onClick={onClose} className="close-btn">
              <CloseIcon size={14} /> Back
            </button>
            <span className="doc-title">{node.name}</span>
          </div>

          <div className="toolbar-center">
            {!isContinuousScroll ? (
              <>
                <button onClick={handlePrevPage} disabled={currentPage <= 1}>
                  Prev
                </button>
                <span className="page-indicator">
                  Page {currentPage} of {numPages || 1}
                </span>
                <button onClick={handleNextPage} disabled={currentPage >= numPages}>
                  Next
                </button>
              </>
            ) : (
              <span className="page-indicator">
                {numPages} {numPages === 1 ? "Page" : "Pages"} (Continuous)
              </span>
            )}
            <button
              onClick={() => setIsContinuousScroll((prev) => !prev)}
              className={`scroll-toggle-btn ${isContinuousScroll ? "active" : ""}`}
              title="Toggle Continuous Scroll / Single Page Mode"
            >
              <ScrollIcon size={14} /> {isContinuousScroll ? "Continuous" : "Single Page"}
            </button>
          </div>

          <div className="toolbar-right">
            <select
              value={viewMode}
              onChange={(e) => handleSelectViewMode(e.target.value as DocumentViewMode)}
              className={`view-mode-select ${viewMode}`}
              title="Select Reading Filter Mode (Shortcut: Press 'D' to cycle)"
            >
              <option value="original">Original</option>
              <option value="fast-dark">Fast Dark Mode</option>
              <option value="sepia">Warm Sepia</option>
              <option value="dark-sepia">Midnight Sepia</option>
              <option value="grayscale">Monochrome Grayscale</option>
              <option value="high-contrast-dark">High Contrast Dark</option>
              <option value="ocean-dark">Ocean Dark Blue</option>
            </select>
            <button onClick={handleZoomOut} disabled={zoom <= 0.5}>
              -
            </button>
            <span className="zoom-indicator">{Math.round(zoom * 100)}%</span>
            <button onClick={handleZoomIn} disabled={zoom >= 3.0}>
              +
            </button>
          </div>
        </header>

        <main className="pdf-viewer-body">
          {loading && <div className="pdf-loading">Loading PDF document...</div>}

          {error && (
            <div className="pdf-error">
              <p><strong>Error loading document:</strong> {error}</p>
              <p className="subtext">The PDF file may be protected or corrupted.</p>
            </div>
          )}

          {!loading && !error && pdfDoc && (
            isContinuousScroll ? (
              <div className="continuous-scroll-list">
                {Array.from({ length: numPages }).map((_, idx) => (
                  <PdfPageCanvas
                    key={idx + 1}
                    pdfDoc={pdfDoc}
                    pageNum={idx + 1}
                    zoom={zoom}
                    viewMode={viewMode}
                  />
                ))}
              </div>
            ) : (
              <div className={`canvas-container mode-${viewMode}`}>
                <canvas ref={singleCanvasRef} />
              </div>
            )
          )}
        </main>
      </div>
    </div>
  );
};

const PdfPageCanvas: React.FC<{
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNum: number;
  zoom: number;
  viewMode: DocumentViewMode;
}> = React.memo(({ pdfDoc, pageNum, zoom, viewMode }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    let isCancelled = false;

    async function renderPage() {
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const renderContext = {
          canvasContext: context,
          viewport,
          canvas,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err: any) {
        if (err.name !== "RenderingCancelledException") {
          console.error(`Page ${pageNum} render error:`, err);
        }
      }
    }

    renderPage();

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, pageNum, zoom]);

  return (
    <div className={`canvas-container mode-${viewMode}`}>
      <canvas ref={canvasRef} />
    </div>
  );
});
