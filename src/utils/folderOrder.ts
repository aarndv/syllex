import type { VaultNode } from "../types/vault";

export function sortSiblingFolders(folders: VaultNode[], savedOrder: string[] = []): VaultNode[] {
  const positions = new Map(savedOrder.map((path, index) => [path, index]));
  return [...folders].sort((a, b) =>
    (positions.get(a.relative_path.replace(/\\/g, "/")) ?? Infinity) -
    (positions.get(b.relative_path.replace(/\\/g, "/")) ?? Infinity));
}

export function moveSiblingFolder(paths: string[], source: string, target: string, position: "before" | "after"): string[] {
  if (source === target || !paths.includes(source) || !paths.includes(target)) return paths;
  const next = paths.filter((path) => path !== source);
  next.splice(next.indexOf(target) + (position === "after" ? 1 : 0), 0, source);
  return next;
}
