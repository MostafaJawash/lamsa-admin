import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Controller,
  FormProvider,
  useForm,
  type Resolver,
} from "react-hook-form";
import { useBlocker, useNavigate } from "react-router";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useBrands } from "@/features/brands";
import {
  flattenCategories,
  useCategoryDetail,
  useCategoryTree,
} from "@/features/categories";
import { m } from "@/messages";

import { useInvalidateProducts } from "../api";
import { applyApiError, publishReasons } from "../map-errors";
import { EMPTY_FORM, emptyVariant, productToFormValues } from "../payload";
import { PartialSaveError, saveExistingProduct, saveNewProduct } from "../save";
import { buildProductSchema, type ProductFormValues } from "../schema";
import { CURRENCIES, type AdminProduct } from "../types";
import { variantPriceRange } from "../price";
import { AttributeFields } from "./attribute-fields";
import { ProductImages } from "./product-images";
import { StagedImages } from "./staged-images";
import { StockAdjustDialog, type StockTarget } from "./stock-adjust-dialog";
import { VariantsEditor } from "./variants-editor";

const NO_BRAND = "__none";

type Props = { product?: AdminProduct };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Create (no `product`) and edit (`product`) share this form. The category decides which
 * attributes and variant options exist, so the zod schema is rebuilt from its definitions.
 */
