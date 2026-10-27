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
  FitWidthIcon,
} from "./Icons";
import {
  extractLoadedPdfDocText,
  searchInDocPages,
  PdfPageText,
  PdfSearchMatch,
} from "../utils/pdfSearch";
import { PdfJsViewer } from "./PdfJsViewer";
import { PdfPageSidebar } from "./PdfPageSidebar";
import type { AppSettings } from "./SettingsModal";
import { HIGHLIGHT_COLORS } from "../types/highlight";
import type { Highlight, HighlightColor, HighlightFocus, HighlightRect } from "../types/highlight";
import { toUserFacingError } from "../utils/userFacingError";
import "./PdfViewer.css";

interface PdfViewerProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  vaultRoot: string;
  node: VaultNode;
  allNodes: VaultNode[];
  initialPage?: number;
  initialSearchQuery?: string;
  onSelectNode: (node: VaultNode) => void;
  onAddFile: (folderRelPath?: string) => void;
  onRemoveItem: (relPath: string, isFolder: boolean) => void;
  onRenameItem?: (relPath: string, isFolder: boolean, currentName: string) => void;
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

const DEFAULT_DRAWER_WIDTH = 320;
const MIN_DRAWER_WIDTH = 220;
const MAX_DRAWER_WIDTH = 750;
const DRAWER_WIDTH_STORAGE_KEY = "syllex_pdf_drawer_width";
const HIGHLIGHT_COLOR_STORAGE_KEY = "syllex_highlight_color";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5.0;
const PRESET_ZOOMS = [50, 75, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400];

