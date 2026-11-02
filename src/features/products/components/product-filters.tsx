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
import { flattenCategories, useCategoryTree } from "@/features/categories";
import { useBrands } from "@/features/brands";
import { m } from "@/messages";

import {
  SORTS,
  hasActiveFilters,
  type ListParams,
  type ProductSort,
  type StatusFilter,
  type TypeFilter,
} from "../list-filters";

const ALL = "all";
const SEARCH_DEBOUNCE_MS = 400;

type Props = {
  params: ListParams;
  /** Merge a change into the URL state (the page resets to 1). */
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
      <SelectTrigger aria-label={label} className="w-full sm:w-44">
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

/** Search, category, brand, status, type and sort. All of it lives in the URL via `onChange`. */
export function ProductFilters({ params, onChange, onClear }: Props) {
  const t = m.products.filters;
  const categories = useCategoryTree();
  const brands = useBrands();
  const [text, setText] = useState(params.q);

  // Back/forward or "clear" changed the URL: follow it (derived during render, no effect).
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
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={t.search}
        aria-label={t.search}
        maxLength={200}
        className="w-full sm:w-60"
      />
      <FilterSelect
        label={t.category}
        value={params.category === null ? ALL : String(params.category)}
        onValueChange={(value) =>
          onChange({ category: value === ALL ? null : Number(value) })
        }
        allLabel={`${t.category}: ${t.all}`}
        options={flattenCategories(categories.data ?? []).map((option) => ({
          value: String(option.id),
          label: option.label,
        }))}
      />
      <FilterSelect
        label={t.brand}
        value={params.brand === null ? ALL : String(params.brand)}
        onValueChange={(value) =>
          onChange({ brand: value === ALL ? null : Number(value) })
        }
        allLabel={`${t.brand}: ${t.all}`}
        options={(brands.data ?? []).map((brand) => ({
          value: String(brand.id),
          label: brand.name,
        }))}
      />
      <FilterSelect
        label={t.status}
        value={params.status}
        onValueChange={(value) => onChange({ status: value as StatusFilter })}
        allLabel={`${t.status}: ${t.all}`}
        options={[
          { value: "active", label: m.products.status.active },
          { value: "inactive", label: m.products.status.inactive },
        ]}
      />
      <FilterSelect
        label={t.type}
        value={params.type}
        onValueChange={(value) => onChange({ type: value as TypeFilter })}
        allLabel={`${t.type}: ${t.all}`}
        options={(["simple", "variable", "bundle"] as const).map((type) => ({
          value: type,
          label: m.products.types[type],
        }))}
      />
      <FilterSelect
        label={t.sort}
        value={params.sort}
        onValueChange={(value) => onChange({ sort: value as ProductSort })}
        options={SORTS.map((sort) => ({
          value: sort,
          label: m.products.sort[sort],
        }))}
      />
      {hasActiveFilters(params) ? (
        <Button variant="ghost" size="sm" onClick={onClear}>
          {t.clear}
        </Button>
      ) : null}
    </div>
  );
}
