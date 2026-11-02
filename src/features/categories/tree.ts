import type { CategoryNode } from "./api";

export type CategoryRow = {
  node: CategoryNode;
  depth: 0 | 1;
  parentName: string | null;
  /** Inactive itself, or inside an inactive parent (neither is shown in the store). */
  hidden: boolean;
};

/** The backend's two-level tree as an always-expanded flat list: each parent, then its children. */
export function flattenTree(nodes: readonly CategoryNode[]): CategoryRow[] {
  return nodes.flatMap((root) => [
    {
      node: root,
      depth: 0 as const,
      parentName: null,
      hidden: !root.is_active,
    },
    ...(root.children ?? []).map((child) => ({
      node: child,
      depth: 1 as const,
      parentName: root.name,
      hidden: !root.is_active || !child.is_active,
    })),
  ]);
}

export type ParentOption = { id: number; name: string; inactive: boolean };

/**
 * Categories a category may be moved under. The backend allows two levels only
 * (`CATEGORY_DEPTH_EXCEEDED`): the parent must be top-level and not the category itself, and a
 * category that has children cannot become a child. That makes cycles impossible, and this
 * list is what keeps the UI from offering what the backend would reject.
 */
export function parentOptions(
  nodes: readonly CategoryNode[],
  editingId: number | null,
): ParentOption[] {
  return nodes
    .filter((node) => node.id !== editingId)
    .map((node) => ({
      id: node.id,
      name: node.name,
      inactive: !node.is_active,
    }));
}

export function findNode(
  nodes: readonly CategoryNode[],
  id: number,
): CategoryNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findNode(node.children ?? [], id);
    if (child) return child;
  }
  return undefined;
}

/** Whether the category can be placed under another one (it has no children of its own). */
export function canHaveParent(
  node: Pick<CategoryNode, "children"> | undefined,
): boolean {
  return (node?.children?.length ?? 0) === 0;
}
