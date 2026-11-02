import { PackagePlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Link } from "react-router";

import { DataTable, type Column } from "@/components/shared/data-table";
import { Money } from "@/components/shared/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { imageProps } from "@/lib/images";
import { m } from "@/messages";

import { listPrice, stockCell } from "../price";
import type { ProductListItem } from "../types";

type Props = {
  rows: readonly ProductListItem[];
  loading: boolean;
  emptyMessage: string;
  onDelete: (product: ProductListItem) => void;
  onAdjustStock: (product: ProductListItem) => void;
};

/** The products list table. Everything shown comes straight from the admin list endpoint. */
export function ProductsTable({
  rows,
  loading,
  emptyMessage,
  onDelete,
  onAdjustStock,
}: Props) {
  const t = m.products;
  const columns: Column<ProductListItem>[] = [
    {
      key: "image",
      mobile: "media",
      header: t.columns.image,
      className: "w-16",
      cell: (item) =>
        item.image ? (
          <img
            {...imageProps(item.image, "48px")}
            alt=""
            loading="lazy"
            className="size-12 rounded-md border border-line object-cover"
          />
        ) : (
          <div className="size-12 rounded-md border border-dashed border-line" />
        ),
    },
    {
      key: "name",
      mobile: "title",
      header: t.columns.name,
      className: "min-w-44 whitespace-normal",
      cell: (item) => (
        <div className="flex flex-col">
          <Link
            to={`/products/${item.id}/edit`}
            className="font-medium hover:text-brand"
          >
            {item.name}
          </Link>
          <span className="text-xs text-ink-muted">
            {t.types[item.type]}
            {item.sku ? (
              <>
                {" · "}
                <bdi dir="ltr">{item.sku}</bdi>
              </>
            ) : null}
          </span>
        </div>
      ),
    },
    {
      key: "category",
      header: t.columns.category,
      cell: (item) => item.category.name,
    },
    {
      key: "brand",
      header: t.columns.brand,
      cell: (item) => item.brand?.name ?? t.noBrand,
    },
    {
      key: "price",
      header: t.columns.price,
      cell: (item) => {
        const { from, money } = listPrice(item);
        return (
          <span className="inline-flex flex-wrap items-baseline gap-1">
            {from ? (
              <span className="text-xs text-ink-muted">{t.from}</span>
            ) : null}
            <Money {...money} />
          </span>
        );
      },
    },
    {
      key: "stock",
      header: t.columns.stock,
      cell: (item) => {
        const { value, multiple } = stockCell(item);
        if (value === null) return t.noBrand;
        return (
          <span className="inline-flex items-baseline gap-1 tabular-nums">
            {value}
            {multiple ? (
              <span className="text-xs text-ink-muted">
                ({t.stockMultiple})
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: "status",
      header: t.columns.status,
      cell: (item) =>
        item.is_active ? (
          <Badge>{t.status.active}</Badge>
        ) : (
          <Badge variant="secondary">{t.status.inactive}</Badge>
        ),
    },
    {
      key: "actions",
      mobile: "actions",
      header: t.columns.actions,
      className: "w-36",
      cell: (item) => (
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon">
            <Link
              to={`/products/${item.id}/edit`}
              aria-label={`${t.actions.edit}: ${item.name}`}
            >
              <PencilIcon />
            </Link>
          </Button>
          {item.type === "simple" ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${t.actions.adjustStock}: ${item.name}`}
              onClick={() => onAdjustStock(item)}
            >
              <PackagePlusIcon />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${t.actions.delete}: ${item.name}`}
            onClick={() => onDelete(item)}
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
      rowKey={(item) => item.id}
      loading={loading}
      emptyTitle={t.empty}
      emptyMessage={emptyMessage}
    />
  );
}
