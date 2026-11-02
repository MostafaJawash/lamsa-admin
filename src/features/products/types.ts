import type { components } from "@/lib/api/schema";

type Schemas = components["schemas"];

export type ProductListItem = Schemas["AdminProductListItem"];
export type AdminProduct = Schemas["AdminProductOut"];
export type AdminVariant = Schemas["AdminVariantOut"];
export type AdminImage = Schemas["AdminImageOut"];
export type ProductCreateBody = Schemas["ProductCreate"];
export type ProductUpdateBody = Schemas["ProductUpdate"];
export type VariantCreateBody = Schemas["VariantIn"];
export type VariantUpdateBody = Schemas["VariantUpdate"];

export type ProductType = "simple" | "variable" | "bundle";
export type CurrencyCode = "SYP" | "USD";
export const CURRENCIES: readonly CurrencyCode[] = ["SYP", "USD"];
