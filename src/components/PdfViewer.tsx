import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { invoke } from "@tauri-apps/api/core";
import { ModuleItem } from "../types/vault";
import "./PdfViewer.css";

// Set worker source to CDN / bundled worker URL
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfViewerProps {
  vaultRoot: string;
  module: ModuleItem;
  onClose: () => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ vaultRoot, module, onClose }) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  const storageKey = `syllex_progress_${module.relative_path}`;

  useEffect(() => {
    const savedPage = localStorage.getItem(storageKey);
    if (savedPage) {
      const pageNum = parseInt(savedPage, 10);
      if (!isNaN(pageNum) && pageNum > 0) {
        setCurrentPage(pageNum);
      }
    }
  }, [module.relative_path]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    async function loadPdf() {
      try {
        const fileBytes = await invoke<number[]>("read_module_bytes", {
          vaultRoot,
          relativePath: module.relative_path,
        });

        const uint8Array = new Uint8Array(fileBytes);
        const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
        const doc = await loadingTask.promise;

        if (isMounted) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
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
  }, [vaultRoot, module.relative_path]);

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

  return (
    <div className="pdf-viewer-overlay">
      <header className="pdf-viewer-toolbar">
        <div className="toolbar-left">
          <button onClick={onClose} className="close-btn">
            ✕ Back
          </button>
          <span className="doc-title">{module.file_name}</span>
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
          <div className="canvas-container">
            <canvas ref={canvasRef} />
          </div>
        )}
      </main>
    </div>
  );
};
