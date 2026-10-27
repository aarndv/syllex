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
  isFitWidth?: boolean;
  continuous: boolean;
  viewMode: DocumentViewMode;
  onPageChange: (pageNumber: number) => void;
  onScaleChange?: (scale: number) => void;
}

interface PageChangingEvent {
  pageNumber: number;
}

interface ScaleChangingEvent {
  scale: number;
  presetValue?: string;
}

/**
 * Thin React adapter around PDF.js's maintained viewer implementation.
 * PDF.js owns its rendering queue, page-view cache, cancellation, and DOM.
 */
export function PdfJsViewer({
  pdfDoc,
  currentPage,
  zoom,
  isFitWidth = false,
  continuous,
  viewMode,
  onPageChange,
  onScaleChange,
}: PdfJsViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerElementRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<PDFViewer | null>(null);
  const currentPageRef = useRef(currentPage);
  const zoomRef = useRef(zoom);
  const isFitWidthRef = useRef(isFitWidth);
  const onPageChangeRef = useRef(onPageChange);
  const onScaleChangeRef = useRef(onScaleChange);

  currentPageRef.current = currentPage;
  zoomRef.current = zoom;
  isFitWidthRef.current = isFitWidth;
  onPageChangeRef.current = onPageChange;
  onScaleChangeRef.current = onScaleChange;

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
      if (isFitWidthRef.current) {
        viewer.currentScaleValue = "page-width";
      } else {
        viewer.currentScale = zoomRef.current;
      }
      viewer.currentPageNumber = Math.min(
        Math.max(currentPageRef.current, 1),
        pdfDoc.numPages,
      );
    };
    const handlePageChanging = ({ pageNumber }: PageChangingEvent) => {
      onPageChangeRef.current(pageNumber);
    };
    const handleScaleChanging = ({ scale }: ScaleChangingEvent) => {
      if (typeof scale === "number" && !isNaN(scale) && scale > 0) {
        onScaleChangeRef.current?.(scale);
      }
    };

    eventBus.on("pagesinit", handlePagesInit);
    eventBus.on("pagechanging", handlePageChanging);
    eventBus.on("scalechanging", handleScaleChanging);
    viewer.setDocument(pdfDoc);
    linkService.setDocument(pdfDoc);

    let resizeTimer: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (isFitWidthRef.current && viewerRef.current?.pdfDocument) {
        if (resizeTimer) cancelAnimationFrame(resizeTimer);
        resizeTimer = requestAnimationFrame(() => {
          if (viewerRef.current?.pdfDocument && isFitWidthRef.current) {
            viewerRef.current.currentScaleValue = "page-width";
          }
        });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (resizeTimer) cancelAnimationFrame(resizeTimer);
      eventBus.off("pagesinit", handlePagesInit);
      eventBus.off("pagechanging", handlePageChanging);
      eventBus.off("scalechanging", handleScaleChanging);
      viewer.cleanup();
      viewer.setDocument(null as unknown as pdfjsLib.PDFDocumentProxy);
      linkService.setDocument(null);
      viewerElement.replaceChildren();
      if (viewerRef.current === viewer) viewerRef.current = null;
    };
  }, [continuous, pdfDoc]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer?.pdfDocument) return;

    if (isFitWidth) {
      if (viewer.currentScaleValue !== "page-width") {
        viewer.currentScaleValue = "page-width";
      }
    } else {
      if (viewer.currentScaleValue === "page-width" || viewer.currentScale !== zoom) {
        viewer.currentScale = zoom;
      }
    }
  }, [zoom, isFitWidth]);

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
