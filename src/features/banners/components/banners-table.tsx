import {
  ArrowDownIcon,
  ArrowUpIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatDateTime } from "@/lib/dates";
import { imageProps } from "@/lib/images";
import { m } from "@/messages";

import type { Banner } from "../api";
import { LinkText } from "./link-text";

type Props = {
  rows: readonly Banner[];
  loading: boolean;
  /** Disables the controls while a change is being saved. */
  busy: boolean;
  onEdit: (banner: Banner) => void;
  onDelete: (banner: Banner) => void;
  onToggle: (banner: Banner) => void;
  onMove: (banner: Banner, direction: -1 | 1) => void;
};

function StateBadge({ state }: { state: Banner["state"] }) {
  const label = m.banners.state[state];
  return state === "active" ? (
    <Badge>{label}</Badge>
  ) : (
    <Badge variant={state === "scheduled" ? "outline" : "secondary"}>
      {label}
    </Badge>
  );
}

function DateRange({ banner }: { banner: Banner }) {
  const t = m.banners.dates;
  if (!banner.starts_at && !banner.ends_at)
    return <span className="text-ink-muted">{t.none}</span>;
  return (
    <div className="flex flex-col text-xs tabular-nums">
      {banner.starts_at ? (
        <span>
          {t.from} {formatDateTime(banner.starts_at)}
        </span>
      ) : null}
      {banner.ends_at ? (
        <span>
          {t.until} {formatDateTime(banner.ends_at)}
        </span>
      ) : null}
    </div>
  );
}

/** The banner list in display order; there is no sort or paging (the backend list is flat). */
export function BannersTable({
  rows,
  loading,
  busy,
  onEdit,
  onDelete,
  onToggle,
  onMove,
}: Props) {
  const t = m.banners;
  const columns: Column<Banner>[] = [
    {
      key: "image",
      mobile: "media",
      header: t.columns.image,
      className: "w-28",
      cell: (banner) =>
        banner.image ? (
          <img
            {...imageProps(banner.image, "96px")}
            alt=""
            loading="lazy"
            className="h-12 w-24 rounded-md border border-line object-cover"
          />
        ) : (
          <div className="h-12 w-24 rounded-md border border-dashed border-line" />
        ),
    },
    {
      key: "title",
      mobile: "title",
      header: t.columns.title,
      className: "min-w-44 whitespace-normal",
      cell: (banner) => (
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => onEdit(banner)}
            className="text-start font-medium hover:text-brand"
          >
            {banner.title}
          </button>
          {banner.subtitle ? (
            <span className="text-xs text-ink-muted">{banner.subtitle}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "link",
      header: t.columns.link,
      cell: (banner) => <LinkText link={banner.link} />,
    },
    {
      key: "status",
      header: t.columns.status,
      cell: (banner) => <StateBadge state={banner.state} />,
    },
    {
      key: "dates",
      header: t.columns.dates,
      cell: (banner) => <DateRange banner={banner} />,
    },
    {
      key: "active",
      header: t.columns.active,
      className: "w-20",
      cell: (banner) => (
        <Switch
          checked={banner.is_active}
          disabled={busy}
          aria-label={`${t.columns.active}: ${banner.title}`}
          onCheckedChange={() => onToggle(banner)}
        />
      ),
    },
    {
      key: "order",
      header: t.columns.order,
      className: "w-24",
      cell: (banner) => {
        const index = rows.indexOf(banner);
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={busy || index === 0}
              aria-label={`${t.actions.moveUp}: ${banner.title}`}
              onClick={() => onMove(banner, -1)}
            >
              <ArrowUpIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={busy || index === rows.length - 1}
              aria-label={`${t.actions.moveDown}: ${banner.title}`}
              onClick={() => onMove(banner, 1)}
            >
              <ArrowDownIcon />
            </Button>
          </div>
        );
      },
    },
    {
      key: "actions",
      mobile: "actions",
      header: t.columns.actions,
      className: "w-28",
      cell: (banner) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${t.actions.edit}: ${banner.title}`}
            onClick={() => onEdit(banner)}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${t.actions.delete}: ${banner.title}`}
            onClick={() => onDelete(banner)}
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
      rowKey={(banner) => banner.id}
      loading={loading}
      emptyTitle={t.empty}
      emptyMessage={t.emptyHint}
    />
  );
}
