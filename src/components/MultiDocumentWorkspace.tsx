import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { pdfjsLib, getPdfDocumentParams } from "../utils/pdfInit";
import { PdfJsViewer } from "./PdfJsViewer";
import { VIEW_MODE_LABELS, type DocumentViewMode } from "./PdfViewer";
import type { Highlight } from "../types/highlight";
import type { VaultNode } from "../types/vault";
import type { WorkspacePaneState, WorkspaceState } from "../types/workspace";
import { minimumLayoutSize, movePane, paneIds, paneRects, removePane, resizeSplit, splitDividers, type WorkspaceSide } from "../utils/workspaceLayout";
import { toUserFacingError } from "../utils/userFacingError";
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, CloseIcon, FileIcon, FolderIcon, PlusIcon } from "./Icons";
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
  onAddNode: (node: VaultNode, targetId?: string | null, side?: WorkspaceSide, page?: number) => void;
  onOpenSingle: (node: VaultNode, page: number) => void;
  onClose: () => void;
}

export function MultiDocumentWorkspace({
  vaultRoot, allNodes, state, onChange, onAddNode, onOpenSingle, onClose,
}: MultiDocumentWorkspaceProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [addSide, setAddSide] = useState<WorkspaceSide>("right");
  const [moveTarget, setMoveTarget] = useState("");
  const [moveSide, setMoveSide] = useState<WorkspaceSide>("right");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set());
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
      if (!dialogRef.current?.contains(document.activeElement) || !selectedId) return;
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
      else if (event.key === "+" || event.key === "=" || event.code === "NumpadAdd") patch = { zoom: Math.min(MAX_ZOOM, Math.max(pane.zoom + 0.05, Math.floor(pane.zoom * 10 + 1.0001) / 10)), fitWidth: false };
      else if (event.key === "-" || event.key === "_" || event.code === "NumpadSubtract") patch = { zoom: Math.max(MIN_ZOOM, Math.min(pane.zoom - 0.05, Math.ceil(pane.zoom * 10 - 1.0001) / 10)), fitWidth: false };
      else if (modifier && (event.key === "0" || event.code === "Numpad0")) patch = { fitWidth: !pane.fitWidth, zoom: pane.fitWidth ? 1 : pane.zoom };
      else if (!modifier && key === "d") patch = { viewMode: FILTER_ORDER[(FILTER_ORDER.indexOf(pane.viewMode) + 1) % FILTER_ORDER.length] };
      else if (!modifier && key === "c") patch = { continuous: !pane.continuous };
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

  function renderPane(id: string): React.ReactNode {
    const pane = state.panes[id];
    const rect = rects[id];
    if (!pane || !rect) return null;
    return <div key={id} className="workspace-pane-slot" style={{
      left: `${rect.left}%`, top: `${rect.top}%`, width: `${rect.width}%`, height: `${rect.height}%`,
    }}><WorkspacePane
      vaultRoot={vaultRoot}
      pane={pane}
      selected={selectedId === pane.id}
      draggedId={draggedId}
      onSelect={() => onChange((previous) => previous.selectedPaneId === pane.id
        ? previous : { ...previous, selectedPaneId: pane.id })}
      onUpdate={(patch) => updatePane(pane.id, patch)}
      onClose={() => closePane(pane.id)}
      onDuplicate={() => onAddNode(pane.node, pane.id, "right", pane.page)}
      onOpenSingle={() => onOpenSingle(pane.node, pane.page)}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", pane.id);
        setDraggedId(pane.id);
      }}
      onDragEnd={() => setDraggedId(null)}
      onDropSide={(event, side) => {
        const dragged = event.dataTransfer.getData("text/plain") || draggedId;
        if (dragged) arrange(dragged, pane.id, side);
      }}
    /></div>;
  }

  return <div ref={dialogRef} className="multi-workspace-overlay" role="dialog" aria-modal="true" aria-label="Document workspace">
    <header className="multi-workspace-header">
      <div className="multi-workspace-heading">
        <button type="button" onClick={onClose} className="workspace-toolbar-btn">Back to library</button>
        <div><strong>Document workspace</strong><span>Session only · {ids.length} {ids.length === 1 ? "view" : "views"}</span></div>
      </div>
      <div className="multi-workspace-actions">
        <label>Place new view
          <select value={addSide} onChange={(event) => setAddSide(event.target.value as WorkspaceSide)}>
            {SIDES.map((side) => <option key={side.value} value={side.value}>{side.label}</option>)}
          </select>
        </label>
        <div className="workspace-picker-anchor">
          <button type="button" className="workspace-toolbar-btn" onClick={() => setPickerOpen((open) => !open)} aria-expanded={pickerOpen} aria-controls="workspace-module-picker">
            <PlusIcon size={14} /> Add module
          </button>
          {pickerOpen && <section id="workspace-module-picker" className="workspace-picker" aria-label="Choose a module">
            <label htmlFor="workspace-module-search">Choose a PDF or presentation</label>
            <input id="workspace-module-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search modules" autoFocus />
            <div className="workspace-picker-results">
              {visibleTree.length === 0 ? <p>No matching readable modules.</p> : <ul>{visibleTree.map(renderPickerNode)}</ul>}
            </div>
          </section>}
        </div>
        <button type="button" className="workspace-toolbar-btn" disabled={!selectedPane}
          onClick={() => selectedPane && onAddNode(selectedPane.node, selectedId, addSide, selectedPane.page)}>
          Add view of selected
        </button>
      </div>
    </header>

    {ids.length > 1 && selectedPane && <div className="workspace-arrange-bar">
      <span>Move <strong>{selectedPane.node.name}</strong> next to</span>
      <select aria-label="Target view" value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)}>
        {moveTargets.map((id) => <option key={id} value={id}>{state.panes[id]?.node.name ?? "View"} · view {ids.indexOf(id) + 1}</option>)}
      </select>
      <select aria-label="Placement" value={moveSide} onChange={(event) => setMoveSide(event.target.value as WorkspaceSide)}>
        {SIDES.map((side) => <option key={side.value} value={side.value}>{side.label}</option>)}
      </select>
      <button type="button" className="workspace-toolbar-btn" disabled={!moveTarget}
        onClick={() => selectedId && arrange(selectedId, moveTarget, moveSide)}>Move</button>
      <span className="workspace-drag-tip">or drag a view title onto another view</span>
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
  selected: boolean;
  draggedId: string | null;
  onSelect: () => void;
  onUpdate: (patch: Partial<WorkspacePaneState>) => void;
  onClose: () => void;
  onDuplicate: () => void;
  onOpenSingle: () => void;
  onDragStart: (event: React.DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onDropSide: (event: React.DragEvent<HTMLElement>, side: WorkspaceSide) => void;
}

