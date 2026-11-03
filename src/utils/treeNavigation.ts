import type { VaultNode } from "../types/vault";

export interface VisibleTreeNode {
  node: VaultNode;
  parentPath: string | null;
}

export function getVisibleTreeNodes(
  nodes: VaultNode[], expandedPaths: Set<string>, parentPath: string | null = null,
): VisibleTreeNode[] {
  return nodes.flatMap((node) => [
    { node, parentPath },
    ...(node.node_type === "Folder" && expandedPaths.has(node.relative_path)
      ? getVisibleTreeNodes(node.children, expandedPaths, node.relative_path)
      : []),
  ]);
}

export function getTreeNavigation(
  visibleNodes: VisibleTreeNode[], currentPath: string, key: string, expandedPaths: Set<string>,
): { focusPath?: string; togglePath?: string } | null {
  const index = visibleNodes.findIndex(({ node }) => node.relative_path === currentPath);
  if (index < 0) return null;
  const { node, parentPath } = visibleNodes[index];

  switch (key) {
    case "ArrowDown":
      return { focusPath: visibleNodes[Math.min(index + 1, visibleNodes.length - 1)].node.relative_path };
    case "ArrowUp":
      return { focusPath: visibleNodes[Math.max(index - 1, 0)].node.relative_path };
    case "Home":
      return { focusPath: visibleNodes[0].node.relative_path };
    case "End":
      return { focusPath: visibleNodes[visibleNodes.length - 1].node.relative_path };
    case "ArrowRight":
      if (node.node_type !== "Folder") return {};
      return expandedPaths.has(currentPath)
        ? { focusPath: node.children[0]?.relative_path }
        : { togglePath: currentPath };
    case "ArrowLeft":
      return node.node_type === "Folder" && expandedPaths.has(currentPath)
        ? { togglePath: currentPath }
        : { focusPath: parentPath ?? undefined };
    default:
      return null;
  }
}