export const PdfViewer: React.FC<PdfViewerProps> = ({
  settings,
  onUpdateSettings,
  vaultRoot,
  node,
  allNodes,
  initialPage,
  initialSearchQuery,
  onSelectNode,
  onAddFile,
  onRemoveItem,
  onRenameItem,
  onRefreshVault,
  onClose,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);
  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    const saved = localStorage.getItem(DRAWER_WIDTH_STORAGE_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= MIN_DRAWER_WIDTH && parsed <= MAX_DRAWER_WIDTH) {
        return parsed;
      }
    }
    return DEFAULT_DRAWER_WIDTH;
  });
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(initialPage || 1);
  const [zoom, setZoom] = useState<number>(1.0);
  const [isFitWidth, setIsFitWidth] = useState<boolean>(false);
  const [isContinuousScroll, setIsContinuousScroll] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<DocumentViewMode>(() => {
    const saved = localStorage.getItem("syllex_pdf_view_mode") as DocumentViewMode;
    return VIEW_MODE_ORDER.includes(saved) ? saved : "original";
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>("Loading document...");
  const [error, setError] = useState<string | null>(null);
  const [filterToast, setFilterToast] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [highlightEnabled, setHighlightEnabled] = useState(false);
  const [erasingHighlights, setErasingHighlights] = useState(false);
  const [highlightColor, setHighlightColor] = useState<HighlightColor>(() => {
    const saved = localStorage.getItem(HIGHLIGHT_COLOR_STORAGE_KEY);
    return HIGHLIGHT_COLORS.find((color) => color.id === saved)?.id ?? "gold";
  });
  const [highlightError, setHighlightError] = useState<string | null>(null);
  const [highlightToast, setHighlightToast] = useState<{ kind: "saved" | "erased"; highlight: Highlight } | null>(null);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);
  const [focusHighlight, setFocusHighlight] = useState<HighlightFocus | null>(null);

  // In-PDF Text Search state
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(!!initialSearchQuery);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery || "");
  const [docPageTexts, setDocPageTexts] = useState<PdfPageText[]>([]);
  const [isExtractingText, setIsExtractingText] = useState<boolean>(false);
  const [currentMatchIdx, setCurrentMatchIdx] = useState<number>(0);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const highlightToastTimerRef = useRef<number | null>(null);
  const deletingHighlightIdsRef = useRef(new Set<string>());
  const undoPendingRef = useRef(false);
  const documentKeyRef = useRef(`${vaultRoot}\0${node.relative_path}`);
  documentKeyRef.current = `${vaultRoot}\0${node.relative_path}`;
  const mainAreaRef = useRef<HTMLDivElement | null>(null);
  const wheelAccumulatorRef = useRef<number>(0);
  const wheelTimerRef = useRef<number | null>(null);
  const pageFlipCooldownRef = useRef<number>(0);
  const pageFlipAccumulatorRef = useRef<number>(0);
  const pageFlipTimerRef = useRef<number | null>(null);

  // Live refs so wheel handlers can read current state without stale closures
  const isContinuousScrollRef = useRef(isContinuousScroll);
  const currentPageRef = useRef(currentPage);
  const numPagesRef = useRef(numPages);
  isContinuousScrollRef.current = isContinuousScroll;
  currentPageRef.current = currentPage;
  numPagesRef.current = numPages;

  const storageKey = `syllex_progress_${node.relative_path}`;

  useEffect(() => {
    if (!highlightEnabled) setErasingHighlights(false);
  }, [highlightEnabled]);

  useEffect(() => {
    let active = true;
    setHighlights([]);
    setSelectedHighlightId(null);
    setFocusHighlight(null);
    setHighlightError(null);
    setHighlightToast(null);
    setHighlightEnabled(false);
    setErasingHighlights(false);
    if (highlightToastTimerRef.current) window.clearTimeout(highlightToastTimerRef.current);
    invoke<Highlight[]>("list_highlights", { vaultRoot, relativePath: node.relative_path })
      .then((items) => {
        if (active) setHighlights((current) => [
          ...items,
          ...current.filter((item) => !items.some((loaded) => loaded.id === item.id)),
        ]);
      })
      .catch((error: unknown) => { if (active) setHighlightError(toUserFacingError(error, "load highlights")); });
    return () => { active = false; };
  }, [vaultRoot, node.relative_path]);

  function showHighlightToast(kind: "saved" | "erased", highlight: Highlight) {
    if (highlightToastTimerRef.current) window.clearTimeout(highlightToastTimerRef.current);
    setHighlightToast({ kind, highlight });
    highlightToastTimerRef.current = window.setTimeout(() => setHighlightToast(null), 6000);
  }

  function clearHighlightToast() {
    if (highlightToastTimerRef.current) window.clearTimeout(highlightToastTimerRef.current);
    setHighlightToast(null);
  }

  async function handleCreateHighlight(pageNumber: number, rects: HighlightRect[]) {
    const documentKey = documentKeyRef.current;
    const highlight: Highlight = { id: crypto.randomUUID(), page_number: pageNumber, color: highlightColor, rects };
    try {
      await invoke("save_highlight", { vaultRoot, relativePath: node.relative_path, highlight });
      if (documentKeyRef.current === documentKey) {
        setHighlights((current) => [...current, highlight]);
        setHighlightError(null);
        showHighlightToast("saved", highlight);
      }
    } catch (error) {
      if (documentKeyRef.current === documentKey) setHighlightError(toUserFacingError(error, "save this highlight"));
    }
  }

  async function handleDeleteHighlight(id: string, showUndo = true) {
    if (deletingHighlightIdsRef.current.has(id)) return;
    const highlight = highlights.find((item) => item.id === id);
    if (!highlight) return;
    deletingHighlightIdsRef.current.add(id);
    const documentKey = documentKeyRef.current;
    try {
      await invoke("delete_highlight", { vaultRoot, relativePath: node.relative_path, id });
      if (documentKeyRef.current === documentKey) {
        setHighlights((current) => current.filter((item) => item.id !== id));
        setSelectedHighlightId((current) => current === id ? null : current);
        setFocusHighlight((current) => current?.id === id ? null : current);
        if (showUndo) showHighlightToast("erased", highlight);
        else clearHighlightToast();
        setHighlightError(null);
      }
    } catch (error) {
      if (documentKeyRef.current === documentKey) setHighlightError(toUserFacingError(error, "remove this highlight"));
    } finally {
      deletingHighlightIdsRef.current.delete(id);
    }
  }

  async function handleUndoHighlight() {
    if (!highlightToast || undoPendingRef.current) return;
    undoPendingRef.current = true;
    const documentKey = documentKeyRef.current;
    try {
      if (highlightToast.kind === "saved") {
        await handleDeleteHighlight(highlightToast.highlight.id, false);
        return;
      }
      await invoke("save_highlight", { vaultRoot, relativePath: node.relative_path, highlight: highlightToast.highlight });
      if (documentKeyRef.current === documentKey) {
        setHighlights((current) => [...current, highlightToast.highlight]);
        setHighlightError(null);
        clearHighlightToast();
      }
    } catch (error) {
      if (documentKeyRef.current === documentKey) setHighlightError(toUserFacingError(error, "restore this highlight"));
    } finally {
      undoPendingRef.current = false;
    }
  }

  function handleChooseHighlightColor(color: HighlightColor) {
    setHighlightColor(color);
    setErasingHighlights(false);
    localStorage.setItem(HIGHLIGHT_COLOR_STORAGE_KEY, color);
  }

  function triggerFilterToast(mode: DocumentViewMode) {
    const label = VIEW_MODE_LABELS[mode] || mode;
    setFilterToast(label);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
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
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (highlightToastTimerRef.current) {
        window.clearTimeout(highlightToastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;

    setLoading(true);
    setError(null);
    setPdfDoc(null);
    setNumPages(0);
    setDocPageTexts([]);
    setIsExtractingText(false);
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
        loadingTask = pdfjsLib.getDocument(getPdfDocumentParams(uint8Array));
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
      } catch (err: unknown) {
        if (isMounted) {
          setError(toUserFacingError(err, "open this document"));
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      isMounted = false;

      if (loadingTask) {
        void loadingTask.destroy();
      }
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

    setCurrentPage(match.pageNum);
  }, [searchMatches]);

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
    if (!isSearchOpen) setHighlightEnabled(false);
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

  const handleZoomIn = useCallback(() => {
    setIsFitWidth(false);
    setZoom((prev) => {
      const next = Math.floor(prev * 10 + 1.0001) / 10;
      return Math.min(MAX_ZOOM, Math.max(prev + 0.05, next));
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setIsFitWidth(false);
    setZoom((prev) => {
      const prevStep = Math.ceil(prev * 10 - 1.0001) / 10;
      return Math.max(MIN_ZOOM, Math.min(prev - 0.05, prevStep));
    });
  }, []);

  const handleWheelZoomIn = useCallback(() => {
    setIsFitWidth(false);
    setZoom((prev) => {
      const next = Math.floor(prev * 20 + 1.0001) / 20;
      return Math.min(MAX_ZOOM, Math.max(prev + 0.01, next));
    });
  }, []);

  const handleWheelZoomOut = useCallback(() => {
    setIsFitWidth(false);
    setZoom((prev) => {
      const prevStep = Math.ceil(prev * 20 - 1.0001) / 20;
      return Math.max(MIN_ZOOM, Math.min(prev - 0.01, prevStep));
    });
  }, []);

  const handleToggleFitWidth = useCallback(() => {
    setIsFitWidth((prev) => {
      if (prev) {
        setZoom(1.0);
        return false;
      }
      return true;
    });
  }, []);

  const handleSelectZoom = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "fit-width") {
      setIsFitWidth(true);
    } else {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed)) {
        setIsFitWidth(false);
        setZoom(parsed / 100);
      }
    }
  }, []);

  // Prevent browser window zoom on Ctrl+Wheel in the desktop application
  useEffect(() => {
    const handlePreventWebviewZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    window.addEventListener("wheel", handlePreventWebviewZoom, { passive: false });
    return () => {
      window.removeEventListener("wheel", handlePreventWebviewZoom);
    };
  }, []);

  // Handle Ctrl+Scroll (zoom) and plain Scroll (page-flip in single-page mode)
  useEffect(() => {
    const mainArea = mainAreaRef.current;
    if (!mainArea) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // ── Ctrl + wheel → zoom ───────────────────────────────────────────
        e.preventDefault();
        e.stopPropagation();

        let delta = e.deltaY;
        if (e.deltaMode === 1) delta *= 33;
        else if (e.deltaMode === 2) delta *= 100;

        wheelAccumulatorRef.current += delta;

        if (wheelTimerRef.current) window.clearTimeout(wheelTimerRef.current);
        wheelTimerRef.current = window.setTimeout(() => {
          wheelAccumulatorRef.current = 0;
        }, 200);

        const ZOOM_THRESHOLD = 35;
        if (Math.abs(wheelAccumulatorRef.current) >= ZOOM_THRESHOLD) {
          const isZoomIn = wheelAccumulatorRef.current < 0;
          wheelAccumulatorRef.current = 0;
          if (isZoomIn) {
            handleWheelZoomIn();
          } else {
            handleWheelZoomOut();
          }
        }
      } else if (!isContinuousScrollRef.current) {
        // ── Plain wheel in single-page mode → page flip ───────────────────
        // Accumulate scroll distance; flip the page once enough has built up.
        // A short cooldown (300 ms) prevents runaway multi-page jumps on
        // fast trackpads. The PDF.js container itself has no scrollable
        // content in single-page mode so we don't need to preventDefault.
        let delta = e.deltaY;
        if (e.deltaMode === 1) delta *= 33;
        else if (e.deltaMode === 2) delta *= 500;

        pageFlipAccumulatorRef.current += delta;

        // Reset accumulator if the user pauses scrolling
        if (pageFlipTimerRef.current) window.clearTimeout(pageFlipTimerRef.current);
        pageFlipTimerRef.current = window.setTimeout(() => {
          pageFlipAccumulatorRef.current = 0;
        }, 400);

        const PAGE_FLIP_THRESHOLD = 80; // px of scroll to trigger a page turn
        const now = Date.now();
        const COOLDOWN_MS = 350; // minimum ms between consecutive page flips

        if (Math.abs(pageFlipAccumulatorRef.current) >= PAGE_FLIP_THRESHOLD) {
          const goForward = pageFlipAccumulatorRef.current > 0;
          pageFlipAccumulatorRef.current = 0;

          if (now - pageFlipCooldownRef.current >= COOLDOWN_MS) {
            pageFlipCooldownRef.current = now;
            if (goForward && currentPageRef.current < numPagesRef.current) {
              setCurrentPage((p) => p + 1);
            } else if (!goForward && currentPageRef.current > 1) {
              setCurrentPage((p) => p - 1);
            }
          }
        }
      }
    };

    mainArea.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      mainArea.removeEventListener("wheel", handleWheel);
      if (wheelTimerRef.current) window.clearTimeout(wheelTimerRef.current);
      if (pageFlipTimerRef.current) window.clearTimeout(pageFlipTimerRef.current);
    };
  }, [handleWheelZoomIn, handleWheelZoomOut]);

  // Global keyboard shortcuts within viewer
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      // Handle Ctrl + (+/=), Ctrl + (-/_), Ctrl + 0 (Fit Width)
      if (isCtrlOrMeta) {
        if (e.key === "+" || e.key === "=" || e.code === "Equal" || e.code === "NumpadAdd") {
          e.preventDefault();
          handleZoomIn();
          return;
        }
        if (e.key === "-" || e.key === "_" || e.code === "Minus" || e.code === "NumpadSubtract") {
          e.preventDefault();
          handleZoomOut();
          return;
        }
        if (e.key === "0" || e.code === "Digit0" || e.code === "Numpad0") {
          e.preventDefault();
          handleToggleFitWidth();
          return;
        }
      }

      // Ctrl+F / Cmd+F: open search
      if (isCtrlOrMeta && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setHighlightEnabled(false);
        setIsSearchOpen(true);
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 50);
        return;
      }

      // If search input is focused, don't hijack arrow keys or single-key navigation
      if (document.activeElement === searchInputRef.current) {
        if (e.key === "Escape") {
          setIsSearchOpen(false);
        }
        return;
      }

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement || (e.target instanceof HTMLElement && e.target.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "ArrowLeft") {
        handlePrevPage();
      } else if (e.key === "ArrowRight") {
        handleNextPage();
      } else if (e.key === "+" || e.key === "=" || e.code === "NumpadAdd") {
        handleZoomIn();
      } else if (e.key === "-" || e.key === "_" || e.code === "NumpadSubtract") {
        handleZoomOut();
      } else if (e.key.toLowerCase() === "d") {
        cycleViewMode();
      } else if (e.key.toLowerCase() === "t") {
        onUpdateSettings({ ...settings, pageSidebarVisible: !settings.pageSidebarVisible });
      } else if (e.key.toLowerCase() === "h" && pdfDoc && !error) {
        setIsSearchOpen(false);
        setHighlightEnabled((current) => !current);
      } else if (e.key === "Escape") {
        if (isSearchOpen) {
          setIsSearchOpen(false);
        } else if (highlightEnabled) {
          setHighlightEnabled(false);
        } else {
          onClose();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentPage, numPages, zoom, isSearchOpen, highlightEnabled, pdfDoc, error, settings, onUpdateSettings, handleZoomIn, handleZoomOut, handleToggleFitWidth, onClose]);

  const handleMouseDownResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = drawerWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const calculatedWidth = Math.max(
        MIN_DRAWER_WIDTH,
        Math.min(startWidth + deltaX, Math.min(MAX_DRAWER_WIDTH, window.innerWidth - 300))
      );
      setDrawerWidth(calculatedWidth);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      setIsResizing(false);
      const deltaX = upEvent.clientX - startX;
      const finalWidth = Math.max(
        MIN_DRAWER_WIDTH,
        Math.min(startWidth + deltaX, Math.min(MAX_DRAWER_WIDTH, window.innerWidth - 300))
      );
      localStorage.setItem(DRAWER_WIDTH_STORAGE_KEY, String(finalWidth));
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [drawerWidth]);

  const activeMatch = searchMatches[currentMatchIdx];

  return (
    <div className={`pdf-viewer-overlay ${isDrawerOpen ? "drawer-open" : "drawer-closed"}`}>
      <aside
        className={`pdf-drawer ${isResizing ? "is-resizing" : ""}`}
        style={{
          width: `${drawerWidth}px`,
          marginLeft: isDrawerOpen ? "0px" : `-${drawerWidth}px`,
          transition: isResizing ? "none" : undefined,
        }}
      >
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
            compact
            onSelectFile={onSelectNode}
            onAddFile={onAddFile}
            onRemoveItem={onRemoveItem}
            onRenameItem={onRenameItem || (() => {})}
          />
        </div>
        {isDrawerOpen && (
          <div
            className="pdf-drawer-resizer"
            onMouseDown={handleMouseDownResize}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            title="Drag to resize sidebar"
          />
        )}
      </aside>

      <div className="pdf-main-area" ref={mainAreaRef}>
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
            <button type="button" className={`toolbar-btn ${settings.pageSidebarVisible ? "active" : ""}`}
              title="Toggle page previews (T)" aria-pressed={settings.pageSidebarVisible}
              onClick={() => onUpdateSettings({ ...settings, pageSidebarVisible: !settings.pageSidebarVisible })}>Pages</button>
            <button type="button" className={`toolbar-btn highlighter-toggle ${highlightEnabled ? "active" : ""}`}
              title="Toggle highlight tool (H)" aria-label={erasingHighlights ? "Highlight eraser (H)" : `Highlight with ${highlightColor} (H)`}
              aria-keyshortcuts="H" aria-pressed={highlightEnabled} disabled={loading || !!error || !pdfDoc}
              onClick={() => { setIsSearchOpen(false); setHighlightEnabled((current) => !current); }}>
              {!erasingHighlights && <span className="highlighter-color-chip" aria-hidden="true"
                style={{ backgroundColor: HIGHLIGHT_COLORS.find((color) => color.id === highlightColor)?.swatch }} />}
              <span>{erasingHighlights ? "Eraser" : "Highlight"}</span>
            </button>
            {selectedHighlightId && <button type="button" className="toolbar-btn" onClick={() => { void handleDeleteHighlight(selectedHighlightId); }}>Remove highlight</button>}
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

            {/* Fit to Width Button */}
            <button
              onClick={handleToggleFitWidth}
              className={`toolbar-btn fit-width-btn ${isFitWidth ? "active" : ""}`}
              title="Fit to width (Ctrl+0)"
            >
              <FitWidthIcon size={14} /> <span>Fit Width</span>
            </button>

            <div className="toolbar-control-group zoom-controls">
              <button
                onClick={handleZoomOut}
                disabled={zoom <= MIN_ZOOM}
                className="toolbar-icon-btn"
                title="Zoom Out (Ctrl - or -)"
                aria-label="Zoom Out"
              >
                -
              </button>
              <div className="custom-select-wrapper zoom-select-wrapper">
                <select
                  value={isFitWidth ? "fit-width" : String(Math.round(zoom * 100))}
                  onChange={handleSelectZoom}
                  className="zoom-select"
                  aria-label="Zoom level"
                  title="Zoom percentage (Presets)"
                >
                  {isFitWidth ? (
                    <option value="fit-width">Fit Width ({Math.round(zoom * 100)}%)</option>
                  ) : (
                    <option value="fit-width">Fit Width</option>
                  )}
                  {!isFitWidth && !PRESET_ZOOMS.includes(Math.round(zoom * 100)) && (
                    <option value={String(Math.round(zoom * 100))}>{Math.round(zoom * 100)}%</option>
                  )}
                  <option value="50">50%</option>
                  <option value="75">75%</option>
                  <option value="90">90%</option>
                  <option value="100">100%</option>
                  <option value="110">110%</option>
                  <option value="125">125%</option>
                  <option value="150">150%</option>
                  <option value="175">175%</option>
                  <option value="200">200%</option>
                  <option value="250">250%</option>
                  <option value="300">300%</option>
                  <option value="400">400%</option>
                </select>
              </div>
              <button
                onClick={handleZoomIn}
                disabled={zoom >= MAX_ZOOM}
                className="toolbar-icon-btn"
                title="Zoom In (Ctrl + or +)"
                aria-label="Zoom In"
              >
                +
              </button>
            </div>
          </div>
        </header>

        {highlightEnabled && !loading && !error && pdfDoc && (
          <div className="pdf-highlight-palette" role="group" aria-label="Highlighter controls">
            <span className="pdf-highlight-palette-title">Highlight tool</span>
            <div className="pdf-highlight-swatches" role="group" aria-label="Choose highlight color or eraser">
              {HIGHLIGHT_COLORS.map((color) => (
                <button key={color.id} type="button" className="pdf-highlight-swatch"
                  style={{ backgroundColor: color.swatch }} title={color.label}
                  aria-label={`${color.label} highlight`} aria-pressed={!erasingHighlights && highlightColor === color.id}
                  onClick={() => handleChooseHighlightColor(color.id)} />
              ))}
              <button type="button" className="pdf-highlight-eraser" title="Erase a highlight"
                aria-label="Erase highlights" aria-pressed={erasingHighlights}
                onClick={() => setErasingHighlights(true)}>Erase</button>
            </div>
            <span className="pdf-highlight-palette-hint">{erasingHighlights ? "Click a highlight to erase it" : "Drag over text or any page area"} · Esc to finish</span>
            <button type="button" className="pdf-highlight-done" onClick={() => setHighlightEnabled(false)}>Done</button>
          </div>
        )}

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

        <main
          className={`pdf-viewer-body ${!loading && !error && pdfDoc ? "has-document" : ""}`}
        >
          {filterToast && (
            <div className="filter-toast-tooltip" role="status" aria-live="polite">
              <span className="toast-filter-name">Reading Filter: <strong>{filterToast}</strong></span>
              <span className="toast-shortcut-badge">Press 'D' to cycle</span>
            </div>
          )}
          {highlightError && <div className="pdf-highlight-error" role="alert">{highlightError}</div>}
          {highlightToast && (
            <div className="pdf-highlight-toast" role="status" aria-live="polite">
              <span>Highlight {highlightToast.kind === "saved" ? "saved" : "erased"}</span>
              <button type="button" onClick={() => { void handleUndoHighlight(); }}>Undo</button>
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
            <>
            {settings.pageSidebarVisible && (
              <PdfPageSidebar pdfDoc={pdfDoc} currentPage={currentPage} highlights={highlights}
                width={settings.pageSidebarWidth} scale={settings.thumbnailScale} dock={settings.pageSidebarDock} viewMode={viewMode}
                selectedHighlightId={selectedHighlightId} onPageSelect={setCurrentPage}
                onHighlightSelect={(focus) => { setSelectedHighlightId(focus.id); setFocusHighlight(focus); }} />
            )}
            <PdfJsViewer
              pdfDoc={pdfDoc}
              currentPage={currentPage}
              zoom={zoom}
              isFitWidth={isFitWidth}
              continuous={isContinuousScroll}
              viewMode={viewMode}
              highlights={highlights}
              highlightEnabled={highlightEnabled}
              erasingHighlights={erasingHighlights}
              highlightColor={highlightColor}
              onCreateHighlight={(pageNumber, rects) => { void handleCreateHighlight(pageNumber, rects); }}
              onEraseHighlight={(id) => { void handleDeleteHighlight(id); }}
              focusHighlight={focusHighlight}
              sidebarVisible={settings.pageSidebarVisible}
              sidebarWidth={settings.pageSidebarWidth}
              sidebarDock={settings.pageSidebarDock}
              onPageChange={(pageNumber) => {
                setCurrentPage(pageNumber);
                localStorage.setItem(storageKey, pageNumber.toString());
              }}
              onScaleChange={(scale) => setZoom(scale)}
            />
            </>
          )}
        </main>
      </div>
    </div>
  );
};
