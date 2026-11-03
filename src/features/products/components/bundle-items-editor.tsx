import { useQueries, useQuery } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { get, useFieldArray, useFormContext } from "react-hook-form";

import { SearchPicker } from "@/components/shared/search-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounced } from "@/hooks/use-debounced";
import { imageProps } from "@/lib/images";
import { formatMoney } from "@/lib/money";
import { m } from "@/messages";

import { DEFAULT_PARAMS } from "../list-filters";
import { productKeys, useProducts } from "../api";
import {
  bundleSaving,
  bundleTotal,
  componentUnitPrice,
  effectiveBundlePrice,
  hasBundleItem,
  parseQuantity,
  variantLabel,
  type PricedLine,
} from "../bundle";
import { fetchProduct } from "../requests";
import type { ProductFormValues } from "../schema";

type Props = {
  /** The bundle itself when editing (never offered as its own component). */
  productId?: number;
  currency: string;
  /** Derived stock from the detail response; shown read-only. */
  bundleStock?: number | null;
};

const DETAIL_STALE_MS = 60_000;

function useComponent(id: number | null) {
  return useQuery({
    queryKey: productKeys.detail(id ?? 0),
    queryFn: () => fetchProduct(id as number),
    enabled: id !== null,
    staleTime: DETAIL_STALE_MS,
  });
}

