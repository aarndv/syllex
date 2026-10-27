import { useEffect, useRef, useState } from "react";
import { pdfjsLib } from "../utils/pdfInit";
import type { Highlight, HighlightFocus } from "../types/highlight";

interface SidebarProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  currentPage: number;
  highlights: Highlight[];
  width: number;
  scale: number;
  dock: "left" | "right";
  selectedHighlightId: string | null;
  onPageSelect: (pageNumber: number) => void;
  onHighlightSelect: (focus: HighlightFocus) => void;
}

function PageThumbnail({ pdfDoc, pageNumber, scale, scrollRoot }: {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || visible) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
    }, { root: scrollRoot.current, rootMargin: "240px" });
    observer.observe(host);
    return () => observer.disconnect();
  }, [scrollRoot, visible]);

  useEffect(() => {
    if (!visible || !canvasRef.current) return;
    let cancelled = false;
    let renderTask: ReturnType<pdfjsLib.PDFPageProxy["render"]> | null = null;
    async function render() {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d", { alpha: false });
        if (!canvas || !context) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 180 / base.width });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
      } catch (error) {
        if (!cancelled && !(error instanceof Error && error.name === "RenderingCancelledException")) {
          setFailed(true);
        }
      }
    }
    void render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, pageNumber, visible]);

  return (
    <div ref={hostRef} className="pdf-page-thumbnail" style={{ width: `${Math.round(140 * scale)}px` }}>
      {failed ? <span className="pdf-thumbnail-fallback">Preview unavailable</span> : <canvas ref={canvasRef} aria-hidden="true" />}
    </div>
  );
}

export function PdfPageSidebar({
  pdfDoc, currentPage, highlights, width, scale, dock, selectedHighlightId,
  onPageSelect, onHighlightSelect,
}: SidebarProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const focusSequence = useRef(0);

  useEffect(() => {
    const current = scrollRef.current?.querySelector(`[data-thumbnail-page="${currentPage}"]`);
    current?.scrollIntoView({ block: "nearest" });
  }, [currentPage]);

  return (
    <aside className={`pdf-page-sidebar dock-${dock}`} style={{ width }} aria-label="Page previews">
      <div className="pdf-page-sidebar-heading">Pages <span>{pdfDoc.numPages}</span></div>
      <div className="pdf-page-sidebar-scroll" ref={scrollRef}>
        {Array.from({ length: pdfDoc.numPages }, (_, index) => {
          const pageNumber = index + 1;
          const pageHighlights = highlights.filter((item) => item.page_number === pageNumber);
          return (
            <div className={`pdf-thumbnail-row ${currentPage === pageNumber ? "current" : ""}`} key={pageNumber} data-thumbnail-page={pageNumber}>
              <button type="button" className="pdf-thumbnail-page-button" onClick={() => onPageSelect(pageNumber)} aria-label={`Go to page ${pageNumber}`} aria-current={currentPage === pageNumber ? "page" : undefined}>
                <PageThumbnail pdfDoc={pdfDoc} pageNumber={pageNumber} scale={scale} scrollRoot={scrollRef} />
                <span>Page {pageNumber}</span>
              </button>
              <div className="pdf-thumbnail-tapes" aria-label={`Highlights on page ${pageNumber}`}>
                {pageHighlights.map((highlight, tapeIndex) => {
                  const layer = Math.floor(tapeIndex / 10);
                  return (
                    <button
                      type="button"
                      key={highlight.id}
                      className={`pdf-highlight-tape color-${highlight.color} ${selectedHighlightId === highlight.id ? "selected" : ""}`}
                      style={{ top: `${(tapeIndex % 10) * 15}px`, left: `${Math.min(layer * 4, 20)}px`, zIndex: Math.max(1, 100 - layer) }}
                      title={`Go to highlight ${tapeIndex + 1} on page ${pageNumber}`}
                      aria-label={`Go to highlight ${tapeIndex + 1} on page ${pageNumber}`}
                      onClick={() => onHighlightSelect({ id: highlight.id, pageNumber, sequence: ++focusSequence.current })}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
