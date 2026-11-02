import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { m } from "@/messages";

import { useDeliveryMethods } from "../api";
import { SORTS, hasActiveFilters, type ListParams } from "../list-filters";
import { STATUSES, statusLabel } from "../status";
import type { OrderSort, OrderStatus } from "../types";

const ALL = "all";
const SEARCH_DEBOUNCE_MS = 400;

type Props = {
  params: ListParams;
  onChange: (change: Partial<ListParams>) => void;
  onClear: () => void;
};

type FilterSelectProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  allLabel?: string;
};

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
  allLabel,
}: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label={label} className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allLabel ? <SelectItem value={ALL}>{allLabel}</SelectItem> : null}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Search, status, delivery method, date range and sort. All of it lives in the URL via `onChange`. */
export function OrderFilters({ params, onChange, onClear }: Props) {
  const t = m.orders.filters;
  const methods = useDeliveryMethods();
  const [text, setText] = useState(params.q);

  // Back/forward or "clear" changed the URL: follow it (derived during render).
  const [seenQ, setSeenQ] = useState(params.q);
  if (params.q !== seenQ) {
    setSeenQ(params.q);
    setText(params.q);
  }
  useEffect(() => {
    if (text.trim() === params.q.trim()) return;
    const timer = setTimeout(
      () => onChange({ q: text.trim() }),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [text, params.q, onChange]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t.search}
          aria-label={t.search}
          maxLength={100}
          className="w-72"
        />
        <FilterSelect
          label={t.status}
          value={params.status}
          onValueChange={(value) =>
            onChange({ status: value as OrderStatus | "all" })
          }
          allLabel={`${t.status}: ${t.all}`}
          options={STATUSES.map((status) => ({
            value: status,
            label: statusLabel(status),
          }))}
        />
        <FilterSelect
          label={t.delivery}
          value={params.delivery}
          onValueChange={(value) => onChange({ delivery: value })}
          allLabel={`${t.delivery}: ${t.all}`}
          options={(methods.data ?? []).map((method) => ({
            value: method.code,
            label: method.name,
          }))}
        />
        <Input
          type="date"
          dir="ltr"
          aria-label={t.dateFrom}
          title={t.dateFrom}
          value={params.from}
          max={params.to || undefined}
          onChange={(event) => onChange({ from: event.target.value })}
          className="w-40"
        />
        <Input
          type="date"
          dir="ltr"
          aria-label={t.dateTo}
          title={t.dateTo}
          value={params.to}
          min={params.from || undefined}
          onChange={(event) => onChange({ to: event.target.value })}
          className="w-40"
        />
        <FilterSelect
          label={t.sort}
          value={params.sort}
          onValueChange={(value) => onChange({ sort: value as OrderSort })}
          options={SORTS.map((sort) => ({
            value: sort,
            label: m.orders.sort[sort],
          }))}
        />
        {hasActiveFilters(params) ? (
          <Button variant="ghost" size="sm" onClick={onClear}>
            {t.clear}
          </Button>
        ) : null}
      </div>
      {params.from || params.to ? (
        <p className="text-xs text-ink-muted">{t.dateHint}</p>
      ) : null}
    </div>
  );
}