/** The "محتويات العلبة" section: the components of a bundle, saved with the product form. */
export function BundleItemsEditor({ productId, currency, bundleStock }: Props) {
  const t = m.products.bundle;
  const {
    control,
    register,
    watch,
    formState: { errors },
  } = useFormContext<ProductFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "bundle_items",
  });
  const items = watch("bundle_items");
  const price = watch("price");
  const salePrice = watch("sale_price");
  const [notice, setNotice] = useState<string | null>(null);

  // Thumbnails, prices and status of the components come from their own detail responses.
  const ids = useMemo(
    () => [...new Set(items.map((item) => item.product_id))],
    [items],
  );
  const details = useQueries({
    queries: ids.map((id) => ({
      queryKey: productKeys.detail(id),
      queryFn: () => fetchProduct(id),
      staleTime: DETAIL_STALE_MS,
    })),
  });
  const detailById = new Map(
    ids.map((id, index) => [id, details[index]] as const),
  );
  const rootError = (errors.bundle_items as { message?: string } | undefined)
    ?.message;

  const add = (item: {
    product_id: number;
    variant_id: number | null;
    name: string;
    variant_label: string | null;
  }) => {
    if (hasBundleItem(items, item)) {
      setNotice(t.alreadyAdded);
      return;
    }
    setNotice(null);
    append({ ...item, quantity: "1" });
  };

  const lines: PricedLine[] = items.map((item) => {
    const detail = detailById.get(item.product_id)?.data;
    return {
      unitPrice: detail ? componentUnitPrice(detail, item.variant_id) : null,
      currency: detail?.currency ?? null,
      quantity: parseQuantity(item.quantity) ?? 0,
    };
  });
  const total = bundleTotal(lines, currency);
  const bundlePrice = effectiveBundlePrice(price, salePrice);
  const saving = bundlePrice ? bundleSaving(total.amount, bundlePrice) : null;

  return (
    <div className="flex flex-col gap-4">
      {fields.length === 0 ? (
        <p className="text-sm text-ink-muted">{t.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {fields.map((row, index) => {
            const item = items[index];
            if (!item) return null;
            const query = detailById.get(item.product_id);
            const detail = query?.data;
            const rowError: string | undefined =
              get(errors, `bundle_items.${index}.message`) ??
              get(errors, `bundle_items.${index}.quantity.message`);
            const mismatch = !!detail && detail.currency !== currency;
            const image = detail?.images[0]?.urls;
            return (
              <li
                key={row.id}
                className="flex flex-col gap-2 rounded-lg border border-line p-3"
              >
                <div className="flex flex-wrap items-center gap-3">
                  {query?.isPending ? (
                    <Skeleton className="size-12 shrink-0" />
                  ) : image ? (
                    <img
                      {...imageProps(image, "48px")}
                      alt=""
                      loading="lazy"
                      className="size-12 shrink-0 rounded-md border border-line object-cover"
                    />
                  ) : (
                    <div className="size-12 shrink-0 rounded-md border border-dashed border-line" />
                  )}
                  <div className="flex min-w-40 flex-1 flex-col">
                    <span className="font-medium">{item.name}</span>
                    {item.variant_label ? (
                      <span className="text-xs text-ink-muted">
                        {item.variant_label}
                      </span>
                    ) : null}
                    {detail ? (
                      <span className="text-xs text-ink-muted">
                        {formatMoney(
                          componentUnitPrice(detail, item.variant_id) ?? "",
                          detail.currency,
                        )}
                      </span>
                    ) : null}
                  </div>
                  {detail && !detail.is_active ? (
                    <Badge variant="secondary">{t.inactive}</Badge>
                  ) : null}
                  <Input
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={3}
                    className="w-20"
                    aria-label={`${t.quantity}: ${item.name}`}
                    aria-invalid={rowError ? true : undefined}
                    {...register(`bundle_items.${index}.quantity`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${t.remove}: ${item.name}`}
                    onClick={() => remove(index)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
                {mismatch ? (
                  <p role="alert" className="text-xs text-danger">
                    {t.currencyWarning}
                  </p>
                ) : null}
                {rowError ? (
                  <p role="alert" className="text-xs text-danger">
                    {rowError}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {rootError ? (
        <p role="alert" className="text-xs text-danger">
          {rootError}
        </p>
      ) : null}

      <ComponentPicker
        productId={productId}
        currency={currency}
        onAdd={add}
        notice={notice}
        onNotice={setNotice}
      />

      {items.length > 0 ? (
        <dl className="flex flex-col gap-1 rounded-lg bg-surface-2 p-3 text-sm">
          <div className="flex justify-between gap-2">
            <dt>{t.total}</dt>
            <dd className="tabular-nums" data-testid="bundle-total">
              {formatMoney(total.amount, currency)}
            </dd>
          </div>
          {bundlePrice ? (
            <div className="flex justify-between gap-2">
              <dt>{t.price}</dt>
              <dd className="tabular-nums">
                {formatMoney(bundlePrice, currency)}
              </dd>
            </div>
          ) : null}
          {saving !== null ? (
            <div
              className="flex justify-between gap-2 font-medium"
              data-testid="bundle-saving"
            >
              {saving.startsWith("-") ? (
                <>
                  <dt>{t.markup}</dt>
                  <dd className="tabular-nums">
                    {formatMoney(saving.slice(1), currency)}
                  </dd>
                </>
              ) : saving === "0.00" ? (
                <dt>{t.sameAsTotal}</dt>
              ) : (
                <>
                  <dt>{t.saving}</dt>
                  <dd className="tabular-nums">
                    {formatMoney(saving, currency)}
                  </dd>
                </>
              )}
            </div>
          ) : null}
          {total.skipped > 0 ? (
            <p className="text-xs text-ink-muted">{t.partialTotal}</p>
          ) : null}
        </dl>
      ) : null}
      {typeof bundleStock === "number" ? (
        <p className="text-sm text-ink-muted">
          {t.stock}: <span className="tabular-nums">{bundleStock}</span> (
          {t.stockHint})
        </p>
      ) : null}
    </div>
  );
}

type PickerProps = {
  productId?: number;
  currency: string;
  onAdd: (item: {
    product_id: number;
    variant_id: number | null;
    name: string;
    variant_label: string | null;
  }) => void;
  notice: string | null;
  onNotice: (notice: string | null) => void;
};

type Pending = { id: number; name: string };

/** Async product search (the banner link picker's SearchPicker + useProducts), then a variant choice. */
function ComponentPicker({
  productId,
  currency,
  onAdd,
  notice,
  onNotice,
}: PickerProps) {
  const t = m.products.bundle;
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const q = useDebounced(query.trim());
  const products = useProducts({ ...DEFAULT_PARAMS, q });
  const byId = useMemo(
    () => new Map((products.data?.items ?? []).map((item) => [item.id, item])),
    [products.data],
  );
  const options = useMemo(
    () =>
      (products.data?.items ?? [])
        .filter(
          (item) =>
            item.type !== "bundle" &&
            item.currency === currency &&
            item.id !== productId,
        )
        .map((item) => ({
          value: String(item.id),
          label: item.name,
          hint: item.slug,
        })),
    [products.data, currency, productId],
  );

  return (
    <div className="flex flex-col gap-2">
      <SearchPicker
        id="bundle-product"
        selected={
          pending ? { value: String(pending.id), label: pending.name } : null
        }
        options={options}
        query={query}
        onQueryChange={(value) => {
          onNotice(null);
          setQuery(value);
        }}
        onSelect={(option) => {
          const item = byId.get(Number(option.value));
          if (!item) return;
          onNotice(null);
          if (item.type === "variable")
            setPending({ id: item.id, name: item.name });
          else
            onAdd({
              product_id: item.id,
              variant_id: null,
              name: item.name,
              variant_label: null,
            });
        }}
        onClear={() => setPending(null)}
        placeholder={t.search}
        loading={products.isFetching}
      />
      <p className="text-xs text-ink-muted">{t.searchHint}</p>
      {pending ? (
        <VariantChooser
          pending={pending}
          onCancel={() => setPending(null)}
          onChoose={(variantId, label) => {
            onAdd({
              product_id: pending.id,
              variant_id: variantId,
              name: pending.name,
              variant_label: label,
            });
            setPending(null);
          }}
        />
      ) : null}
      {notice ? (
        <p role="alert" className="text-xs text-danger">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

function VariantChooser({
  pending,
  onChoose,
  onCancel,
}: {
  pending: Pending;
  onChoose: (variantId: number, label: string) => void;
  onCancel: () => void;
}) {
  const t = m.products.bundle;
  const detail = useComponent(pending.id);
  const [variantId, setVariantId] = useState("");
  if (detail.isPending)
    return <p className="text-sm text-ink-muted">{t.loadingProduct}</p>;
  const variants = detail.data?.variants ?? [];
  const chosen = variants.find((v) => String(v.id) === variantId);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={variantId} onValueChange={setVariantId}>
        <SelectTrigger aria-label={t.chooseVariant} className="w-full sm:w-64">
          <SelectValue placeholder={t.variantPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {variants.map((variant) => (
            <SelectItem key={variant.id} value={String(variant.id)}>
              {variantLabel(variant.options) || variant.sku}
              {variant.is_active ? "" : ` (${t.inactive})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        disabled={!chosen}
        onClick={() =>
          chosen &&
          onChoose(chosen.id, variantLabel(chosen.options) || chosen.sku)
        }
      >
        <PlusIcon data-icon="inline-start" />
        {t.add}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        {t.cancel}
      </Button>
    </div>
  );
}
