export type WorkspaceSide = "left" | "right" | "top" | "bottom";

export type WorkspaceLayout =
  | { kind: "pane"; paneId: string }
  | { kind: "split"; axis: "row" | "column"; ratio?: number; first: WorkspaceLayout; second: WorkspaceLayout };

export interface WorkspaceRect { left: number; top: number; width: number; height: number }
export interface WorkspaceDivider { path: string; axis: "row" | "column"; ratio: number; rect: WorkspaceRect }

export function splitRatio(node: Extract<WorkspaceLayout, { kind: "split" }>): number {
  return node.ratio ?? 0.5;
}

export function paneRects(layout: WorkspaceLayout | null): Record<string, WorkspaceRect> {
  const rects: Record<string, WorkspaceRect> = {};
  function visit(node: WorkspaceLayout, rect: WorkspaceRect) {
    if (node.kind === "pane") {
      rects[node.paneId] = rect;
      return;
    }
    if (node.axis === "row") {
      const firstWidth = rect.width * splitRatio(node);
      visit(node.first, { ...rect, width: firstWidth });
      visit(node.second, { ...rect, left: rect.left + firstWidth, width: rect.width - firstWidth });
    } else {
      const firstHeight = rect.height * splitRatio(node);
      visit(node.first, { ...rect, height: firstHeight });
      visit(node.second, { ...rect, top: rect.top + firstHeight, height: rect.height - firstHeight });
    }
  }
  if (layout) visit(layout, { left: 0, top: 0, width: 100, height: 100 });
  return rects;
}

export function splitDividers(layout: WorkspaceLayout | null): WorkspaceDivider[] {
  const result: WorkspaceDivider[] = [];
  function visit(node: WorkspaceLayout, rect: WorkspaceRect, path: string) {
    if (node.kind === "pane") return;
    const ratio = splitRatio(node);
    result.push({ path, axis: node.axis, ratio, rect });
    if (node.axis === "row") {
      const firstWidth = rect.width * ratio;
      visit(node.first, { ...rect, width: firstWidth }, `${path}0`);
      visit(node.second, { ...rect, left: rect.left + firstWidth, width: rect.width - firstWidth }, `${path}1`);
    } else {
      const firstHeight = rect.height * ratio;
      visit(node.first, { ...rect, height: firstHeight }, `${path}0`);
      visit(node.second, { ...rect, top: rect.top + firstHeight, height: rect.height - firstHeight }, `${path}1`);
    }
  }
  if (layout) visit(layout, { left: 0, top: 0, width: 100, height: 100 }, "");
  return result;
}

export function resizeSplit(layout: WorkspaceLayout | null, path: string, ratio: number): WorkspaceLayout | null {
  if (!layout || layout.kind === "pane") return layout;
  if (path === "") {
    const nextRatio = Math.max(0.15, Math.min(0.85, ratio));
    return splitRatio(layout) === nextRatio ? layout : { ...layout, ratio: nextRatio };
  }
  const branch = path[0] === "0" ? "first" : "second";
  const child = resizeSplit(layout[branch], path.slice(1), ratio);
  return child === layout[branch] ? layout : { ...layout, [branch]: child };
}

export function minimumLayoutSize(layout: WorkspaceLayout | null): { width: number; height: number } {
  if (!layout || layout.kind === "pane") return { width: 190, height: 160 };
  const first = minimumLayoutSize(layout.first);
  const second = minimumLayoutSize(layout.second);
  const ratio = splitRatio(layout);
  return layout.axis === "row"
    ? { width: Math.max(first.width / ratio, second.width / (1 - ratio)), height: Math.max(first.height, second.height) }
    : { width: Math.max(first.width, second.width), height: Math.max(first.height / ratio, second.height / (1 - ratio)) };
}

export function paneIds(layout: WorkspaceLayout | null): string[] {
  if (!layout) return [];
  if (layout.kind === "pane") return [layout.paneId];
  return [...paneIds(layout.first), ...paneIds(layout.second)];
}

export function splitPane(
  layout: WorkspaceLayout | null,
  targetId: string | null,
  newId: string,
  side: WorkspaceSide,
): WorkspaceLayout {
  const added: WorkspaceLayout = { kind: "pane", paneId: newId };
  if (!layout) return added;
  if (!targetId || !paneIds(layout).includes(targetId)) targetId = paneIds(layout)[0];

  function visit(node: WorkspaceLayout): WorkspaceLayout {
    if (node.kind === "pane") {
      if (node.paneId !== targetId) return node;
      const axis = side === "left" || side === "right" ? "row" : "column";
      const addedFirst = side === "left" || side === "top";
      return {
        kind: "split",
        axis,
        first: addedFirst ? added : node,
        second: addedFirst ? node : added,
      };
    }
    return { ...node, first: visit(node.first), second: visit(node.second) };
  }

  return visit(layout);
}

export function removePane(layout: WorkspaceLayout | null, paneId: string): WorkspaceLayout | null {
  if (!layout) return null;
  if (layout.kind === "pane") return layout.paneId === paneId ? null : layout;
  const first = removePane(layout.first, paneId);
  const second = removePane(layout.second, paneId);
  if (!first) return second;
  if (!second) return first;
  return { ...layout, first, second };
}

export function movePane(
  layout: WorkspaceLayout | null,
  draggedId: string,
  targetId: string,
  side: WorkspaceSide,
): WorkspaceLayout | null {
  if (!layout || draggedId === targetId) return layout;
  const ids = paneIds(layout);
  if (!ids.includes(draggedId) || !ids.includes(targetId)) return layout;
  return splitPane(removePane(layout, draggedId), targetId, draggedId, side);
}
