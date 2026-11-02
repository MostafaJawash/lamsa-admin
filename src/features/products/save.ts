import {
  buildCreatePayload,
  buildUpdatePayload,
  diffVariants,
  type Definitions,
} from "./payload";
import {
  addVariant,
  createProduct,
  patchVariant,
  removeVariant,
  updateProduct,
  uploadImage,
} from "./requests";
import type { ProductFormValues } from "./schema";
import type { AdminProduct } from "./types";

/** The product exists on the backend, but a later step failed. The UI then opens its edit page. */
export class PartialSaveError extends Error {
  readonly productId: number;
  readonly stage: "images" | "publish";
  readonly causes: unknown[];

  constructor(
    productId: number,
    stage: "images" | "publish",
    causes: unknown[],
  ) {
    super(`product ${productId} saved, ${stage} failed`);
    this.name = "PartialSaveError";
    this.productId = productId;
    this.stage = stage;
    this.causes = causes;
  }
}

export type UploadFailure = { file: File; error: unknown };

/** Uploads files one request each, in order (the first uploaded is the main image). */
export async function uploadImages(
  productId: number,
  files: readonly File[],
  color?: string,
  onProgress?: (done: number, total: number) => void,
): Promise<UploadFailure[]> {
  const failures: UploadFailure[] = [];
  let done = 0;
  for (const file of files) {
    try {
      await uploadImage(productId, file, color);
    } catch (error) {
      failures.push({ file, error });
    }
    onProgress?.(++done, files.length);
  }
  return failures;
}

/**
 * Create flow: POST the product (always inactive), upload the staged images, then publish
 * if the admin asked for it. Returns the new id; throws `PartialSaveError` when the product
 * was created but images or publishing failed.
 */
export async function saveNewProduct(
  values: ProductFormValues,
  definitions: Definitions,
  files: readonly File[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const product = await createProduct(buildCreatePayload(values, definitions));
  if (files.length > 0) {
    const failures = await uploadImages(
      product.id,
      files,
      undefined,
      onProgress,
    );
    if (failures.length > 0)
      throw new PartialSaveError(
        product.id,
        "images",
        failures.map((failure) => failure.error),
      );
  }
  if (values.is_active) {
    try {
      await updateProduct(product.id, { is_active: true });
    } catch (error) {
      throw new PartialSaveError(product.id, "publish", [error]);
    }
  }
  return product.id;
}

/**
 * Edit flow: PATCH the product, then (variable products) delete, patch and add variants
 * through their own endpoints. Images and stock are changed immediately elsewhere.
 */
export async function saveExistingProduct(
  product: AdminProduct,
  values: ProductFormValues,
  definitions: Definitions,
): Promise<void> {
  await updateProduct(
    product.id,
    buildUpdatePayload(values, definitions, product.is_active),
  );
  if (values.type !== "variable") return;
  const diff = diffVariants(
    product.variants,
    values.variants,
    definitions.options,
  );
  for (const id of diff.remove) await removeVariant(product.id, id);
  for (const { id, body } of diff.patch)
    await patchVariant(product.id, id, body);
  for (const body of diff.add) await addVariant(product.id, body);
}
