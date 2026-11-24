import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { pdfjsLib, getPdfDocumentParams } from "../utils/pdfInit";
import { PdfJsViewer } from "./PdfJsViewer";
import { ReadingRulerSettings } from "./ReadingRulerControls";
import { VIEW_MODE_LABELS, VIEW_MODE_SHORT_LABELS, type DocumentViewMode } from "./PdfViewer";
import { HIGHLIGHT_COLORS, type Highlight, type HighlightRect } from "../types/highlight";
import type { VaultNode } from "../types/vault";
import type { WorkspacePaneState, WorkspaceState } from "../types/workspace";
import { minimumLayoutSize, movePane, paneIds, paneRects, removePane, resizeSplit, splitDividers, type WorkspaceSide } from "../utils/workspaceLayout";
import { toUserFacingError } from "../utils/userFacingError";
import { ArrangeDrawerIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, CloseIcon, ContinuousModeIcon, DuplicateIcon, ExpandIcon, FileIcon, FolderIcon, GripIcon, HighlighterIcon, PageModeIcon, PlusIcon, SettingsIcon } from "./Icons";
import "./PdfViewer.css";
import "./MultiDocumentWorkspace.css";

const SIDES: { value: WorkspaceSide; label: string }[] = [
  { value: "right", label: "Right" },
  { value: "bottom", label: "Below" },
  { value: "left", label: "Left" },
  { value: "top", label: "Above" },
];
const FILTER_ORDER = Object.keys(VIEW_MODE_LABELS) as DocumentViewMode[];
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;

function pickerTree(nodes: VaultNode[], query: string): VaultNode[] {
  const search = query.trim().toLocaleLowerCase();
  function visit(node: VaultNode, parentMatches: boolean): VaultNode | null {
    const matches = parentMatches || `${node.name} ${node.relative_path}`.toLocaleLowerCase().includes(search);
    if (node.node_type !== "Folder") return node.node_type.File !== "Md" && matches ? node : null;
    const children = node.children.map((child) => visit(child, matches)).filter((child): child is VaultNode => child !== null);
    return children.length ? { ...node, children } : null;
  }
  return nodes.map((node) => visit(node, false)).filter((node): node is VaultNode => node !== null);
}

interface MultiDocumentWorkspaceProps {
  vaultRoot: string;
  allNodes: VaultNode[];
  state: WorkspaceState;
  onChange: (update: (previous: WorkspaceState) => WorkspaceState) => void;
  compactMode: boolean;
  onToggleCompactMode: () => void;
  onAddNode: (node: VaultNode, targetId?: string | null, side?: WorkspaceSide, page?: number) => void;
  onOpenSingle: (node: VaultNode, page: number) => void;
  onClose: () => void;
}

