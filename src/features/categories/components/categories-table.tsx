import { PencilIcon, Trash2Icon } from "lucide-react";
import { Link } from "react-router";

import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { imageProps } from "@/lib/images";
import { cn } from "@/lib/utils";
import { m } from "@/messages";

import type { CategoryNode } from "../api";
import { flattenTree, type CategoryRow } from "../tree";

type Props = {
  nodes: readonly CategoryNode[];
  loading: boolean;
  onDelete: (category: CategoryNode) => void;
};

/**
 * The two-level category tree as an always-expanded list: each top-level category, then its
 * children indented under it. A parent's product count includes its children's.
 */
export function CategoriesTable({ nodes, loading, onDelete }: Props) {
  const t = m.categories;
  const rows = flattenTree(nodes);
  const columns: Column<CategoryRow>[] = [
    {
      key: "name",
      header: t.columns.name,
      cell: ({ node, depth }) => (
        <div className={cn("flex items-center gap-3", depth === 1 && "ps-8")}>
          {node.image ? (
            <img
              {...imageProps(node.image, "40px")}
              alt=""
              loading="lazy"
              className="size-10 rounded-md border border-line object-cover"
            />
          ) : (
            <div className="size-10 rounded-md border border-dashed border-line" />
          )}
          <Link
            to={`/categories/${node.id}/edit`}
            className={cn(
              "hover:text-brand",
              depth === 0 ? "font-semibold" : "font-medium",
            )}
          >
            {node.name}
          </Link>
        </div>
      ),
    },
    {
      key: "slug",
      header: t.columns.slug,
      cell: ({ node }) => (
        <bdi dir="ltr" className="text-sm text-ink-muted">
          {node.slug}
        </bdi>
      ),
    },
    {
      key: "parent",
      header: t.columns.parent,
      cell: ({ parentName }) => parentName ?? t.noParent,
    },
    {
      key: "status",
      header: t.columns.status,
      cell: ({ node }) =>
        node.is_active ? (
          <Badge>{t.status.active}</Badge>
        ) : (
          <Badge variant="secondary">{t.status.inactive}</Badge>
        ),
    },
    {
      key: "products",
      header: t.columns.products,
      cell: ({ node }) => (
        <span className="tabular-nums">{node.product_count}</span>
      ),
    },
    {
      key: "actions",
      header: t.columns.actions,
      className: "w-28",
      cell: ({ node }) => (
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon">
            <Link
              to={`/categories/${node.id}/edit`}
              aria-label={`${t.actions.edit}: ${node.name}`}
            >
              <PencilIcon />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${t.actions.delete}: ${node.name}`}
            onClick={() => onDelete(node)}
          >
            <Trash2Icon className="text-danger" />
          </Button>
        </div>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={({ node }) => node.id}
      loading={loading}
      emptyTitle={t.empty}
      emptyMessage={t.emptyHint}
    />
  );
}