function WorkspacePane({ vaultRoot, pane, selected, draggedId, onSelect, onUpdate, onClose,
  onDuplicate, onOpenSingle, onDragStart, onDragEnd, onDropSide }: WorkspacePaneProps) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const zoomPercent = Math.round(pane.zoom * 100);
  const zoomOptions = [...new Set([50, 75, 100, 125, 150, 200, zoomPercent])].sort((a, b) => a - b);

  useEffect(() => {
    let active = true;
    let task: pdfjsLib.PDFDocumentLoadingTask | null = null;
    setPdfDoc(null);
    setHighlights([]);
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
        void invoke<Highlight[]>("list_highlights", { vaultRoot, relativePath: pane.node.relative_path })
          .then((items) => { if (active) setHighlights(items); })
          .catch(() => { /* Reading remains available when annotations cannot load. */ });
      } catch (cause: unknown) {
        if (active) setError(toUserFacingError(cause, "open this module"));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; void task?.destroy(); };
  }, [vaultRoot, pane.node.relative_path]);

  const canMove = draggedId && draggedId !== pane.id;

  return <section className={`workspace-pane ${selected ? "selected" : ""}`} onPointerDown={onSelect} onFocusCapture={onSelect} aria-label={`View of ${pane.node.name}`}>
    <header className="workspace-pane-header">
      <span className="workspace-drag-handle" draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
        title="Drag onto an edge of another view" aria-label={`Drag ${pane.node.name} to arrange`}>
        Drag
      </span>
      <strong title={pane.node.relative_path}>{pane.node.name}</strong>
      <div className="workspace-pane-actions">
        <button type="button" onClick={onDuplicate} title="Open another view of this module">Duplicate</button>
        <button type="button" onClick={onOpenSingle} title="Open in full reader">Full reader</button>
        <button type="button" onClick={onClose} aria-label={`Close view of ${pane.node.name}`} title="Close view"><CloseIcon size={13} /></button>
      </div>
    </header>
    <div className="workspace-pane-controls">
      {!pane.continuous && <>
        <button type="button" onClick={() => onUpdate({ page: Math.max(1, pane.page - 1) })} disabled={loading || pane.page <= 1} aria-label={`Previous page of ${pane.node.name}`} title="Previous page (Left)"><ChevronLeftIcon size={14} /></button>
        <span>Page {pane.page} of {pdfDoc?.numPages ?? "–"}</span>
        <button type="button" onClick={() => onUpdate({ page: Math.min(pdfDoc?.numPages ?? pane.page, pane.page + 1) })} disabled={loading || !pdfDoc || pane.page >= pdfDoc.numPages} aria-label={`Next page of ${pane.node.name}`} title="Next page (Right)"><ChevronRightIcon size={14} /></button>
      </>}
      {pane.continuous && <span>{pdfDoc?.numPages ?? "–"} pages</span>}
      <button type="button" onClick={() => onUpdate({ continuous: !pane.continuous })} aria-pressed={pane.continuous} title="Toggle continuous scroll (C)">
        {pane.continuous ? "Continuous" : "Single page"}
      </button>
      <button type="button" onClick={() => onUpdate({ zoom: Math.max(MIN_ZOOM, Math.round((pane.zoom - 0.1) * 100) / 100), fitWidth: false })}
        disabled={pane.zoom <= MIN_ZOOM} aria-label={`Zoom out of ${pane.node.name}`} title="Zoom out (-)">−</button>
      <select aria-label={`Zoom for ${pane.node.name}`} value={pane.fitWidth ? "fit" : String(zoomPercent)}
        onChange={(event) => event.target.value === "fit" ? onUpdate({ fitWidth: true }) : onUpdate({ fitWidth: false, zoom: Number(event.target.value) / 100 })}>
        <option value="fit">Fit width</option>
        {zoomOptions.map((value) => <option key={value} value={value}>{value}%</option>)}
      </select>
      <button type="button" onClick={() => onUpdate({ zoom: Math.min(MAX_ZOOM, Math.round((pane.zoom + 0.1) * 100) / 100), fitWidth: false })}
        disabled={pane.zoom >= MAX_ZOOM} aria-label={`Zoom in to ${pane.node.name}`} title="Zoom in (+)">+</button>
      <button type="button" onClick={() => onUpdate({ fitWidth: !pane.fitWidth, zoom: pane.fitWidth ? 1 : pane.zoom })}
        aria-pressed={pane.fitWidth} title="Fit width (Ctrl+0)">Fit width</button>
      <select aria-label={`Reading filter for ${pane.node.name}`} value={pane.viewMode}
        onChange={(event) => onUpdate({ viewMode: event.target.value as DocumentViewMode })}>
        {Object.entries(VIEW_MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <button type="button" onClick={() => onUpdate({ viewMode: FILTER_ORDER[(FILTER_ORDER.indexOf(pane.viewMode) + 1) % FILTER_ORDER.length] })}
        aria-label={`Cycle reading filter for ${pane.node.name}`} title="Next reading filter (D)">Filter</button>
    </div>
    <div className="workspace-pane-reading">
      {loading && <p className="workspace-pane-message" role="status">Loading module…</p>}
      {error && <p className="workspace-pane-message error" role="alert">{error}</p>}
      {!loading && !error && pdfDoc && <PdfJsViewer
        pdfDoc={pdfDoc} currentPage={pane.page} zoom={pane.zoom} isFitWidth={pane.fitWidth}
        continuous={pane.continuous} viewMode={pane.viewMode} onPageChange={(page) => onUpdate({ page })}
        highlights={highlights} highlightEnabled={false} erasingHighlights={false} highlightColor="yellow"
        onCreateHighlight={() => {}} onEraseHighlight={() => {}} focusHighlight={null}
        sidebarVisible={false} sidebarWidth={0} sidebarDock="left"
        onScaleChange={(zoom) => { if (!pane.fitWidth) onUpdate({ zoom }); }}
      />}
      {canMove && <div className="workspace-drop-zones">
        {SIDES.map((side) => <div key={side.value} className={`workspace-drop-zone side-${side.value}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); onDropSide(event, side.value); }}>
          {side.label}
        </div>)}
      </div>}
    </div>
  </section>;
}