export function MultiDocumentWorkspace({
  vaultRoot, allNodes, state, onChange, compactMode, onToggleCompactMode, onAddNode, onOpenSingle, onClose,
}: MultiDocumentWorkspaceProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [addSide, setAddSide] = useState<WorkspaceSide>("right");
  const [moveTarget, setMoveTarget] = useState("");
  const [moveSide, setMoveSide] = useState<WorkspaceSide>("right");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set());
  const [highlightRevisions, setHighlightRevisions] = useState<Record<string, number>>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const onCloseRef = useRef(onClose);
  const pickerOpenRef = useRef(pickerOpen);
  onCloseRef.current = onClose;
  pickerOpenRef.current = pickerOpen;
  const visibleTree = useMemo(() => pickerTree(allNodes, query), [allNodes, query]);
  const ids = paneIds(state.layout);
  const rects = paneRects(state.layout);
  const dividers = splitDividers(state.layout);
  const minimumSize = minimumLayoutSize(state.layout);
  const selectedId = state.selectedPaneId && ids.includes(state.selectedPaneId)
    ? state.selectedPaneId : ids[0] ?? null;
  const selectedPane = selectedId ? state.panes[selectedId] : null;
  const selectedPaneRef = useRef(selectedPane);
  selectedPaneRef.current = selectedPane;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const moveTargets = ids.filter((id) => id !== selectedId);

  function chooseModule(node: VaultNode) {
    onAddNode(node, selectedId, addSide);
    setPickerOpen(false);
    setQuery("");
  }

  function renderPickerNode(node: VaultNode): React.ReactNode {
    if (node.node_type === "Folder") {
      const expanded = Boolean(query.trim()) || expandedFolders.has(node.relative_path);
      return <li key={node.relative_path}>
        <button type="button" className="workspace-picker-row folder" aria-expanded={expanded} disabled={Boolean(query.trim())}
          onClick={() => setExpandedFolders((previous) => {
            const next = new Set(previous);
            if (next.has(node.relative_path)) next.delete(node.relative_path);
            else next.add(node.relative_path);
            return next;
          })}>
          <ChevronDownIcon size={12} className={expanded ? "" : "collapsed"} />
          <FolderIcon size={15} /> <span>{node.name}</span>
        </button>
        {expanded && <ul>{node.children.map(renderPickerNode)}</ul>}
      </li>;
    }
    return <li key={node.relative_path}>
      <button type="button" className="workspace-picker-row file" title={node.relative_path}
        onClick={() => chooseModule(node)}>
        <FileIcon size={15} /> <span>{node.name}</span><small>{node.node_type.File.toUpperCase()}</small>
      </button>
    </li>;
  }

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog || !dialog.contains(document.activeElement)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (pickerOpenRef.current) setPickerOpen(false);
        else if (selectedPaneRef.current?.highlightEnabled) {
          const id = selectedPaneRef.current.id;
          onChangeRef.current((previous) => {
            const pane = previous.panes[id];
            return pane ? { ...previous, panes: { ...previous.panes, [id]: { ...pane, highlightEnabled: false, erasingHighlights: false } } } : previous;
          });
        }
        else onCloseRef.current();
      } else if (event.key === "Tab") {
        const controls = [...dialog.querySelectorAll<HTMLElement>("button:not(:disabled), select:not(:disabled), input:not(:disabled)")]
          .filter((element) => element.offsetParent !== null);
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    if (!moveTargets.includes(moveTarget)) setMoveTarget(moveTargets[0] ?? "");
  }, [moveTarget, moveTargets.join("|")]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const height = entry.contentRect.height;
      setViewportSize((previous) => previous.width === width && previous.height === height
        ? previous : { width, height });
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (!selectedId || (!dialogRef.current?.contains(activeElement)
        && activeElement !== document.body && activeElement !== document.documentElement)) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.closest("input, select, textarea, .workspace-picker, .workspace-arrange-bar, [role='separator']") || target.isContentEditable)) return;
      const pane = state.panes[selectedId];
      if (!pane) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (event.altKey || (modifier && !["+", "=", "-", "_", "0"].includes(event.key)
        && !["NumpadAdd", "NumpadSubtract", "Numpad0"].includes(event.code))) return;
      const key = event.key.toLowerCase();
      let patch: Partial<WorkspacePaneState> | null = null;
      if (!modifier && event.key === "ArrowLeft") patch = { page: Math.max(1, pane.page - 1) };
      else if (!modifier && event.key === "ArrowRight") patch = { page: Math.min(pane.numPages ?? pane.page, pane.page + 1) };
      else if (event.ctrlKey && (event.key === "+" || event.key === "=" || event.code === "NumpadAdd")) patch = { zoom: Math.min(MAX_ZOOM, Math.max(pane.zoom + 0.05, Math.floor(pane.zoom * 10 + 1.0001) / 10)), fitWidth: false, fitHeight: false };
      else if (event.ctrlKey && (event.key === "-" || event.key === "_" || event.code === "NumpadSubtract")) patch = { zoom: Math.max(MIN_ZOOM, Math.min(pane.zoom - 0.05, Math.ceil(pane.zoom * 10 - 1.0001) / 10)), fitWidth: false, fitHeight: false };
      else if (modifier && (event.key === "0" || event.code === "Numpad0")) patch = { fitWidth: !pane.fitWidth, fitHeight: false, zoom: pane.fitWidth ? 1 : pane.zoom };
      else if (!modifier && key === "d") patch = { viewMode: FILTER_ORDER[(FILTER_ORDER.indexOf(pane.viewMode) + 1) % FILTER_ORDER.length] };
      else if (!modifier && key === "c") patch = { continuous: !pane.continuous };
      else if (!modifier && key === "h" && pane.numPages) patch = { highlightEnabled: !pane.highlightEnabled, erasingHighlights: false };
      if (patch) {
        event.preventDefault();
        updatePane(selectedId, patch);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [selectedId, state.panes]);

  function setDividerRatio(path: string, ratio: number) {
    onChange((previous) => {
      const layout = resizeSplit(previous.layout, path, ratio);
      return layout === previous.layout ? previous : { ...previous, layout };
    });
  }

  function dragDivider(event: React.PointerEvent<HTMLDivElement>, path: string, axis: "row" | "column", rect: { left: number; top: number; width: number; height: number }) {
    const canvas = canvasRef.current;
    if (!canvas || event.button !== 0) return;
    event.preventDefault();
    const bounds = canvas.getBoundingClientRect();
    const start = axis === "row" ? bounds.left + bounds.width * rect.left / 100 : bounds.top + bounds.height * rect.top / 100;
    const length = (axis === "row" ? bounds.width * rect.width : bounds.height * rect.height) / 100;
    if (length <= 0) return;
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    const handle = event.currentTarget;
    const originalPosition = axis === "row" ? handle.style.left : handle.style.top;
    const ratioAt = (pointer: PointerEvent) => Math.max(0.15, Math.min(0.85,
      ((axis === "row" ? pointer.clientX : pointer.clientY) - start) / length));
    handle.classList.add("dragging");
    const positionHandle = (ratio: number) => {
      const position = (axis === "row" ? rect.left + rect.width * ratio : rect.top + rect.height * ratio);
      if (axis === "row") handle.style.left = `${position}%`;
      else handle.style.top = `${position}%`;
    };
    const move = (pointer: PointerEvent) => positionHandle(ratioAt(pointer));
    const finish = (pointer: PointerEvent) => {
      if (pointer.type === "pointerup") {
        const ratio = ratioAt(pointer);
        positionHandle(ratio);
        setDividerRatio(path, ratio);
      }
      else if (axis === "row") handle.style.left = originalPosition;
      else handle.style.top = originalPosition;
      handle.classList.remove("dragging");
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", finish);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  }

  function updatePane(id: string, patch: Partial<WorkspacePaneState>) {
    onChange((previous) => {
      const pane = previous.panes[id];
      if (!pane || Object.entries(patch).every(([key, value]) => pane[key as keyof WorkspacePaneState] === value)) return previous;
      return { ...previous, panes: { ...previous.panes, [id]: { ...pane, ...patch } } };
    });
  }

  function closePane(id: string) {
    onChange((previous) => {
      const layout = removePane(previous.layout, id);
      const panes = { ...previous.panes };
      delete panes[id];
      const selectedPaneId = previous.selectedPaneId === id ? paneIds(layout)[0] ?? null : previous.selectedPaneId;
      return { layout, panes, selectedPaneId };
    });
  }

  function arrange(dragged: string, target: string, side: WorkspaceSide) {
    onChange((previous) => ({ ...previous, layout: movePane(previous.layout, dragged, target, side) }));
    setDraggedId(null);
  }

  function startPaneDrag(event: React.PointerEvent<HTMLElement>, id: string) {
    if (event.button !== 0) return;
    event.preventDefault();
    const { clientX, clientY, pointerId } = event;
    let started = false;
    const move = (next: PointerEvent) => {
      if (next.pointerId !== pointerId) return;
      if (!started && Math.hypot(next.clientX - clientX, next.clientY - clientY) > 5) {
        started = true;
        setDraggedId(id);
      }
    };
    const finish = (next: PointerEvent) => {
      if (next.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      if (started && next.type === "pointerup") {
        const zone = document.elementFromPoint(next.clientX, next.clientY)?.closest<HTMLElement>(".workspace-drop-zone");
        const target = zone?.dataset.paneId;
        const side = zone?.dataset.side as WorkspaceSide | undefined;
        if (target && side && target !== id) arrange(id, target, side);
      }
      setDraggedId(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }

  function renderPane(id: string): React.ReactNode {
    const pane = state.panes[id];
    const rect = rects[id];
    if (!pane || !rect) return null;
    return <div key={id} className="workspace-pane-slot" style={{
      left: `${rect.left}%`, top: `${rect.top}%`, width: `${rect.width}%`, height: `${rect.height}%`,
    }}><WorkspacePane
      vaultRoot={vaultRoot}
      pane={pane}
      highlightRevision={highlightRevisions[pane.node.relative_path] ?? 0}
      onHighlightChanged={() => setHighlightRevisions((previous) => ({ ...previous,
        [pane.node.relative_path]: (previous[pane.node.relative_path] ?? 0) + 1 }))}
      selected={selectedId === pane.id}
      compactMode={compactMode}
      draggedId={draggedId}
      onSelect={() => onChange((previous) => {
        if (previous.selectedPaneId === pane.id) return previous;
        const panes = { ...previous.panes };
        for (const [id, current] of Object.entries(panes)) {
          if (current.highlightEnabled) panes[id] = { ...current, highlightEnabled: false, erasingHighlights: false };
        }
        return { ...previous, panes, selectedPaneId: pane.id };
      })}
      onUpdate={(patch) => updatePane(pane.id, patch)}
      onClose={() => closePane(pane.id)}
      onDuplicate={() => onAddNode(pane.node, pane.id, "right", pane.page)}
      onOpenSingle={() => onOpenSingle(pane.node, pane.page)}
      onDragHandlePointerDown={(event) => startPaneDrag(event, pane.id)}
    /></div>;
  }

  return <div ref={dialogRef} className="multi-workspace-overlay" role="dialog" aria-modal="true" aria-label="Document workspace">
    <header className="multi-workspace-header">
      <div className="multi-workspace-heading">
        <button type="button" onClick={onClose} className="workspace-toolbar-btn workspace-back-btn"
          aria-label="Back to library" title="Back to library"><ChevronLeftIcon size={16} /></button>
        <div><strong>Document workspace</strong><span>Session only · {ids.length} {ids.length === 1 ? "view" : "views"}</span></div>
      </div>
      <div className="multi-workspace-actions">
        <div className="workspace-header-group workspace-add-actions" role="group" aria-label="Add views">
          <label>Place new view
            <select value={addSide} onChange={(event) => setAddSide(event.target.value as WorkspaceSide)}>
              {SIDES.map((side) => <option key={side.value} value={side.value}>{side.label}</option>)}
            </select>
          </label>
          <div className="workspace-picker-anchor">
            <button type="button" className="workspace-toolbar-btn workspace-icon-toolbar-btn workspace-add-module-btn"
              aria-label="Add module" title="Add module"
              onClick={() => setPickerOpen((open) => !open)} aria-expanded={pickerOpen} aria-controls="workspace-module-picker">
              <PlusIcon size={16} />
            </button>
            {pickerOpen && <section id="workspace-module-picker" className="workspace-picker" aria-label="Choose a module">
              <label htmlFor="workspace-module-search">Choose a PDF or presentation</label>
              <input id="workspace-module-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search modules" autoFocus />
              <div className="workspace-picker-results">
                {visibleTree.length === 0 ? <p>No matching readable modules.</p> : <ul>{visibleTree.map(renderPickerNode)}</ul>}
              </div>
            </section>}
          </div>
          <button type="button" className="workspace-toolbar-btn workspace-icon-toolbar-btn" disabled={!selectedPane}
            aria-label="Add another view of selected module" title="Add another view of selected module"
            onClick={() => selectedPane && onAddNode(selectedPane.node, selectedId, addSide, selectedPane.page)}>
            <DuplicateIcon size={16} />
          </button>
        </div>
        <div className="workspace-header-group workspace-tools-actions" role="group" aria-label="Workspace tools">
          <div className="workspace-highlight-anchor">
            <button type="button" className="workspace-toolbar-btn workspace-icon-toolbar-btn" disabled={!selectedPane?.numPages}
              aria-label={selectedPane ? `Highlight in ${selectedPane.node.name}` : "Highlight selected view"}
              title="Highlight selected view (H)"
              aria-keyshortcuts="H" aria-pressed={selectedPane?.highlightEnabled ?? false}
              aria-expanded={selectedPane?.highlightEnabled ?? false} aria-controls="workspace-highlight-menu"
              onClick={() => selectedId && updatePane(selectedId, {
                highlightEnabled: !selectedPane?.highlightEnabled, erasingHighlights: false,
              })}><HighlighterIcon size={17} /></button>
            {selectedPane?.highlightEnabled && <div id="workspace-highlight-menu" className="workspace-highlight-palette" role="group"
              aria-label={`Highlight controls for ${selectedPane.node.name}`}>
              <span>{selectedPane.erasingHighlights ? "Click a highlight to erase" : "Drag over text or a page area"}</span>
              <div className="workspace-highlight-colors" role="group" aria-label="Highlight colors">
                {HIGHLIGHT_COLORS.map((color) => <button key={color.id} type="button" className="workspace-highlight-swatch" title={color.label}
                  aria-label={`${color.label} highlight`} aria-pressed={!selectedPane.erasingHighlights && selectedPane.highlightColor === color.id}
                  onClick={() => { localStorage.setItem("syllex_highlight_color", color.id); updatePane(selectedPane.id, { highlightColor: color.id, erasingHighlights: false }); }}>
                  <span style={{ backgroundColor: color.swatch }} aria-hidden="true" />
                </button>)}
                <button type="button" className="workspace-highlight-icon-btn" aria-label="Erase highlights" title="Erase highlights"
                  aria-pressed={selectedPane.erasingHighlights}
                  onClick={() => updatePane(selectedPane.id, { erasingHighlights: true })}><CloseIcon size={15} /></button>
              </div>
              <button type="button" className="workspace-highlight-icon-btn" aria-label="Done highlighting" title="Done"
                onClick={() => updatePane(selectedPane.id, { highlightEnabled: false, erasingHighlights: false })}><CheckIcon size={16} /></button>
            </div>}
          </div>
          {ids.length > 1 && <button type="button" className="workspace-toolbar-btn workspace-icon-toolbar-btn workspace-arrange-toggle"
            aria-label={arrangeOpen ? "Hide arrange controls" : "Show arrange controls"}
            aria-expanded={arrangeOpen} aria-controls="workspace-arrange-bar"
            title={arrangeOpen ? "Hide arrange controls" : "Show arrange controls"}
            onClick={() => setArrangeOpen((open) => !open)}>
            <ArrangeDrawerIcon size={16} />
          </button>}
          <button type="button" className="workspace-compact-toggle" aria-pressed={compactMode}
            onClick={onToggleCompactMode}>
            <span>Compact</span><span className="workspace-switch" aria-hidden="true"><span /></span>
          </button>
        </div>
      </div>
    </header>

    {arrangeOpen && ids.length > 1 && selectedPane && <div id="workspace-arrange-bar" className="workspace-arrange-bar">
      <span>Move <strong>{selectedPane.node.name}</strong> next to</span>
      <select aria-label="Target view" value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)}>
        {moveTargets.map((id) => <option key={id} value={id}>{state.panes[id]?.node.name ?? "View"} · view {ids.indexOf(id) + 1}</option>)}
      </select>
      <select aria-label="Placement" value={moveSide} onChange={(event) => setMoveSide(event.target.value as WorkspaceSide)}>
        {SIDES.map((side) => <option key={side.value} value={side.value}>{side.label}</option>)}
      </select>
      <button type="button" className="workspace-toolbar-btn" disabled={!moveTarget}
        onClick={() => selectedId && arrange(selectedId, moveTarget, moveSide)}>Move</button>
      <span className="workspace-drag-tip">or drag a view by its six-dot handle</span>
    </div>}

    <div ref={contentRef} className="multi-workspace-content">
      {state.layout ? <div ref={canvasRef} className="workspace-canvas" style={{
        width: Math.max(viewportSize.width, minimumSize.width),
        height: Math.max(viewportSize.height, minimumSize.height),
      }}>{ids.map(renderPane)}{dividers.map((divider) => {
        const position = divider.axis === "row" ? divider.rect.left + divider.rect.width * divider.ratio : divider.rect.top + divider.rect.height * divider.ratio;
        return <div key={divider.path} className={`workspace-divider axis-${divider.axis}`} role="separator"
          aria-label={divider.axis === "row" ? "Resize views left and right" : "Resize views above and below"}
          aria-orientation={divider.axis === "row" ? "vertical" : "horizontal"}
          aria-valuemin={15} aria-valuemax={85} aria-valuenow={Math.round(divider.ratio * 100)} tabIndex={0}
          style={divider.axis === "row" ? { left: `${position}%`, top: `${divider.rect.top}%`, height: `${divider.rect.height}%` }
            : { top: `${position}%`, left: `${divider.rect.left}%`, width: `${divider.rect.width}%` }}
          onPointerDown={(event) => dragDivider(event, divider.path, divider.axis, divider.rect)}
          onKeyDown={(event) => {
            const change = divider.axis === "row" ? (event.key === "ArrowRight" ? 0.05 : event.key === "ArrowLeft" ? -0.05 : 0)
              : (event.key === "ArrowDown" ? 0.05 : event.key === "ArrowUp" ? -0.05 : 0);
            if (change) { event.preventDefault(); setDividerRatio(divider.path, divider.ratio + change); }
          }} />;
      })}</div> : <div className="workspace-empty">
        <h2>No views open</h2>
        <p>Add a PDF or presentation to start reading modules together.</p>
        <button type="button" className="workspace-toolbar-btn" onClick={() => setPickerOpen(true)}>Choose a module</button>
      </div>}
    </div>
  </div>;
}

interface WorkspacePaneProps {
  vaultRoot: string;
  pane: WorkspacePaneState;
  highlightRevision: number;
  onHighlightChanged: () => void;
  selected: boolean;
  compactMode: boolean;
  draggedId: string | null;
  onSelect: () => void;
  onUpdate: (patch: Partial<WorkspacePaneState>) => void;
  onClose: () => void;
  onDuplicate: () => void;
  onOpenSingle: () => void;
  onDragHandlePointerDown: (event: React.PointerEvent<HTMLElement>) => void;
}

function WorkspacePane({ vaultRoot, pane, highlightRevision, onHighlightChanged, selected, compactMode, draggedId, onSelect, onUpdate, onClose,
  onDuplicate, onOpenSingle, onDragHandlePointerDown }: WorkspacePaneProps) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightError, setHighlightError] = useState<string | null>(null);
  const [highlightToast, setHighlightToast] = useState<{ kind: "saved" | "erased"; highlight: Highlight } | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [optionsSection, setOptionsSection] = useState<"view" | "ruler">("view");
  const [readingRulerEnabled, setReadingRulerEnabled] = useState(false);
  const [readingRulerDragMode, setReadingRulerDragMode] = useState(false);
  const [readingRulerHeight, setReadingRulerHeight] = useState(48);
  const [readingRulerColor, setReadingRulerColor] = useState("#ffc444");
  const [readingRulerOpacity, setReadingRulerOpacity] = useState(33);
  const optionsRef = useRef<HTMLDivElement>(null);
  const optionsButtonRef = useRef<HTMLButtonElement>(null);
  const rulerSettingsButtonRef = useRef<HTMLButtonElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const undoPendingRef = useRef(false);
  const deletingIdsRef = useRef(new Set<string>());
  const zoomPercent = Math.round(pane.zoom * 100);
  const zoomOptions = [...new Set([50, 75, 100, 125, 150, 200, zoomPercent])].sort((a, b) => a - b);

  useEffect(() => {
    if (!optionsOpen) return;
    optionsRef.current?.querySelector<HTMLElement>("select, input")?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!optionsRef.current?.contains(event.target as Node)) setOptionsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOptionsOpen(false);
      (optionsSection === "ruler" ? rulerSettingsButtonRef : optionsButtonRef).current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [optionsOpen, optionsSection]);

  useEffect(() => {
    let active = true;
    let task: pdfjsLib.PDFDocumentLoadingTask | null = null;
    setPdfDoc(null);
    setLoading(true);
    setError(null);
    async function load() {
      try {
        const isPresentation = /\.pptx?$/i.test(pane.node.relative_path);
        const bytes = await invoke<number[]>(isPresentation ? "convert_ppt_to_pdf" : "read_module_bytes", {
          vaultRoot, relativePath: pane.node.relative_path,
        });
        if (!active) return;
        task = pdfjsLib.getDocument(getPdfDocumentParams(new Uint8Array(bytes)));
        const document = await task.promise;
        if (!active) return;
        setPdfDoc(document);
        onUpdate({ page: Math.min(Math.max(pane.page, 1), document.numPages), numPages: document.numPages });
      } catch (cause: unknown) {
        if (active) setError(toUserFacingError(cause, "open this module"));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; void task?.destroy(); };
  }, [vaultRoot, pane.node.relative_path]);

  useEffect(() => {
    let active = true;
    void invoke<Highlight[]>("list_highlights", { vaultRoot, relativePath: pane.node.relative_path })
      .then((items) => { if (active) { setHighlights(items); setHighlightError(null); } })
      .catch((cause: unknown) => { if (active) setHighlightError(toUserFacingError(cause, "load highlights")); });
    return () => { active = false; };
  }, [vaultRoot, pane.node.relative_path, highlightRevision]);

  useEffect(() => () => { if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current); }, []);

  function showHighlightToast(kind: "saved" | "erased", highlight: Highlight) {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setHighlightToast({ kind, highlight });
    toastTimerRef.current = window.setTimeout(() => setHighlightToast(null), 6000);
  }

  function clearHighlightToast() {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setHighlightToast(null);
  }

  async function saveHighlight(pageNumber: number, rects: HighlightRect[]) {
    const highlight: Highlight = { id: crypto.randomUUID(), page_number: pageNumber, color: pane.highlightColor, rects };
    try {
      await invoke("save_highlight", { vaultRoot, relativePath: pane.node.relative_path, highlight });
      setHighlights((current) => [...current, highlight]);
      setHighlightError(null);
      showHighlightToast("saved", highlight);
      onHighlightChanged();
    } catch (cause: unknown) {
      setHighlightError(toUserFacingError(cause, "save this highlight"));
    }
  }

  async function eraseHighlight(id: string) {
    if (deletingIdsRef.current.has(id)) return;
    const highlight = highlights.find((item) => item.id === id);
    if (!highlight) return;
    deletingIdsRef.current.add(id);
    try {
      await invoke("delete_highlight", { vaultRoot, relativePath: pane.node.relative_path, id });
      setHighlights((current) => current.filter((item) => item.id !== id));
      setHighlightError(null);
      showHighlightToast("erased", highlight);
      onHighlightChanged();
    } catch (cause: unknown) {
      setHighlightError(toUserFacingError(cause, "erase this highlight"));
    } finally {
      deletingIdsRef.current.delete(id);
    }
  }

  async function undoHighlight() {
    if (!highlightToast || undoPendingRef.current) return;
    undoPendingRef.current = true;
    const { kind, highlight } = highlightToast;
    try {
      if (kind === "saved") {
        await invoke("delete_highlight", { vaultRoot, relativePath: pane.node.relative_path, id: highlight.id });
        setHighlights((current) => current.filter((item) => item.id !== highlight.id));
      } else {
        await invoke("save_highlight", { vaultRoot, relativePath: pane.node.relative_path, highlight });
        setHighlights((current) => [...current.filter((item) => item.id !== highlight.id), highlight]);
      }
      setHighlightError(null);
      clearHighlightToast();
      onHighlightChanged();
    } catch (cause: unknown) {
      setHighlightError(toUserFacingError(cause, "undo this highlight change"));
    } finally {
      undoPendingRef.current = false;
    }
  }

  const canMove = draggedId && draggedId !== pane.id;
  const zoomSelect = <select aria-label={`Zoom for ${pane.node.name}`} title="Zoom (Ctrl + / Ctrl -)" value={pane.fitHeight ? "fit-height" : pane.fitWidth ? "fit-width" : String(zoomPercent)}
    onChange={(event) => {
      if (event.target.value === "fit-width") onUpdate({ fitWidth: true, fitHeight: false });
      else if (event.target.value === "fit-height") onUpdate({ fitWidth: false, fitHeight: true });
      else onUpdate({ fitWidth: false, fitHeight: false, zoom: Number(event.target.value) / 100 });
    }}>
    <option value="fit-width">Fit width</option>
    <option value="fit-height">Fit height</option>
    {zoomOptions.map((value) => <option key={value} value={value}>{value}%</option>)}
  </select>;
  const filterSelect = <select aria-label={`Reading filter for ${pane.node.name}`} title={VIEW_MODE_LABELS[pane.viewMode]} value={pane.viewMode}
    onChange={(event) => onUpdate({ viewMode: event.target.value as DocumentViewMode })}>
    {Object.entries(VIEW_MODE_SHORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
  </select>;

  return <section className={`workspace-pane ${selected ? "selected" : ""}`} onPointerDown={onSelect} onFocusCapture={onSelect} aria-label={`View of ${pane.node.name}`}>
    <header className="workspace-pane-header">
      <div className="workspace-pane-identity">
        <span className="workspace-drag-handle" onPointerDown={onDragHandlePointerDown}
          title="Drag onto an edge of another view" aria-label={`Drag ${pane.node.name} to arrange`}>
          <GripIcon size={16} />
        </span>
        <strong title={pane.node.name}>{pane.node.name}</strong>
      </div>
      <div className="workspace-pane-controls" role="group" aria-label={`Reading controls for ${pane.node.name}`}>
        <div className="workspace-page-navigation" data-continuous={pane.continuous}>
          <button type="button" onClick={() => onUpdate({ page: Math.max(1, pane.page - 1) })} disabled={pane.continuous || loading || pane.page <= 1} aria-label={`Previous page of ${pane.node.name}`} title="Previous page (Left)"><ChevronLeftIcon size={14} /></button>
          <span title={`Page ${pane.page} of ${pdfDoc?.numPages ?? "unknown"}`}>
            <span aria-hidden="true">p{pane.page}/{pdfDoc?.numPages ?? "–"}</span>
            <span className="workspace-sr-only">Page {pane.page} of {pdfDoc?.numPages ?? "unknown"}</span>
          </span>
          <button type="button" onClick={() => onUpdate({ page: Math.min(pdfDoc?.numPages ?? pane.page, pane.page + 1) })} disabled={pane.continuous || loading || !pdfDoc || pane.page >= pdfDoc.numPages} aria-label={`Next page of ${pane.node.name}`} title="Next page (Right)"><ChevronRightIcon size={14} /></button>
        </div>
        <button type="button" onClick={() => onUpdate({ continuous: !pane.continuous })} aria-pressed={pane.continuous}
          aria-label={pane.continuous ? `Switch ${pane.node.name} to single-page view` : `Switch ${pane.node.name} to continuous scroll`}
          title={pane.continuous ? "Continuous scroll; switch to single page (C)" : "Single page; switch to continuous scroll (C)"}>
          {pane.continuous ? <ContinuousModeIcon size={16} /> : <PageModeIcon size={16} />}
        </button>
        {!compactMode && zoomSelect}
        {!compactMode && filterSelect}
        <div className="workspace-view-options" ref={optionsRef}
          onBlurCapture={(event) => {
            if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOptionsOpen(false);
          }}>
          {compactMode && <button type="button" ref={optionsButtonRef} aria-label={`More view options for ${pane.node.name}`}
            aria-expanded={optionsOpen && optionsSection === "view"} title="Zoom and reading filter"
            onClick={() => { setOptionsOpen((open) => optionsSection === "view" ? !open : true); setOptionsSection("view"); }}>…</button>}
          <button type="button" onClick={() => { setReadingRulerEnabled((enabled) => !enabled); setOptionsOpen(false); }}
            aria-pressed={readingRulerEnabled} aria-label={`Reading ruler for ${pane.node.name}`}
            title="Toggle reading ruler" disabled={loading || !!error || !pdfDoc}>▰</button>
          <button type="button" ref={rulerSettingsButtonRef} aria-label={`Customize reading ruler for ${pane.node.name}`}
            aria-expanded={optionsOpen && optionsSection === "ruler"} title="Customize reading ruler"
            disabled={loading || !!error || !pdfDoc}
            onClick={() => { setOptionsOpen((open) => optionsSection === "ruler" ? !open : true); setOptionsSection("ruler"); }}><SettingsIcon size={14} /></button>
          {optionsOpen && <div className="workspace-view-options-popover" role="group" aria-label={`View options for ${pane.node.name}`}>
            {optionsSection === "view" && <>
            <label>Zoom
              {zoomSelect}
            </label>
            <label>Reading filter
              {filterSelect}
            </label>
            </>}
            {optionsSection === "ruler" && <ReadingRulerSettings
              dragMode={readingRulerDragMode} onDragModeChange={setReadingRulerDragMode}
              height={readingRulerHeight} onHeightChange={setReadingRulerHeight}
              color={readingRulerColor} onColorChange={setReadingRulerColor}
              opacity={readingRulerOpacity} onOpacityChange={setReadingRulerOpacity} />}
          </div>}
        </div>
      </div>
      <div className="workspace-pane-actions" role="group" aria-label={`View actions for ${pane.node.name}`}>
        <button type="button" onClick={onDuplicate} aria-label={`Duplicate view of ${pane.node.name}`} title="Open another view of this module"><DuplicateIcon size={15} /></button>
        <button type="button" onClick={onOpenSingle} aria-label={`Open ${pane.node.name} in full reader`} title="Open in full reader"><ExpandIcon size={15} /></button>
        <button type="button" onClick={onClose} aria-label={`Close view of ${pane.node.name}`} title="Close view"><CloseIcon size={13} /></button>
      </div>
    </header>
    <div className="workspace-pane-reading">
      {(highlightError || highlightToast) && <div className="workspace-highlight-feedback">
        {highlightError && <p className="workspace-highlight-error" role="alert">{highlightError}</p>}
        {highlightToast && <div className="workspace-highlight-toast" role="status">
          Highlight {highlightToast.kind === "saved" ? "saved" : "erased"}
          <button type="button" onClick={() => { void undoHighlight(); }}>Undo</button>
        </div>}
      </div>}
      {loading && <p className="workspace-pane-message" role="status">Loading module…</p>}
      {error && <p className="workspace-pane-message error" role="alert">{error}</p>}
      {!loading && !error && pdfDoc && <PdfJsViewer
        pdfDoc={pdfDoc} currentPage={pane.page} zoom={pane.zoom} isFitWidth={pane.fitWidth} isFitHeight={pane.fitHeight}
        continuous={pane.continuous} viewMode={pane.viewMode} onPageChange={(page) => onUpdate({ page })}
        highlights={highlights} highlightEnabled={pane.highlightEnabled} erasingHighlights={pane.erasingHighlights} highlightColor={pane.highlightColor}
        onCreateHighlight={(page, rects) => { void saveHighlight(page, rects); }} onEraseHighlight={(id) => { void eraseHighlight(id); }} focusHighlight={null}
        sidebarVisible={false} sidebarWidth={0} sidebarDock="left"
        readingRulerEnabled={readingRulerEnabled}
        readingRulerDragMode={readingRulerDragMode}
        readingRulerHeight={readingRulerHeight}
        readingRulerColor={readingRulerColor}
        readingRulerOpacity={readingRulerOpacity}
        onScaleChange={(zoom) => { if (!pane.fitWidth && !pane.fitHeight) onUpdate({ zoom }); }}
      />}
    </div>
    {canMove && <div className="workspace-drop-zones">
      {SIDES.map((side) => <div key={side.value} className={`workspace-drop-zone side-${side.value}`}
        data-pane-id={pane.id} data-side={side.value}>{side.label}</div>)}
    </div>}
  </section>;
}
