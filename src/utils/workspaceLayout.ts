export type WorkspaceSide = "left" | "right" | "top" | "bottom";

export type WorkspaceLayout =
  | { kind: "pane"; paneId: string }
  | { kind: "split"; axis: "row" | "column"; first: WorkspaceLayout; second: WorkspaceLayout };

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
