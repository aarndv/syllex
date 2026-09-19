import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { invoke } from "@tauri-apps/api/core";
import { VaultNode } from "../types/vault";
import { FileTree } from "./FileTree";
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
  onClose: () => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  vaultRoot,
  node,
  allNodes,
  onSelectNode,
  onAddFile,
  onRemoveItem,
  onClose,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.0);
  const [viewMode, setViewMode] = useState<"original" | "fast-dark">(() => {
    const saved = localStorage.getItem("syllex_pdf_view_mode");
    return saved === "fast-dark" ? "fast-dark" : "original";
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  const storageKey = `syllex_progress_${node.relative_path}`;

  function handleToggleViewMode() {
    setViewMode((prev) => {
      const next = prev === "original" ? "fast-dark" : "original";
      localStorage.setItem("syllex_pdf_view_mode", next);
      return next;
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

  useEffect(() => {
    if (!pdfDoc || currentPage < 1 || currentPage > numPages) return;

    let isCancelled = false;

    async function renderPage() {
      try {
        const page = await pdfDoc!.getPage(currentPage);
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

    renderPage();

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, currentPage, zoom, numPages]);

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
        handleToggleViewMode();
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
          <h3>📂 Vault Explorer</h3>
          <button
            onClick={() => setIsDrawerOpen(false)}
            className="drawer-toggle-btn"
            title="Collapse sidebar"
          >
            ◀
          </button>
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
                📂 Files
              </button>
            )}
            <button onClick={onClose} className="close-btn">
              ✕ Back
            </button>
            <span className="doc-title">{node.name}</span>
          </div>

          <div className="toolbar-center">
            <button onClick={handlePrevPage} disabled={currentPage <= 1}>
              ◀ Prev
            </button>
            <span className="page-indicator">
              Page {currentPage} of {numPages || 1}
            </span>
            <button onClick={handleNextPage} disabled={currentPage >= numPages}>
              Next ▶
            </button>
          </div>

          <div className="toolbar-right">
            <button
              onClick={handleToggleViewMode}
              className={`view-mode-toggle ${viewMode}`}
              title="Toggle Document View Mode (Key: D)"
            >
              {viewMode === "original" ? "☀️ Original" : "🌙 Fast Dark"}
            </button>
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

          {!loading && !error && (
            <div className={`canvas-container ${viewMode}`}>
              <canvas ref={canvasRef} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
