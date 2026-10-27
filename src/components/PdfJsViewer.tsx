import { useEffect, useRef } from "react";
import {
  EventBus,
  PDFLinkService,
  PDFSinglePageViewer,
  PDFViewer,
} from "pdfjs-dist/web/pdf_viewer.mjs";
import "pdfjs-dist/web/pdf_viewer.css";
import { pdfjsLib } from "../utils/pdfInit";
import type { Highlight, HighlightColor, HighlightFocus, HighlightRect } from "../types/highlight";
import type { DocumentViewMode } from "./PdfViewer";

interface PdfJsViewerProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  currentPage: number;
  zoom: number;
  continuous: boolean;
  viewMode: DocumentViewMode;
  onPageChange: (pageNumber: number) => void;
  highlights: Highlight[];
  highlightEnabled: boolean;
  erasingHighlights: boolean;
  highlightColor: HighlightColor;
  onCreateHighlight: (pageNumber: number, rects: HighlightRect[]) => void;
  onEraseHighlight: (id: string) => void;
  focusHighlight: HighlightFocus | null;
  sidebarVisible: boolean;
  sidebarWidth: number;
  sidebarDock: "left" | "right";
}

interface PageChangingEvent {
  pageNumber: number;
}

const TEXT_HIT_TOLERANCE_PX = 1;

function clippedRect(rect: DOMRect | HighlightRect, page: DOMRect): HighlightRect | null {
  const left = Math.max(page.left, "left" in rect ? rect.left : page.left + rect.x * page.width);
  const top = Math.max(page.top, "top" in rect ? rect.top : page.top + rect.y * page.height);
  const right = Math.min(page.right, "right" in rect ? rect.right : left + rect.width);
  const bottom = Math.min(page.bottom, "bottom" in rect ? rect.bottom : top + rect.height);
  if (right - left < 2 || bottom - top < 2) return null;
  return {
    x: (left - page.left) / page.width,
    y: (top - page.top) / page.height,
    width: (right - left) / page.width,
    height: (bottom - top) / page.height,
  };
}

