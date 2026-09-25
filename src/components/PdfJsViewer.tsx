import { useEffect, useRef } from "react";
import {
  EventBus,
  PDFLinkService,
  PDFSinglePageViewer,
  PDFViewer,
} from "pdfjs-dist/web/pdf_viewer.mjs";
import "pdfjs-dist/web/pdf_viewer.css";
import { pdfjsLib } from "../utils/pdfInit";
import type { DocumentViewMode } from "./PdfViewer";

interface PdfJsViewerProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  currentPage: number;
  zoom: number;
  continuous: boolean;
  viewMode: DocumentViewMode;
  onPageChange: (pageNumber: number) => void;
}

interface PageChangingEvent {
  pageNumber: number;
}

/**
 * Thin React adapter around PDF.js's maintained viewer implementation.
 * PDF.js owns its rendering queue, page-view cache, cancellation, and DOM.
 */
export function PdfJsViewer({
  pdfDoc,
  currentPage,
  zoom,
  continuous,
  viewMode,
  onPageChange,
}: PdfJsViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerElementRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<PDFViewer | null>(null);
  const currentPageRef = useRef(currentPage);
  const zoomRef = useRef(zoom);
  const onPageChangeRef = useRef(onPageChange);

  currentPageRef.current = currentPage;
  zoomRef.current = zoom;
  onPageChangeRef.current = onPageChange;

  useEffect(() => {
    const container = containerRef.current;
    const viewerElement = viewerElementRef.current;
    if (!container || !viewerElement) return;

    const eventBus = new EventBus();
    const linkService = new PDFLinkService({ eventBus });
    const Viewer = continuous ? PDFViewer : PDFSinglePageViewer;
    const viewer = new Viewer({
      container,
      viewer: viewerElement,
      eventBus,
      linkService,
      removePageBorders: true,
      maxCanvasPixels: 32 * 1024 * 1024,
      enableDetailCanvas: true,
    });

    viewerRef.current = viewer;
    linkService.setViewer(viewer);

    const handlePagesInit = () => {
      viewer.currentScale = zoomRef.current;
      viewer.currentPageNumber = Math.min(
        Math.max(currentPageRef.current, 1),
        pdfDoc.numPages,
      );
    };
    const handlePageChanging = ({ pageNumber }: PageChangingEvent) => {
      onPageChangeRef.current(pageNumber);
    };

    eventBus.on("pagesinit", handlePagesInit);
    eventBus.on("pagechanging", handlePageChanging);
    viewer.setDocument(pdfDoc);
    linkService.setDocument(pdfDoc);

    return () => {
      eventBus.off("pagesinit", handlePagesInit);
      eventBus.off("pagechanging", handlePageChanging);
      viewer.cleanup();
      viewer.setDocument(null as unknown as pdfjsLib.PDFDocumentProxy);
      linkService.setDocument(null);
      viewerElement.replaceChildren();
      if (viewerRef.current === viewer) viewerRef.current = null;
    };
  }, [continuous, pdfDoc]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewer?.pdfDocument && viewer.currentScale !== zoom) {
      viewer.currentScale = zoom;
    }
  }, [zoom]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (
      viewer?.pdfDocument &&
      currentPage >= 1 &&
      currentPage <= pdfDoc.numPages &&
      viewer.currentPageNumber !== currentPage
    ) {
      viewer.currentPageNumber = currentPage;
    }
  }, [currentPage, pdfDoc.numPages]);

  return (
    <div className={`pdfjs-viewer-shell mode-${viewMode}`}>
      <div ref={containerRef} className="pdfjs-viewer-container">
        <div ref={viewerElementRef} className="pdfViewer" />
      </div>
    </div>
  );
}
