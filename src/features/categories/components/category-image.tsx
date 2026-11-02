import { toast } from "sonner";

import { ImageField } from "@/components/shared/image-field";
import { errorMessage } from "@/lib/errors";
import { m } from "@/messages";

import { useCategoryImage, type CategoryDetail } from "../api";

/** The category's cover image; upload, replace and remove apply immediately. */
export function CategoryImage({ category }: { category: CategoryDetail }) {
  const { set, remove } = useCategoryImage(category.id);
  const t = m.categories.image;
  return (
    <ImageField
      image={category.image}
      labels={t}
      pending={set.isPending || remove.isPending}
      onPick={(file) =>
        set.mutate(file, {
          onSuccess: () => toast.success(t.updated),
          onError: (error) => toast.error(errorMessage(error)),
        })
      }
      onRemove={() =>
        remove.mutate(undefined, {
          onSuccess: () => toast.success(t.removed),
          onError: (error) => toast.error(errorMessage(error)),
        })
      }
    />
  );
}