function startsOnTextGlyph(target: Element, x: number, y: number): boolean {
  const textLayer = target.closest(".textLayer");
  if (!textLayer) return false;
  const caretRange = document.caretRangeFromPoint?.(x, y);
  const caretPosition = caretRange ? null : document.caretPositionFromPoint?.(x, y);
  const node = caretRange?.startContainer ?? caretPosition?.offsetNode;
  const offset = caretRange?.startOffset ?? caretPosition?.offset;
  if (!(node instanceof Text) || offset === undefined || !textLayer.contains(node)
    || node.parentElement?.closest('[role="img"]')) return false;

  const range = document.createRange();
  for (const index of [offset - 1, offset]) {
    if (index < 0 || index >= node.length || /\s/.test(node.data[index])) continue;
    range.setStart(node, index);
    range.setEnd(node, index + 1);
    for (const rect of range.getClientRects()) {
      if (x >= rect.left - TEXT_HIT_TOLERANCE_PX && x <= rect.right + TEXT_HIT_TOLERANCE_PX
        && y >= rect.top - TEXT_HIT_TOLERANCE_PX && y <= rect.bottom + TEXT_HIT_TOLERANCE_PX) {
        return true;
      }
    }
  }
  return false;
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
  highlights,
  highlightEnabled,
  erasingHighlights,
  highlightColor,
  onCreateHighlight,
  onEraseHighlight,
  focusHighlight,
  sidebarVisible,
  sidebarWidth,
  sidebarDock,
}: PdfJsViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerElementRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<PDFViewer | null>(null);
  const currentPageRef = useRef(currentPage);
  const zoomRef = useRef(zoom);
  const onPageChangeRef = useRef(onPageChange);
  const highlightsRef = useRef(highlights);
  const createHighlightRef = useRef(onCreateHighlight);
  const eraseHighlightRef = useRef(onEraseHighlight);
  const highlightEnabledRef = useRef(highlightEnabled);
  const erasingHighlightsRef = useRef(erasingHighlights);
  const highlightColorRef = useRef(highlightColor);
  const focusHighlightRef = useRef(focusHighlight);

  currentPageRef.current = currentPage;
  zoomRef.current = zoom;
  onPageChangeRef.current = onPageChange;
  highlightsRef.current = highlights;
  createHighlightRef.current = onCreateHighlight;
  eraseHighlightRef.current = onEraseHighlight;
  highlightEnabledRef.current = highlightEnabled;
  erasingHighlightsRef.current = erasingHighlights;
  highlightColorRef.current = highlightColor;
  focusHighlightRef.current = focusHighlight;

  const renderOverlays = () => {
    const element = viewerElementRef.current;
    if (!element) return;
    for (const page of element.querySelectorAll<HTMLElement>(".page[data-page-number]")) {
      let layer = page.querySelector<HTMLElement>(".syllex-highlight-layer");
      if (!layer) {
        layer = document.createElement("div");
        layer.className = "syllex-highlight-layer";
        page.appendChild(layer);
      }
      const pageNumber = Number(page.dataset.pageNumber);
      const fragments = highlightsRef.current
        .filter((item) => item.page_number === pageNumber)
        .flatMap((item) => item.rects.map((rect) => {
          const mark = document.createElement("span");
          mark.className = `syllex-highlight color-${item.color}${focusHighlightRef.current?.id === item.id ? " focused" : ""}`;
          mark.dataset.highlightId = item.id;
          mark.style.left = `${rect.x * 100}%`;
          mark.style.top = `${rect.y * 100}%`;
          mark.style.width = `${rect.width * 100}%`;
          mark.style.height = `${rect.height * 100}%`;
          return mark;
        }));
      layer.replaceChildren(...fragments);
    }
  };

  useEffect(() => {
    renderOverlays();
  }, [highlights, focusHighlight]);

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
      requestAnimationFrame(renderOverlays);
    };
    const handlePageRendered = () => renderOverlays();
    const observer = new MutationObserver((records) => {
      if (records.some((record) =>
        [...record.addedNodes].some((node) => node instanceof Element && (node.matches(".page") || !!node.querySelector(".page")))
        || [...record.removedNodes].some((node) => node instanceof Element && (node.matches(".page, .syllex-highlight-layer") || !!node.querySelector(".page")))
      )) renderOverlays();
    });
    observer.observe(viewerElement, { childList: true, subtree: true });

    eventBus.on("pagesinit", handlePagesInit);
    eventBus.on("pagechanging", handlePageChanging);
    eventBus.on("pagerendered", handlePageRendered);
    viewer.setDocument(pdfDoc);
    linkService.setDocument(pdfDoc);

    return () => {
      eventBus.off("pagesinit", handlePagesInit);
      eventBus.off("pagechanging", handlePageChanging);
      eventBus.off("pagerendered", handlePageRendered);
      observer.disconnect();
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

  useEffect(() => {
    if (!focusHighlight) return;
    const viewer = viewerRef.current;
    if (!viewer?.pdfDocument) return;
    viewer.currentPageNumber = focusHighlight.pageNumber;
    viewer.scrollPageIntoView({ pageNumber: focusHighlight.pageNumber });
    let frame = 0;
    let attempts = 0;
    const focus = () => {
      renderOverlays();
      const target = [...(viewerElementRef.current?.querySelectorAll<HTMLElement>(".syllex-highlight") || [])]
        .find((element) => element.dataset.highlightId === focusHighlight.id);
      if (target) {
        target.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      } else if (++attempts < 60) {
        frame = requestAnimationFrame(focus);
      }
    };
    frame = requestAnimationFrame(focus);
    return () => cancelAnimationFrame(frame);
  }, [focusHighlight]);

  useEffect(() => {
    const element = viewerElementRef.current;
    if (!element) return;
    let drag: { page: HTMLElement; pageNumber: number; startX: number; startY: number; pointerId: number; textStart: boolean } | null = null;
    let draft: HTMLElement | null = null;

    const onDown = (event: PointerEvent) => {
      if (!highlightEnabledRef.current || event.button !== 0 || !(event.target instanceof Element)) return;
      const page = event.target.closest<HTMLElement>(".page[data-page-number]");
      if (!page || !element.contains(page)) return;
      if (erasingHighlightsRef.current) {
        event.preventDefault();
        event.stopPropagation();
        const pageRect = page.getBoundingClientRect();
        const x = (event.clientX - pageRect.left) / pageRect.width;
        const y = (event.clientY - pageRect.top) / pageRect.height;
        const highlight = [...highlightsRef.current].reverse().find((item) =>
          item.page_number === Number(page.dataset.pageNumber) && item.rects.some((rect) =>
            x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height));
        if (highlight) eraseHighlightRef.current(highlight.id);
        return;
      }
      const selection = window.getSelection();
      selection?.removeAllRanges();
      drag = { page, pageNumber: Number(page.dataset.pageNumber), startX: event.clientX, startY: event.clientY,
        pointerId: event.pointerId, textStart: startsOnTextGlyph(event.target, event.clientX, event.clientY) };
      if (!drag.textStart) event.preventDefault();
    };
    const onMove = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId || drag.textStart) return;
      const pageRect = drag.page.getBoundingClientRect();
      const box = clippedRect(new DOMRect(Math.min(drag.startX, event.clientX), Math.min(drag.startY, event.clientY),
        Math.abs(event.clientX - drag.startX), Math.abs(event.clientY - drag.startY)), pageRect);
      if (!draft) {
        draft = document.createElement("span");
        draft.className = `syllex-highlight-draft color-${highlightColorRef.current}`;
        drag.page.querySelector(".syllex-highlight-layer")?.appendChild(draft);
      }
      if (draft && box) {
        draft.style.left = `${box.x * 100}%`;
        draft.style.top = `${box.y * 100}%`;
        draft.style.width = `${box.width * 100}%`;
        draft.style.height = `${box.height * 100}%`;
      }
    };
    const onUp = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const { page, pageNumber, startX, startY, textStart } = drag;
      drag = null;
      draft?.remove();
      draft = null;
      const pageRect = page.getBoundingClientRect();
      const selection = window.getSelection();
      let rects: HighlightRect[] = [];
      if (textStart && selection && !selection.isCollapsed && selection.rangeCount > 0 && page.contains(selection.anchorNode)) {
        rects = [...selection.getRangeAt(0).getClientRects()]
          .map((rect) => clippedRect(rect, pageRect))
          .filter((rect): rect is HighlightRect => rect !== null)
          .slice(0, 128);
      }
      if (rects.length === 0) {
        const box = clippedRect(new DOMRect(Math.min(startX, event.clientX), Math.min(startY, event.clientY),
          Math.abs(event.clientX - startX), Math.abs(event.clientY - startY)), pageRect);
        if (box) rects = [box];
      }
      selection?.removeAllRanges();
      if (rects.length) createHighlightRef.current(pageNumber, rects);
    };
    const onCancel = () => { drag = null; draft?.remove(); draft = null; };
    const onClick = (event: MouseEvent) => {
      if (highlightEnabledRef.current && event.target instanceof Element && event.target.closest(".page")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    element.addEventListener("pointerdown", onDown, true);
    element.addEventListener("click", onClick, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      element.removeEventListener("pointerdown", onDown, true);
      element.removeEventListener("click", onClick, true);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      onCancel();
    };
  }, []);

  return (
    <div className={`pdfjs-viewer-shell mode-${viewMode} ${highlightEnabled ? (erasingHighlights ? "highlight-eraser-active" : "highlight-tool-active") : ""}`}
      style={sidebarVisible ? { [sidebarDock]: `${sidebarWidth}px` } : undefined}>
      <div ref={containerRef} className="pdfjs-viewer-container">
        <div ref={viewerElementRef} className="pdfViewer" />
      </div>
    </div>
  );
}
