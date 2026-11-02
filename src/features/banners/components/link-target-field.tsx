import { useMemo, useState } from "react";

import { FormField } from "@/components/shared/form-field";
import {
  SearchPicker,
  type PickerOption,
} from "@/components/shared/search-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBrands } from "@/features/brands";
import { flattenTree, useCategoryTree } from "@/features/categories";
import { DEFAULT_PARAMS, useProducts } from "@/features/products";
import { useDebounced } from "@/hooks/use-debounced";
import { m } from "@/messages";

import { useLinkTarget } from "../api";
import {
  LINK_TYPES,
  URL_MAX,
  changeLinkType,
  isLinkType,
  takesValue,
  type LinkValue,
} from "../link";

type Props = {
  /** Prefix for element ids, so two fields can live on one page. */
  id: string;
  value: LinkValue;
  onChange: (value: LinkValue) => void;
  error?: string;
};

/**
 * Link target of a banner or campaign: a type select (none, product, category, brand, new,
 * sale, external URL) and, for the types that take one, a value control: a searchable picker
 * that resolves to the slug, or a plain https URL input.
 */
export function LinkTargetField({ id, value, onChange, error }: Props) {
  const t = m.link;
  return (
    <div className="flex flex-col gap-3">
      <FormField id={`${id}-type`} label={t.typeLabel}>
        <Select
          value={value.type}
          onValueChange={(type) =>
            isLinkType(type) && onChange(changeLinkType(value, type))
          }
        >
          <SelectTrigger id={`${id}-type`} aria-label={t.typeLabel}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LINK_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t.types[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      {takesValue(value.type) ? (
        <ValueControl id={id} value={value} onChange={onChange} />
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type PickerProps = Pick<Props, "id" | "value" | "onChange">;

function ValueControl({ id, value, onChange }: PickerProps) {
  const t = m.link;
  if (value.type === "url")
    return (
      <FormField id={`${id}-url`} label={t.valueLabel.url}>
        <Input
          id={`${id}-url`}
          dir="ltr"
          inputMode="url"
          maxLength={URL_MAX + 100}
          placeholder="https://"
          value={value.value}
          onChange={(event) =>
            onChange({ type: "url", value: event.target.value, label: "" })
          }
        />
      </FormField>
    );
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">
        {t.valueLabel[value.type as "product" | "category" | "brand"]}
      </span>
      {value.type === "product" ? (
        <ProductPicker id={id} value={value} onChange={onChange} />
      ) : value.type === "category" ? (
        <CategoryPicker id={id} value={value} onChange={onChange} />
      ) : (
        <BrandPicker id={id} value={value} onChange={onChange} />
      )}
    </div>
  );
}

/**
 * A saved link comes back with only its slug; the name of its target is looked up so that the
 * chip shows "كريم الورد" and not "rose-cream". A label chosen in the picker is kept as is.
 */
function useResolvedLabel(value: LinkValue): LinkValue {
  const info = useLinkTarget(value);
  return value.label && value.label !== value.value
    ? value
    : { ...value, label: info.name ?? value.value };
}

function selectedOf(value: LinkValue): PickerOption | null {
  return value.value
    ? {
        value: value.value,
        label: value.label || value.value,
        hint: value.value,
      }
    : null;
}

function ProductPicker({ id, value, onChange }: PickerProps) {
  const shown = useResolvedLabel(value);
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim());
  const products = useProducts({ ...DEFAULT_PARAMS, q });
  const options = useMemo(
    () =>
      (products.data?.items ?? []).map((p) => ({
        value: p.slug,
        label: p.name,
        hint: p.slug,
      })),
    [products.data],
  );
  return (
    <SearchPicker
      id={`${id}-product`}
      selected={selectedOf(shown)}
      options={options}
      query={query}
      onQueryChange={setQuery}
      onSelect={(o) =>
        onChange({ type: "product", value: o.value, label: o.label })
      }
      onClear={() => onChange({ type: "product", value: "", label: "" })}
      placeholder={m.link.searchProduct}
      loading={products.isFetching}
    />
  );
}

function CategoryPicker({ id, value, onChange }: PickerProps) {
  const shown = useResolvedLabel(value);
  const [query, setQuery] = useState("");
  const tree = useCategoryTree();
  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return flattenTree(tree.data ?? [])
      .filter(
        (row) =>
          !needle ||
          row.node.name.toLowerCase().includes(needle) ||
          row.node.slug.includes(needle),
      )
      .map((row) => ({
        value: row.node.slug,
        label: `${row.parentName ? `${row.parentName} ‹ ` : ""}${row.node.name}${row.hidden ? ` (${m.link.inactiveHint})` : ""}`,
        hint: row.node.slug,
      }));
  }, [tree.data, query]);
  return (
    <SearchPicker
      id={`${id}-category`}
      selected={selectedOf(shown)}
      options={options}
      query={query}
      onQueryChange={setQuery}
      onSelect={(o) =>
        onChange({ type: "category", value: o.value, label: o.label })
      }
      onClear={() => onChange({ type: "category", value: "", label: "" })}
      placeholder={m.link.searchCategory}
      loading={tree.isPending}
    />
  );
}

function BrandPicker({ id, value, onChange }: PickerProps) {
  const shown = useResolvedLabel(value);
  const [query, setQuery] = useState("");
  const brands = useBrands();
  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (brands.data ?? [])
      .filter(
        (b) =>
          !needle ||
          b.name.toLowerCase().includes(needle) ||
          b.slug.includes(needle),
      )
      .map((b) => ({
        value: b.slug,
        label: `${b.name}${b.is_active ? "" : ` (${m.link.inactiveHint})`}`,
        hint: b.slug,
      }));
  }, [brands.data, query]);
  return (
    <SearchPicker
      id={`${id}-brand`}
      selected={selectedOf(shown)}
      options={options}
      query={query}
      onQueryChange={setQuery}
      onSelect={(o) =>
        onChange({ type: "brand", value: o.value, label: o.label })
      }
      onClear={() => onChange({ type: "brand", value: "", label: "" })}
      placeholder={m.link.searchBrand}
      loading={brands.isPending}
    />
  );
}
