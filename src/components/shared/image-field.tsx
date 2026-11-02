import { ImagePlusIcon, Trash2Icon } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { checkImageFile, IMAGE_TYPES } from "@/lib/image-files";
import { imageProps, type ImageUrls } from "@/lib/images";

type Labels = {
  add: string;
  replace: string;
  remove: string;
  hint: string;
  empty: string;
  badType: string;
  tooLarge: string;
  uploading: string;
};

type Props = {
  /** The current image from the backend (`{thumb, medium, large}`), if any. */
  image: ImageUrls | null | undefined;
  /** A local file chosen but not uploaded yet (create dialogs), shown instead of `image`. */
  stagedUrl?: string | null;
  labels: Labels;
  pending?: boolean;
  disabled?: boolean;
  onPick: (file: File) => void;
  onRemove?: () => void;
};

/** One image (a category's cover, a brand's logo): thumbnail, upload/replace, remove. */
export function ImageField({
  image,
  stagedUrl,
  labels,
  pending,
  disabled,
  onPick,
  onRemove,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const has = Boolean(stagedUrl || image);

  const choose = (list: FileList | null) => {
    const file = list?.[0];
    if (input.current) input.current.value = "";
    if (!file) return;
    const check = checkImageFile(file);
    if (check === "type")
      return void toast.error(`${labels.badType} ${file.name}`);
    if (check === "size")
      return void toast.error(`${labels.tooLarge} ${file.name}`);
    onPick(file);
  };

  return (
    <div className="flex items-center gap-4">
      {stagedUrl ? (
        <img
          src={stagedUrl}
          alt=""
          className="size-24 rounded-lg border border-line object-cover"
        />
      ) : image ? (
        <img
          {...imageProps(image, "96px")}
          alt=""
          className="size-24 rounded-lg border border-line object-cover"
        />
      ) : (
        <div className="flex size-24 items-center justify-center rounded-lg border border-dashed border-line text-xs text-ink-muted">
          {labels.empty}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || pending}
            onClick={() => input.current?.click()}
          >
            <ImagePlusIcon data-icon="inline-start" />
            {has ? labels.replace : labels.add}
          </Button>
          {has && onRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || pending}
              onClick={onRemove}
            >
              <Trash2Icon data-icon="inline-start" className="text-danger" />
              {labels.remove}
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-ink-muted">
          {pending ? labels.uploading : labels.hint}
        </p>
        <input
          ref={input}
          type="file"
          hidden
          data-testid="image-input"
          accept={IMAGE_TYPES.join(",")}
          aria-label={labels.add}
          onChange={(event) => choose(event.target.files)}
        />
      </div>
    </div>
  );
}