export function ProductForm({ product }: Props) {
  const editing = product !== undefined;
  const t = m.products.form;
  const navigate = useNavigate();
  const invalidate = useInvalidateProducts();
  const categories = useCategoryTree();
  const brands = useBrands();

  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [stockTarget, setStockTarget] = useState<StockTarget | null>(null);
  const [stockOverrides, setStockOverrides] = useState<Record<string, number>>(
    {},
  );
  const allowLeave = useRef(false);

  const schemaRef = useRef(
    buildProductSchema({ mode: "create", attributes: [], options: [] }),
  );
  const resolver: Resolver<ProductFormValues> = (values, context, options) =>
    zodResolver(schemaRef.current)(values, context, options);

  const form = useForm<ProductFormValues>({
    defaultValues: product ? productToFormValues(product) : EMPTY_FORM,
    resolver,
  });
  const {
    control,
    register,
    watch,
    setValue,
    setError,
    handleSubmit,
    formState,
  } = form;

  const type = watch("type");
  const currency = watch("currency");
  const categoryValue = watch("category_id");
  const detail = useCategoryDetail(
    categoryValue ? Number(categoryValue) : null,
  );
  const attributeDefs = useMemo(
    () => detail.data?.effective_attributes ?? [],
    [detail.data],
  );
  const optionDefs = useMemo(
    () => detail.data?.effective_variant_options ?? [],
    [detail.data],
  );
  schemaRef.current = buildProductSchema({
    mode: editing ? "edit" : "create",
    attributes: attributeDefs,
    options: optionDefs,
  });

  // Definitions arrived or the category changed: drop attributes the category does not have
  // and give every variant row the option keys it needs.
  useEffect(() => {
    if (!detail.data) return;
    const allowed = new Set(attributeDefs.map((def) => def.key));
    const attributes = watch("attributes");
    const kept = Object.fromEntries(
      Object.entries(attributes).filter(([key]) => allowed.has(key)),
    );
    if (Object.keys(kept).length !== Object.keys(attributes).length)
      setValue("attributes", kept, { shouldDirty: true });
    const variants = watch("variants");
    const template = emptyVariant(optionDefs).options;
    const patched = variants.map((variant) => ({
      ...variant,
      options: { ...template, ...variant.options },
    }));
    if (
      patched.some(
        (variant, i) =>
          Object.keys(variant.options).length !==
          Object.keys(variants[i]?.options ?? {}).length,
      )
    )
      setValue("variants", patched);
    if (type === "variable" && variants.length === 0 && !editing)
      setValue("variants", [emptyVariant(optionDefs)]);
    // eslint-disable-next-line -- only when the definitions change
  }, [detail.data]);

  const dirty = formState.isDirty || files.length > 0;
  const blocker = useBlocker(() => dirty && !allowLeave.current && !saving);

  const goToList = () => {
    allowLeave.current = true;
    navigate("/products");
  };

  const onSubmit = handleSubmit(
    async (values) => {
      setSaving(true);
      const definitions = { attributes: attributeDefs, options: optionDefs };
      try {
        if (product) {
          await saveExistingProduct(product, values, definitions);
          toast.success(t.updated);
        } else {
          await saveNewProduct(values, definitions, files, (done, total) =>
            setProgress({ done, total }),
          );
          toast.success(t.created);
        }
        await invalidate();
        goToList();
      } catch (error) {
        void invalidate();
        if (error instanceof PartialSaveError) {
          const reasons = error.causes.flatMap(publishReasons);
          toast.error(
            [
              error.stage === "images" ? t.imagesFailed : t.publishFailed,
              ...reasons,
            ].join(" "),
          );
          allowLeave.current = true;
          navigate(`/products/${error.productId}/edit`);
          return;
        }
        const reasons = publishReasons(error);
        const unmapped = applyApiError(error, setError);
        for (const message of reasons.length ? reasons : unmapped)
          toast.error(message);
      } finally {
        setSaving(false);
        setProgress(null);
      }
    },
    () => toast.error(m.errors.byCode.VALIDATION_ERROR ?? ""),
  );

  const err = (name: keyof ProductFormValues): string | undefined =>
    (formState.errors[name] as { message?: string } | undefined)?.message;
  const categoryOptions = flattenCategories(categories.data ?? []);
  const colors = [
    ...new Set(
      (product?.variants ?? [])
        .map((v) => v.color)
        .filter((c): c is string => !!c),
    ),
  ];
  const stockById: Record<number, number> = Object.fromEntries(
    Object.entries(stockOverrides).map(([id, stock]) => [Number(id), stock]),
  );
  const simpleStock = stockOverrides.product ?? product?.stock ?? 0;
  const variantRange =
    editing && product
      ? variantPriceRange(product.variants, product.currency)
      : null;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Section title={t.sections.basic}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="type"
              label={t.fields.type}
              hint={editing ? t.typeLocked : undefined}
            >
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    disabled={editing}
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (
                        value === "variable" &&
                        watch("variants").length === 0
                      )
                        setValue("variants", [emptyVariant(optionDefs)]);
                    }}
                  >
                    <SelectTrigger id="type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(editing
                        ? (["simple", "variable", "bundle"] as const)
                        : (["simple", "variable"] as const)
                      ).map((value) => (
                        <SelectItem key={value} value={value}>
                          {m.products.types[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField
              id="name"
              label={`${t.fields.name} *`}
              error={err("name")}
            >
              <Input
                id="name"
                maxLength={200}
                aria-invalid={err("name") ? true : undefined}
                {...register("name")}
              />
            </FormField>
          </div>
          <FormField
            id="description"
            label={t.fields.description}
            error={err("description")}
          >
            <Textarea id="description" rows={4} {...register("description")} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="category_id"
              label={`${t.fields.category} *`}
              error={err("category_id")}
            >
              <Controller
                control={control}
                name="category_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="category_id"
                      aria-invalid={err("category_id") ? true : undefined}
                      className="w-full"
                    >
                      <SelectValue placeholder={t.fields.selectPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((option) => (
                        <SelectItem key={option.id} value={String(option.id)}>
                          {option.label}
                          {option.inactive
                            ? ` (${m.categories.inactiveSuffix})`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField
              id="brand_id"
              label={t.fields.brand}
              error={err("brand_id")}
            >
              <Controller
                control={control}
                name="brand_id"
                render={({ field }) => (
                  <Select
                    value={field.value || NO_BRAND}
                    onValueChange={(value) =>
                      field.onChange(value === NO_BRAND ? "" : value)
                    }
                  >
                    <SelectTrigger id="brand_id" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_BRAND}>
                        {t.fields.noBrand}
                      </SelectItem>
                      {(brands.data ?? []).map((brand) => (
                        <SelectItem key={brand.id} value={String(brand.id)}>
                          {brand.name}
                          {brand.is_active === false
                            ? ` (${m.categories.inactiveSuffix})`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField
              id="sku"
              label={t.fields.sku}
              hint={t.fields.skuHint}
              error={err("sku")}
            >
              <Input id="sku" dir="ltr" maxLength={64} {...register("sku")} />
            </FormField>
            <FormField
              id="slug"
              label={t.fields.slug}
              hint={t.fields.slugHint}
              error={err("slug")}
            >
              <Input
                id="slug"
                dir="ltr"
                maxLength={120}
                {...register("slug")}
              />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Controller
              control={control}
              name="is_new"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            {t.fields.isNew}
          </label>
        </Section>

        <Section title={t.sections.pricing}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              id="currency"
              label={t.fields.currency}
              hint={editing ? t.currencyNote : undefined}
              error={err("currency")}
            >
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="currency" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {t.currencies[code]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            {type !== "variable" ? (
              <>
                <FormField
                  id="price"
                  label={`${t.fields.price} *`}
                  error={err("price")}
                >
                  <Input
                    id="price"
                    dir="ltr"
                    inputMode={currency === "SYP" ? "numeric" : "decimal"}
                    aria-invalid={err("price") ? true : undefined}
                    {...register("price")}
                  />
                </FormField>
                <FormField
                  id="sale_price"
                  label={t.fields.salePrice}
                  error={err("sale_price")}
                >
                  <Input
                    id="sale_price"
                    dir="ltr"
                    inputMode={currency === "SYP" ? "numeric" : "decimal"}
                    aria-invalid={err("sale_price") ? true : undefined}
                    {...register("sale_price")}
                  />
                </FormField>
              </>
            ) : null}
            {type === "simple" && !editing ? (
              <FormField
                id="stock"
                label={`${t.fields.stock} *`}
                error={err("stock")}
              >
                <Input
                  id="stock"
                  dir="ltr"
                  inputMode="numeric"
                  aria-invalid={err("stock") ? true : undefined}
                  {...register("stock")}
                />
              </FormField>
            ) : null}
            {type === "simple" && editing && product ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t.fields.stock}</span>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums">{simpleStock}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setStockTarget({
                        productId: product.id,
                        label: product.name,
                        stock: simpleStock,
                      })
                    }
                  >
                    {m.products.actions.adjustStock}
                  </Button>
                </div>
                <p className="text-xs text-ink-muted">{t.stockEditHint}</p>
              </div>
            ) : null}
          </div>
          {variantRange ? (
            <p className="text-sm text-ink-muted">
              {m.products.columns.price}: {variantRange}
            </p>
          ) : null}
          {type === "bundle" ? (
            <p className="text-sm text-ink-muted">{t.bundleNote}</p>
          ) : null}
        </Section>

        {categoryValue ? (
          attributeDefs.length > 0 || detail.isPending ? (
            <Section title={t.sections.attributes}>
              <AttributeFields definitions={attributeDefs} />
            </Section>
          ) : null
        ) : (
          <p className="text-sm text-ink-muted">{t.selectCategoryFirst}</p>
        )}

        {type === "variable" ? (
          <Section title={t.sections.variants}>
            {categoryValue ? (
              <VariantsEditor
                definitions={optionDefs}
                editing={editing}
                productId={product?.id}
                productName={product?.name}
                stockById={stockById}
                onAdjustStock={setStockTarget}
              />
            ) : (
              <p className="text-sm text-ink-muted">{t.selectCategoryFirst}</p>
            )}
          </Section>
        ) : null}

        <Section title={t.sections.images}>
          {product ? (
            <ProductImages
              productId={product.id}
              initial={product.images}
              colors={colors}
            />
          ) : (
            <StagedImages
              files={files}
              onChange={setFiles}
              disabled={saving}
              progress={progress}
            />
          )}
        </Section>

        <Section title={t.sections.status}>
          <label className="flex items-center gap-2 text-sm">
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <Switch
                  id="is_active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            {t.fields.isActive}
          </label>
          <p className="text-xs text-ink-muted">{t.fields.isActiveHint}</p>
        </Section>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? t.saving : t.save}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => navigate("/products")}
          >
            {t.back}
          </Button>
        </div>
      </form>

      <StockAdjustDialog
        target={stockTarget}
        onOpenChange={(open) => !open && setStockTarget(null)}
        onAdjusted={(stock) =>
          setStockOverrides((current) => ({
            ...current,
            ...(stockTarget?.variantId === undefined
              ? { product: stock }
              : { [stockTarget.variantId]: stock }),
          }))
        }
      />
      <ConfirmDialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) =>
          !open && blocker.state === "blocked" && blocker.reset()
        }
        title={t.unsaved.title}
        description={t.unsaved.description}
        confirmLabel={t.unsaved.leave}
        destructive
        onConfirm={() => blocker.state === "blocked" && blocker.proceed()}
      />
    </FormProvider>
  );
}
