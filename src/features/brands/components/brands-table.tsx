import { PencilIcon, Trash2Icon } from "lucide-react";

import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { imageProps } from "@/lib/images";
import { m } from "@/messages";

import type { Brand } from "../api";

type Props = {
  rows: readonly Brand[];
  loading: boolean;
  emptyMessage: string;
  onEdit: (brand: Brand) => void;
  onDelete: (brand: Brand) => void;
};

export function BrandsTable({
  rows,
  loading,
  emptyMessage,
  onEdit,
  onDelete,
}: Props) {
  const t = m.brands;
  const columns: Column<Brand>[] = [
    {
      key: "logo",
      header: t.columns.logo,
      className: "w-16",
      cell: (brand) =>
        brand.logo ? (
          <img
            {...imageProps(brand.logo, "48px")}
            alt=""
            loading="lazy"
            className="size-12 rounded-md border border-line object-contain"
          />
        ) : (
          <div className="size-12 rounded-md border border-dashed border-line" />
        ),
    },
    {
      key: "name",
      header: t.columns.name,
      cell: (brand) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(brand)}
            className="font-medium hover:text-brand"
          >
            {brand.name}
          </button>
          {brand.is_own_brand ? (
            <Badge variant="outline">{t.ownBrand}</Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: "slug",
      header: t.columns.slug,
      cell: (brand) => (
        <bdi dir="ltr" className="text-sm text-ink-muted">
          {brand.slug}
        </bdi>
      ),
    },
    {
      key: "status",
      header: t.columns.status,
      cell: (brand) =>
        brand.is_active ? (
          <Badge>{t.status.active}</Badge>
        ) : (
          <Badge variant="secondary">{t.status.inactive}</Badge>
        ),
    },
    {
      key: "products",
      header: t.columns.products,
      cell: (brand) => (
        <span className="tabular-nums">{brand.product_count}</span>
      ),
    },
    {
      key: "actions",
      header: t.columns.actions,
      className: "w-28",
      cell: (brand) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${t.actions.edit}: ${brand.name}`}
            onClick={() => onEdit(brand)}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${t.actions.delete}: ${brand.name}`}
            onClick={() => onDelete(brand)}
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
      rowKey={(brand) => brand.id}
      loading={loading}
      emptyTitle={t.empty}
      emptyMessage={emptyMessage}
    />
  );
}
